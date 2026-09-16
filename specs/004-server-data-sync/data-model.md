# Phase 1 Design: Data Model

**Date**: 2026-09-16 | **Status**: Complete

Data structures and schema for server-based sync architecture.

---

## Sync State Database (sync-state.db)

### Table: `sync_metadata`

Tracks per-file sync state, enabling offline-first and conflict detection.

```sql
CREATE TABLE sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('program', 'feedback', 'notes')),
  last_sync_timestamp TEXT,  -- UTC ISO8601, null if never synced
  current_version INTEGER DEFAULT 0,  -- Incremented on each successful write
  last_writer TEXT CHECK(last_writer IN ('coach', 'customer', null)),
  sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('synced', 'pending', 'conflicted')),
  last_content_hash TEXT,  -- SHA256 of file content at last sync
  offline_queue TEXT,  -- JSON array of queued changes (when coach works offline)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, file_type)
);

CREATE INDEX idx_sync_status ON sync_metadata(sync_status);
CREATE INDEX idx_customer_id ON sync_metadata(customer_id);
```

**Field Definitions**:

- `customer_id` (TEXT): Foreign key to customer name (e.g., "alice-smith"); uniquely identifies customer directory
- `file_type` (TEXT): One of 'program', 'feedback', 'notes'; distinguishes which file is being synced
- `last_sync_timestamp` (TEXT): When this file was last successfully synced to/from server (UTC ISO8601). Null if never synced.
- `current_version` (INTEGER): Version counter; incremented atomically on each successful write. Used for conflict detection.
- `last_writer` (TEXT): Who last modified the file ('coach' or 'customer'). Used for conflict resolution (coach-always-wins).
- `sync_status` (TEXT): 
  - `synced`: File is in sync with server
  - `pending`: File has unsync'd changes waiting to be pushed to server (offline queue not empty)
  - `conflicted`: Last sync attempt resulted in conflict; requires manual intervention or retry
- `last_content_hash` (TEXT): SHA256 hash of file content at last successful sync. Used to verify integrity before applying changes.
- `offline_queue` (TEXT): JSON-serialized array of pending changes (coach edits while offline). Format: see Offline Queue Contract below.
- `created_at`, `updated_at` (TEXT): Audit timestamps

**Validation Rules**:

- `customer_id` must match an existing customer directory (validated at sync time, not DB-level)
- `file_type` must be one of three predefined values (enforced by CHECK)
- `current_version` must be >= 0; incremented atomically with file write
- `sync_status` transitions: `synced` → `pending` (on local edit) → `synced` (on successful push); `synced` → `conflicted` (on conflict) → `synced` (on retry)
- `last_content_hash` is null until first successful sync
- `offline_queue` is empty array `[]` when `sync_status == 'synced'`; populated when `sync_status == 'pending'`

### Table: `sync_log` (optional, for auditing)

Records all sync events for debugging and compliance.

```sql
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,  -- UTC ISO8601
  customer_id TEXT NOT NULL,
  file_type TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('sync_start', 'sync_success', 'sync_conflict', 'sync_error')),
  source TEXT CHECK(source IN ('coach', 'customer')),  -- Who initiated the sync
  version_from INTEGER,  -- Version at start of sync
  version_to INTEGER,    -- Version after sync (if successful)
  conflict_description TEXT,  -- Details if event_type == 'sync_conflict'
  error_message TEXT,    -- Details if event_type == 'sync_error'
  content_hash TEXT      -- SHA256 of synced content
);

CREATE INDEX idx_log_customer ON sync_log(customer_id);
CREATE INDEX idx_log_timestamp ON sync_log(timestamp);
```

---

## Offline Queue Structure

Stored as JSON in `sync_metadata.offline_queue` field.

```json
[
  {
    "sequence": 1,
    "timestamp": "2026-09-16T10:30:00Z",
    "file_type": "program",
    "action": "write",
    "content_hash": "abc123...",
    "content_size_bytes": 2048,
    "description": "Updated week 1 exercises"
  },
  {
    "sequence": 2,
    "timestamp": "2026-09-16T10:45:00Z",
    "file_type": "notes",
    "action": "write",
    "content_hash": "def456...",
    "content_size_bytes": 512,
    "description": "Added observation about customer's recovery time"
  }
]
```

**Queue Entry Fields**:

