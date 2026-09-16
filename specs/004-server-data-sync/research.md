# Phase 0 Research: Server-Based Data Sync

**Date**: 2026-09-16 | **Status**: Complete

Research findings for unknowns identified in technical context and spec requirements.

---

## 1. Offline-First Sync Patterns for File-Level Changes

### Decision
**Operational Transformation (OT)-inspired approach**: Local changes are queued with client-side timestamps. When connectivity is restored, changes are sent to server in order, with server-side conflict detection. Works well for file-level (not character-level) edits where conflicts are rare and clearly separated.

### Rationale
- Lili Trainer operates at file level (program.md, feedback.md are complete units), not character level
- Coach typically makes discrete changes (create program, update program) separated by hours/days
- Feedback entries are append-only (no simultaneous edits to same feedback entry)
- OT is overkill; simpler last-writer-wins + offline queue is sufficient for this domain
- Reduces complexity vs CRDT or full conflict-free replicated data types

### Alternatives Considered
- **CRDT (Conflict-Free Replicated Data Type)**: Eliminates conflicts but adds overhead; unnecessary for file-level, low-frequency edits
- **Last-Write-Wins (LWW)**: Simple but loses coach's work if server update arrives first; doesn't align with coach-always-wins requirement
- **Manual conflict resolution**: User has to resolve conflicts; violates performance goal (SC-007: resolve within 2 min)
- **Full version history + branching**: Overkill for a coaching app; complexity not justified

### Implementation Approach
1. **Coach offline work**: Local edits to program.md/notes.md are saved normally. System tracks "has unsync'd changes" flag.
2. **Reconnection**: On reconnect, client sends all queued changes with source timestamp and content hash.
3. **Server-side merge**: Server checks for conflicts (another file version exists for same customer). If coach-always-wins rule applies, server overwrites. Logs conflict event.
4. **Confirmation**: Client receives sync success; "unsync'd" flag cleared.

---

## 2. Conflict Resolution Algorithm

### Decision
**Coach Precedence with UI Feedback Preservation**: 
- When coach edits program.md and customer submits feedback simultaneously (within 1s window):
  - Coach's program.md change succeeds and is synced to server
  - Customer's feedback submission is rejected (returns HTTP 409 Conflict)
  - Customer can retry feedback submission after seeing updated program
  - Feedback entries created before/after conflict window are preserved (not lost)

### Rationale
- **Coach expertise is authoritative** on program structure; customer feedback informs program but doesn't override it
- **Spec requirement FR-007** explicitly states "coach changes take precedence"
- **Feedback is append-only**, not destructive; no real data loss
- **Conflict window is small** (1 second); genuine simultaneous edits are rare
- **User experience**: Customer sees updated program after conflict, can resubmit feedback in seconds
- **Simpler than manual review**: Aligns with SC-007 (2-minute resolution)

### Alternatives Considered
- **Manual conflict review**: Requires coach to manually resolve in Claude Code; too slow (violates SC-007)
- **Merge feedback + program**: Feedback valid regardless of program version; doesn't prevent semantic inconsistencies
- **Versioned programs**: Keep multiple program versions; too complex, violates simplicity principle
- **Last-write-wins**: Unpredictable UX; coach might not know their work was lost

### Conflict Detection Mechanism
- **Timestamp-based**: Record server's modification timestamp for program.md
- **Version identifier**: Maintain a version counter per file (incremented on each write)
- **Detection**: On coach sync, compare coach's "last known version" with server's current version
  - If match: no conflict, apply coach changes, increment version
  - If mismatch: conflict detected, reject coach update or UI feedback depending on timing
- **Logging**: Record conflict event (timestamp, customer, file, versions involved) for audit

---

## 3. SQLite Patterns for Persistent Sync State

### Decision
**Separate sync-state database** (alongside existing index.sqlite):
- Single table `sync_metadata` tracking:
  - `customer_id` (foreign key to customers index)
  - `file_type` (program | feedback | notes)
  - `last_sync_timestamp` (UTC, when file was last successfully synced)
  - `current_version` (integer counter, incremented per write)
  - `last_writer` (coach | customer, for conflict resolution)
  - `sync_status` (synced | pending | conflicted)
  - `offline_queue` (JSON blob of queued changes for offline-first flow)

### Rationale
- **Separation of concerns**: Index DB tracks customer state (program present? feedback entries?); sync DB tracks transfer state
- **Simple schema**: Single table per file type, easy to query and update
- **Transactions**: SQLite's ACID guarantees ensure sync state is never corrupted (even if process crashes mid-sync)
- **Timestamp + version vector**: Cheap conflict detection without complex algorithms
- **Offline queue as JSON blob**: Avoids multi-row complexity for storing ordered change history

### Alternatives Considered
- **Store sync state in index.sqlite**: Would work but couples sync concerns with query logic; harder to migrate/modify
- **File system metadata**: Using file modification times; unreliable (file system time can be changed, not atomic across network)
- **Event sourcing**: Every sync event creates a row; overkill for this scale
- **Distributed consensus**: Not needed; single server is authority

