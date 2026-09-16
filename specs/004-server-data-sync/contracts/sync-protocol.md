# Sync Protocol Contract

**Purpose**: Defines the HTTP API contract for bi-directional file sync between coach (local) and server.

**API Base URL**: `/api/sync`

**Authentication**: Uses existing auth system (coach can only sync their own customers)

---

## Endpoints

### POST /api/sync/upload

Coach (or local client) uploads queued changes for a customer.

**Request**:

```json
{
  "customer_id": "alice-smith",
  "file_type": "program",
  "current_version": 3,
  "content": "# Alice's Week 1 Program\n...",
  "content_hash": "abc123def456...",
  "offline_queue": []
}
```

**Request Fields**:

- `customer_id` (string, required): Customer identifier (e.g., "alice-smith")
- `file_type` (string, required): One of: "program", "notes" (not "feedback")
- `current_version` (integer, required): Coach's current version number for this file
- `content` (string, required): File content (markdown)
- `content_hash` (string, required): SHA256 hash of `content`
- `offline_queue` (array, optional): Queued changes from offline edits (if any). Empty if online.

**Response (201 Created - Success)**:

```json
{
  "status": "synced",
  "customer_id": "alice-smith",
  "file_type": "program",
  "new_version": 4,
  "server_version": 4,
  "last_sync_timestamp": "2026-09-16T10:30:00Z",
  "message": "Sync successful"
}
```

**Response (409 Conflict - Coach Version Mismatch)**:

Returned when server's version doesn't match coach's expected version (concurrent edit detected).

```json
{
  "status": "conflict",
  "customer_id": "alice-smith",
  "file_type": "program",
  "server_version": 5,
  "coach_version": 3,
  "conflict_resolution": "coach_always_wins",
  "message": "Coach changes will override server version on retry"
}
```

**Response (422 Unprocessable Entity - Integrity Error)**:

Returned when content hash doesn't match or file is corrupted.

```json
{
  "error": "integrity_check_failed",
  "expected_hash": "abc123...",
  "received_hash": "def456...",
  "message": "Content hash mismatch; upload aborted to prevent data corruption"
}
```

**Response (409 Conflict - Simultaneous Customer Feedback)**:

Returned when customer's feedback submission happened simultaneously with coach's program edit.

```json
{
  "status": "conflict",
  "conflict_type": "customer_feedback_simultaneous",
  "customer_id": "alice-smith",
  "file_type": "program",
  "new_version": 4,
  "message": "Program updated successfully. Customer's simultaneous feedback was not processed; customer can retry."
}
```

**Validation**:

- `customer_id` must exist (directory must exist at customers/{customer_id}/)
- `file_type` must be "program" or "notes"
- `content` must not be empty (empty file uploads rejected)
- `content_hash` must be valid SHA256 and match content (if mismatch, return 422)
- `current_version` must match server's version or be version+1 (if mismatch, return 409)

---

### GET /api/sync/download

Coach downloads latest server state and checks for conflicts/pending feedback.

**Request**:

```
GET /api/sync/download?customer_id=alice-smith&file_type=program&current_version=3
```

**Query Parameters**:

- `customer_id` (string, required): Customer identifier
- `file_type` (string, required): "program", "notes", or "feedback"
- `current_version` (integer, optional): Coach's current version. If provided and matches server, returns 304 (no update).

**Response (200 OK - Update Available)**:

```json
{
  "status": "download",
  "customer_id": "alice-smith",
  "file_type": "program",
  "current_version": 4,
  "content": "# Alice's Week 1 Program\n... (latest content from server)",
  "content_hash": "xyz789...",
  "last_sync_timestamp": "2026-09-16T10:35:00Z",
  "last_writer": "coach",
  "message": "Latest version available"
}
```

**Response (304 Not Modified)**:

Returned if coach's `current_version` matches server's version.

```
HTTP/1.1 304 Not Modified
```

**Response (404 Not Found)**:

Returned if customer or file doesn't exist on server.

```json
{
  "error": "not_found",
  "customer_id": "alice-smith",
  "file_type": "program",
  "message": "File not found or never synced to server"
}
```

**Response (409 Conflict)**:

Returned if sync status is "conflicted" and needs manual resolution.

```json
{
  "status": "conflicted",
  "customer_id": "alice-smith",
  "file_type": "program",
  "server_version": 5,
  "coach_version": 3,
  "conflict_log": "Coach version 3 attempted to sync but server version advanced to 5. Coach changes take precedence; retry upload to override.",
  "message": "Conflict detected; resolve by uploading latest coach version"
}
```

---

### GET /api/sync/status

Coach checks overall sync status for a customer (quick health check).

**Request**:

```
GET /api/sync/status?customer_id=alice-smith
```

**Query Parameters**:

- `customer_id` (string, required): Customer identifier

**Response (200 OK)**:

```json
{
  "customer_id": "alice-smith",
  "files": {
    "program": {
      "status": "synced",
      "current_version": 4,
      "last_sync_timestamp": "2026-09-16T10:30:00Z"
    },
    "feedback": {
      "status": "synced",
      "entry_count": 12,
      "last_entry_timestamp": "2026-09-16T10:45:00Z"
    },
    "notes": {
      "status": "synced",
      "current_version": 2,
      "last_sync_timestamp": "2026-09-16T10:15:00Z"
    }
  },
  "overall_status": "synced",
  "message": "All files in sync"
}
```

**Possible Status Values**:

- `"synced"`: File in sync, no pending changes
- `"pending"`: Local changes awaiting upload
- `"conflicted"`: Last sync failed due to conflict
- `"not_found"`: File never created

---

## Error Responses (All Endpoints)

### 401 Unauthorized

```json
{
  "error": "unauthorized",
  "message": "Authentication required or coach cannot access this customer"
}
```

### 403 Forbidden

```json
{
  "error": "forbidden",
  "message": "Coach does not have permission to sync this customer"
}
```

### 500 Internal Server Error

```json
{
  "error": "sync_error",
  "message": "Server error during sync; retry later"
}
```

---

## Sequence Diagrams

### Happy Path: Coach Syncs New Program

```
Coach (local)              Server
    |                       |
    ├─ Create program.md    |
    ├─ Compute hash         |
    ├─ POST /api/sync/upload
    │  (version=0, content, hash)
    │──────────────────────→|
    |                       ├─ Validate hash
    |                       ├─ Increment version to 1
    |                       ├─ Store in file system
    |                       ├─ Update sync_metadata
    |                       ├─ Log sync event
    |←─ 201 Created ────────┤
    |    (version=1)        |
    |                       |
    ├─ Update feedback.md   |
    └─ Repeat POST ────────→ (same flow)
```

### Conflict Path: Simultaneous Coach Edit & Customer Feedback

```
Coach (local)              Customer (UI)           Server
    |                           |                   |
    ├─ Edit program.md          |                   |
    ├─ POST /api/sync/upload ──────────────────────→|
    |  (version=3)              |                   |
    |                           ├─ Submit feedback →|
    |                           |  (program=v3)     |
    |                           |                   |
    |                           |  [conflict]       |
    |                           |   - Coach wins    |
    |←─ 201 Created ────────────────────────────────┤
    |   (version=4)             |                   |
    |                           |←─ 409 Conflict ──┤
    |                           |  (retry feedback) |
    |                           |                   |
    |                           ├─ Retry feedback →| (succeeds)
    |                           |←─ 201 Created ──┤
```

---

## Notes

- All timestamps are in UTC ISO8601 format
- Content hashes are SHA256 hex strings (64 characters)
- Versions start at 0 (first sync increments to 1)
- Conflict resolution always favors coach (FR-007, per spec)
- Feedback is handled by existing POST /api/customers/{id}/feedback endpoint (no sync protocol changes)
