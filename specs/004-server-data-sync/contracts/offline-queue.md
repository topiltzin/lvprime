# Offline Queue Contract

**Purpose**: Defines the structure and lifecycle of changes queued by coach while offline.

**Design**: Coach continues editing locally without server connectivity; changes are queued and flushed when connection restores.

---

## Queue Storage

### Location

- **Local Storage**: Browser IndexedDB (for web UI coach dashboard, if implemented)
- **Local File System**: JSON file alongside program.md/notes.md (for Claude Code local workflow)
- **Server Backup**: Copy of queue stored in `sync_metadata.offline_queue` column after first sync attempt

### Format (JSON Array)

```json
{
  "queue": [
    {
      "sequence": 1,
      "timestamp": "2026-09-16T10:30:00Z",
      "file_type": "program",
      "action": "write",
      "content_hash": "abc123def456...",
      "content_size_bytes": 2048,
      "description": "Updated week 1 exercises based on feedback"
    },
    {
      "sequence": 2,
      "timestamp": "2026-09-16T10:35:00Z",
      "file_type": "notes",
      "action": "write",
      "content_hash": "def789ghi012...",
      "content_size_bytes": 512,
      "description": "Added observation about customer's form improvement"
    }
  ],
  "created_at": "2026-09-16T10:30:00Z",
  "last_updated": "2026-09-16T10:35:00Z",
  "customer_id": "alice-smith"
}
```

---

## Queue Entry Structure

### Fields

```json
{
  "sequence": 1,
  "timestamp": "2026-09-16T10:30:00Z",
  "file_type": "program",
  "action": "write",
  "content": "# Program content (full file content)",
  "content_hash": "sha256_hex_string",
  "content_size_bytes": 2048,
  "description": "Updated week 1 exercises"
}
```

### Field Definitions