### Query Patterns
```sql
-- Check if file is in sync
SELECT * FROM sync_metadata 
WHERE customer_id = ? AND file_type = 'program' AND sync_status = 'synced'

-- Get offline queue for reconnection
SELECT offline_queue FROM sync_metadata 
WHERE customer_id = ? AND sync_status = 'pending'

-- Record conflict
UPDATE sync_metadata 
SET sync_status = 'conflicted', last_writer = 'coach' 
WHERE customer_id = ? AND file_type = 'program'
```

---

## 4. Real-Time Feedback Delivery: WebSocket vs Polling

### Decision
**Polling (short-poll with exponential backoff)** for v1:
- Coach polls `/api/customers/{id}/feedback` every 5-10 seconds when UI is open
- On feedback submission, poll immediately to fetch new entry
- No persistent connection overhead; simpler server implementation

### Rationale
- **Deployment simplicity**: No WebSocket infrastructure needed (no need for sticky sessions, multiple server instances, heartbeat logic)
- **Existing REST API**: Can reuse current /api/customers/{id} endpoint
- **Feedback is low-frequency**: Coach doesn't need sub-second updates; 5-10 second latency acceptable (SC-002 says < 30s)
- **Aligns with offline-first**: Polling works naturally in offline scenarios (backed off automatically when server unreachable)
- **Scaling**: Polling scales to 10+ concurrent users without optimization

### Alternatives Considered
- **WebSocket**: Real-time push, but requires persistent connection management, server affinity, graceful disconnect handling
- **Server-Sent Events (SSE)**: Similar to WebSocket; still requires long-lived connection
- **Webhooks**: Server pushes to coach; requires coach to expose endpoint (not practical for Claude Code)

### Implementation
- UI fetches feedback every 5-10 seconds while coach view is active
- On customer feedback submission (via POST /api/customers/{id}/feedback), UI immediately polls to get new entry
- Coach sees feedback < 30 seconds after customer submits (meets SC-002)

---

## 5. Sync Integrity Verification

### Decision
**Content hash + version counter**:
- On each sync, compute SHA256 hash of file content
- Store hash in sync-state database
- Before applying sync, verify hash matches expected content
- Prevents silent data corruption (e.g., encoding errors, partial writes)

### Rationale
- **Cheap integrity check**: Hash computation is fast; doesn't require full diff
- **Detects corruption**: Catches encoding errors, partial file writes, network corruption
- **Audit trail**: Hash stored in sync log enables post-mortem analysis if sync fails
- **Aligns with Principle II**: Verify-before-save standard; hash is the "verification"
- **Spec requirement FR-010**: Log all sync events; hashes are part of the log

### Alternatives Considered
- **Checksums (CRC32)**: Faster but less collision-resistant
- **Full diff**: Too expensive for large files (programs can be multi-KB)
- **Timestamps only**: Doesn't catch corruption, only ordering
- **No verification**: Violates data consistency requirement (SC-003: 99.9% consistency)

### Verification Logic
```
On coach sync (sending program.md to server):
  1. Compute SHA256(local_program_md_content)
  2. Send to server with version_counter
  3. Server checks: version_counter == current_version + 1?
  4. Server computes SHA256(received_content)
  5. If hash matches declared hash AND version checks: apply sync
  6. If hash mismatch: reject with error, log integrity failure
```

---

## Summary: Technical Decisions Table

| Unknown | Decision | Rationale | Trade-off |
|---------|----------|-----------|-----------|
| Sync pattern | Offline queue + server merge | File-level, low-frequency edits; simple enough | Requires coach to retry feedback on conflict |
| Conflict resolution | Coach-always-wins | Spec requirement FR-007; preserves program integrity | Customer feedback may need retry in rare cases |
| Sync state storage | Separate SQLite table | Clean separation; ACID guarantees; simple queries | 2 DB files instead of 1 (negligible overhead) |
| Real-time feedback | Short-poll (5-10s) | Simple; scales to 10+ users; works offline | Not true real-time (30s latency acceptable per spec) |
| Integrity verification | Content hash + version | Cheap; detects corruption; audit-able | Slight CPU overhead (negligible for markdown files) |

---

## Next: Phase 1 Design

With these research findings, Phase 1 will define:
1. **data-model.md**: Sync state schema (sync_metadata table, offline_queue JSON structure)
2. **contracts/sync-protocol.md**: File sync API endpoints (/api/sync/upload, /api/sync/download, /api/sync/status)
3. **contracts/conflict-resolution.md**: Algorithm details (version checking, timestamp comparison, coach precedence)
4. **contracts/offline-queue.md**: Local queue structure (timestamps, hashes, ordered changes)
5. **quickstart.md**: End-to-end test scenarios (coach creates program → customer sees it → customer submits feedback → coach sees it)