- `sequence` (INTEGER): Order of changes (1, 2, 3, ...). Preserved when syncing.
- `timestamp` (ISO8601): When coach made the change (local clock time). Used for server-side conflict detection.
- `file_type` (TEXT): 'program', 'notes' (not 'feedback'; feedback is UI-only)
- `action` (TEXT): 'write' (append/overwrite); only write supported in v1
- `content_hash` (TEXT): SHA256 of the content being queued. Verified during sync.
- `content_size_bytes` (INTEGER): Size of queued content. Sanity check during sync.
- `description` (TEXT): Human-readable note on what changed. For logs/UI, not semantically significant.

**Validation Rules**:

- `sequence` must be unique within a queue and start from 1
- `timestamp` must be in valid ISO8601 format
- `file_type` must match one of: program, notes
- `action` must be 'write' (delete/move not supported in v1)
- `content_hash` must be valid SHA256 hex string
- `content_size_bytes` must be > 0 (empty writes queued with size 0, but flagged as warning during sync)

---

## Sync State Machine

### State Transitions for a Single File

```
INITIAL (null row)
  ├─ [Coach creates program locally]
  └─→ PENDING (offline_queue=[{file_type=program,...}], sync_status=pending)

SYNCED (sync_status=synced, offline_queue=[])
  ├─ [Coach edits program locally, has connection]
  │  └─→ SYNCED (version++, last_writer=coach, last_sync_timestamp updated)
  │
  ├─ [Coach edits program locally, NO connection]
  │  └─→ PENDING (offline_queue populated, sync_status=pending)
  │
  └─ [Customer submits feedback via UI]
     └─→ SYNCED (if program not being edited) or CONFLICT (if simultaneous)

PENDING (sync_status=pending, offline_queue has entries)
  ├─ [Connection restored, coach reconnects]
  │  ├─ [Server version matches local version at start]
  │  │  └─→ SYNCED (offline_queue=[],version++, last_writer=coach)
  │  │
  │  └─ [Server version advanced (conflict)]
  │     └─→ CONFLICTED (last_writer=coach, but conflict log created)
  │
  └─ [Coach continues editing offline]
     └─→ PENDING (offline_queue extended with new changes)

CONFLICTED (sync_status=conflicted, last_writer noted)
  ├─ [Coach reviews server state, decides to retry with override]
  │  └─→ SYNCED (offline_queue=[],version++, conflict_log updated)
  │
  └─ [Coach ignores, server state stands]
     └─→ SYNCED (after timeout or manual reset)
```

---

## Key Entities and Relationships

### Entity: Sync Metadata

**Purpose**: Tracks file-level sync state for each customer's file.

**Attributes**:
- Sync state (synced, pending, conflicted)
- Version history (current_version counter)
- Last sync timestamp
- Offline queue (for disconnected coach)
- Content hash (integrity check)

**Relationships**:
- One Sync Metadata per (customer, file_type) pair
- Links to customer directory on file system (validated by customer_id)
- Links to sync_log for audit trail

**State Transitions**: See state machine above

### Entity: Offline Queue Entry

**Purpose**: Represents a single change made by coach while offline.

**Attributes**:
- Sequence number (preserves order)
- Change timestamp
- Content hash (integrity)
- File type (program or notes)
- Description (for human review)

**Relationships**:
- Many entries per sync_metadata.offline_queue (array)
- Ordered by sequence number
- Flushed atomically on sync (entire queue processed or rolled back)

---

## Validation Rules Summary

### Sync Metadata
- `customer_id` exists as a directory under customers/
- `file_type` is program, feedback, or notes
- `current_version` >= 0 and matches file system reality
- `last_content_hash` is valid SHA256 or null
- `offline_queue` is valid JSON array or empty array
- `sync_status` is consistent with `offline_queue` (pending if queue not empty, synced if queue empty)

### Offline Queue
- Each entry has sequence >= 1
- Sequences are contiguous (no gaps: 1, 2, 3, not 1, 3, 5)
- Each entry's timestamp is in valid ISO8601 format
- Each entry's content_hash is valid SHA256
- file_type is program or notes (not feedback)

### File System Integrity
- If sync_metadata.file_type == 'program', customers/{customer_id}/program.md must exist
- If sync_metadata.file_type == 'feedback', customers/{customer_id}/feedback.md must exist
- If sync_metadata.file_type == 'notes', customers/{customer_id}/notes.md must exist
- Content hash of file matches last_content_hash (if synced status)

---

## Next: Contracts

With data model defined, contracts will specify:
- `/api/sync/upload`: Coach pushes queued changes to server
- `/api/sync/download`: Coach fetches latest feedback and conflict status
- `/api/sync/status`: Check sync state (pending, synced, conflicted)
- Conflict resolution algorithm (how server handles version mismatch)