- **sequence** (integer, required): Order of changes (1, 2, 3, ...). Used to preserve change order during flush.
- **timestamp** (ISO8601 string, required): When the change was made (coach's local time). Used by server for conflict detection.
- **file_type** (string, required): "program" or "notes" (not "feedback"; feedback is UI-only)
- **action** (string, required): "write" (append or overwrite entire file)
- **content** (string, required): Full file content at time of edit
- **content_hash** (string, required): SHA256 hash of content; verified during flush to prevent corruption
- **content_size_bytes** (integer, required): Size in bytes; sanity check (e.g., detect truncated writes)
- **description** (string, optional): Human-readable note on what changed (e.g., "Updated week 1 exercises")

---

## Lifecycle

### 1. Offline Edit

```
Coach edits program.md locally while disconnected
  ↓
Client (Claude Code or UI) detects no server connectivity
  ↓
Increment sequence number (e.g., 1, 2, 3)
  ↓
Create queue entry:
  - Read file content from disk
  - Compute SHA256 hash
  - Record timestamp (now)
  - Add to queue array
  ↓
Write queue to localStorage / file system
  ↓
Set sync_status = 'pending' in sync_metadata
```

### 2. Offline Continued Edits

```
Coach makes another change while still offline
  ↓
Fetch existing queue from storage
  ↓
Append new entry with sequence = max(existing_sequence) + 1
  ↓
Write updated queue to storage
  ↓
sync_status remains 'pending'
```

### 3. Reconnection & Flush

```
Network connectivity restored (detected by health check or user action)
  ↓
Fetch queue from local storage
  ↓
For each entry in sequence order:
  - Compute current file content hash
  - Compare hash against queued hash
  - If mismatch: integrity error, pause flush, alert user
  - If match: proceed
  ↓
POST to /api/sync/upload with:
  - customer_id
  - file_type
  - current_version (from sync_metadata)
  - content (latest from queue)
  - offline_queue (entire queue, for server audit)
  ↓
Server responds:
  - 201 Created: Sync successful
    - Client clears queue
    - Set sync_status = 'synced'
    - Remove offline_queue from sync_metadata
  - 409 Conflict: Server version mismatch
    - Coach-always-wins rule applies
    - Queue is flushed anyway (coach changes override)
    - Client clears queue, updates sync_status = 'synced'
  - 500+ Server Error: Retry
    - Queue remains in storage
    - Retry exponential backoff
```

### 4. Success

```
Queue flushed successfully
  ↓
Local queue cleared
  ↓
sync_status = 'synced'
  ↓
sync_metadata.offline_queue = []
  ↓
Client displays "All changes synced"
```

### 5. Failure & Retry

```
Network error or server error (5xx)
  ↓
Queue remains in storage
  ↓
sync_status remains 'pending'
  ↓
Client shows: "Pending X changes. Will retry when connected."
  ↓
Exponential backoff: retry in 5s, 10s, 30s, 60s, etc.
  ↓
Eventually succeeds (connection restored, server recovers)
```

---

## Validation Rules

### Queue Entry Validation

- **sequence**: Must be integer >= 1; no gaps (1, 2, 3 valid; 1, 3, 5 invalid)
- **timestamp**: Must be valid ISO8601; can't be in future
- **file_type**: Must be "program" or "notes"
- **action**: Must be "write" (no delete/rename in v1)
- **content**: Must not be empty (empty edits disallowed; flag as error)
- **content_hash**: Must be valid SHA256 hex string (64 chars, lowercase)
- **content_size_bytes**: Must be > 0; must match length of content

### Queue Integrity Checks

Before flushing:
1. **Sequence continuity**: No gaps (1, 2, 3, ...)
2. **Timestamp ordering**: Timestamps must be in ascending order (or equal)
3. **Hash verification**: Re-compute hash of current file content; must match queued hash
4. **Size sanity**: Content size must be reasonable (e.g., < 50MB for markdown files)

Failure in any check → Pause flush, show error to coach, require manual intervention

---

## Server-Side Offline Queue Handling

### Storage

When coach syncs offline queue, server stores it in `sync_metadata.offline_queue`:

```sql
UPDATE sync_metadata
SET offline_queue = '[{sequence:1, ...}, {sequence:2, ...}]'
WHERE customer_id = ? AND file_type = ?
```

### Audit & Visibility

- Coach can query `/api/sync/status` to see offline queue status
- Offline queue is logged in sync_log table for audit trail
- Server never modifies queue (coach owns queue; server just stores it)

### Retention

- Queue cleared on successful sync
- Failed queue retained for up to 7 days (for debugging)
- Customer can manually clear queue if desired (clears sync_status = pending)

---

## Example: Coach Works Offline for 1 Hour

### Timeline

```
10:00 - Coach disconnects (no wifi, working in gym)

10:05 - Coach updates program.md (week 1 exercises)
        Queue: [{seq:1, timestamp:10:05, file_type:'program', ...}]
        sync_status = 'pending'

10:15 - Coach updates program.md again (add warm-up notes)
        Queue: [{seq:1, ...}, {seq:2, timestamp:10:15, file_type:'program', ...}]
        sync_status = 'pending'

10:30 - Coach updates notes.md (customer feedback observation)
        Queue: [{seq:1, ...}, {seq:2, ...}, {seq:3, timestamp:10:30, file_type:'notes', ...}]
        sync_status = 'pending'

11:00 - Coach connects to wifi (leaves gym)
        System detects connectivity
        Fetches queue from local storage
        POSTs to /api/sync/upload with offline_queue (3 entries)
        Server processes all 3 in order
        Returns 201 Created
        Client clears queue
        sync_status = 'synced'
        Coach sees: "✓ Synced 3 changes"
```

---

## Error Scenarios

### Scenario 1: Hash Mismatch on Flush

```
Queue entry:
  {seq:1, content_hash: "abc123...", content_size: 2048}

Current file on disk:
  content_hash: "def789..." (file was modified outside sync system)

Flush attempts:
  Recompute hash → "def789..."
  Compare to queued → "abc123..."
  Mismatch detected!

Action:
  Pause flush
  Show error: "Local file was modified. Queue out of sync."
  Suggest: Reload program.md or reset queue
  Coach must manually resolve (reload or clear queue)
```

### Scenario 2: Network Timeout During Flush

```
Coach POSTs offline_queue to /api/sync/upload
Network timeout (no response)

Client action:
  Queue remains in storage
  sync_status = 'pending'
  Show: "Sync failed. Retrying in 5 seconds..."
  Exponential backoff: 5s, 10s, 30s, 60s, 5min

Eventually succeeds (network recovers) → Sync completes
```

### Scenario 3: Multiple Offline Sessions

```
10:00 - Coach goes offline (session 1)
10:05 - Edit program.md
10:30 - Coach regains connection briefly
        Syncs successfully
        Queue cleared
        sync_status = 'synced'

11:00 - Coach goes offline again (session 2)
11:05 - Edit program.md
11:30 - Coach reconnects
        New queue (different session)
        Syncs successfully
```

---

## Testing Scenarios

1. **Create queue**: Edit program offline, verify queue created
2. **Append queue**: Make 3 edits offline, verify all in queue (sequence 1,2,3)
3. **Flush queue**: Connect, verify POST includes all queue entries
4. **Clear on success**: After sync, verify queue cleared and sync_status='synced'
5. **Persist on failure**: Network error during sync, verify queue still in storage
6. **Retry on failure**: Simulate network recovery, verify queue flushes on retry
7. **Hash verification**: Corrupt a queued file, attempt flush, verify integrity check fails
