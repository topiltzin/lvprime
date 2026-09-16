# Conflict Resolution Algorithm

**Purpose**: Defines deterministic rules for handling concurrent edits between coach (local) and server.

**Design Principle**: Coach changes always take precedence (FR-007, Spec Requirement). Feedback is append-only and never lost.

---

## Conflict Types

### Type 1: Coach Version Mismatch (Program Edit)

**Scenario**: Coach edits program.md locally while server version advances (e.g., another coach sync or UI feedback processing).

**Detection**: 
- Coach sends version=3, but server has version=4
- Comparison happens at upload time

**Resolution**: Coach-Always-Wins
- Coach's content (version 3) is accepted and overrides server (version 4)
- New version becomes 5 (incremented from server's 4)
- Coach's change succeeds; server version advances
- Last_writer = 'coach'
- Conflict logged for audit trail

**Implementation**:
```
if (coach_version < server_version) {
  // Coach has stale version; still accept coach's changes
  new_version = server_version + 1;
  server_file = coach_content;
  last_writer = 'coach';
  log_conflict(customer, file_type, coach_version, server_version);
  return 201 Created { new_version };
}
```

**User Experience**:
- Coach sees "Sync successful, version updated to 5"
- Server state now reflects coach's latest work
- No data loss; coach's edit wins

---

### Type 2: Simultaneous Coach Edit & Customer Feedback

**Scenario**: 
- Coach uploads program.md at time T
- Customer submits feedback at time T (within ~1 second window)

**Detection**:
- Both requests processed by server concurrently
- Version check on feedback: does program version match what customer saw?
- If version mismatch detected: conflict

**Resolution**: Coach Precedence with Feedback Retry
- Coach's program upload succeeds (version incremented)
- Customer's feedback is rejected (409 Conflict)
- Customer sees error message: "Program was updated. Please review and resubmit feedback."
- Feedback data is not lost; customer retries after seeing new program
- No feedback entry created in this conflict window

**Implementation**:
```
// Coach sync happens first (or simultaneously)
new_program_version = server_version + 1;
update_program_file(program_content);

// Customer feedback arrives (concurrent)
if (customer_program_version != current_server_version) {
  // Version mismatch; feedback rejected
  return 409 Conflict {
    conflict_type: 'customer_feedback_simultaneous',
    new_version: new_program_version,
    message: 'Program updated by coach; please retry feedback'
  }
}
```

**User Experience**:
- **Coach**: Sync succeeds silently; latest program on server
- **Customer**: "The program was just updated. Please review it and submit your feedback again."
- **Outcome**: No data loss; customer adapts to new program, feedback submitted moments later

---

### Type 3: Notes Edit (Low Priority)

**Scenario**: Coach edits notes.md while sync is in progress.

**Detection**: Same as Type 1 (version mismatch)

**Resolution**: Coach-Always-Wins (same as Type 1)
- Notes are coach-only; no conflict with customer feedback
- Simpler case than program conflicts

---

## Timing Windows & Conflict Boundaries

### Conflict Window Definition

A conflict is detected when:
1. **Coach uploads file** with `current_version=X` but server has `current_version=Y` where `Y > X`
2. **Customer submits feedback** with `program_version=X` but server has advanced to `program_version=Y`
3. Timing: Within **1 second** of concurrent requests

### Why 1 Second?

- Captures truly simultaneous edits (network delays ~0.1-0.5s)
- Allows server to process both requests before responding
- Feedback retry is trivial (< 5 seconds) so conflicts are recoverable
- Aligns with spec SC-002 (< 30s feedback delivery)

### Beyond the Window

- If coach edits happen seconds apart: No conflict (sequential, both succeed)
- If customer feedback follows coach edit by > 1s: Succeeds (coach update already synced)
- If coach edit follows feedback: Conflicts only if simultaneous (rare)

---

## Algorithm Pseudocode

### Coach Upload Sync

```
function handleCoachSync(request):
  customer_id = request.customer_id
  file_type = request.file_type
  coach_version = request.current_version
  coach_content = request.content
  coach_hash = request.content_hash
  
  // 1. Validate
  if not validateHash(coach_content, coach_hash):
    return 422 UnprocessableEntity { error: 'integrity_check_failed' }
  
  // 2. Fetch server state
  server_state = getFileSync(customer_id, file_type)
  server_version = server_state.current_version
  
  // 3. Conflict detection
  if coach_version < server_version:
    // Version mismatch, but coach still wins
    logConflict(customer_id, file_type, coach_version, server_version)
    last_writer = 'coach'
  else:
    // Versions match or coach has newer; normal update
    last_writer = 'coach'
  
  // 4. Apply change
  new_version = server_version + 1
  updateFile(customer_id, file_type, coach_content, new_version, last_writer)
  recordSyncState(customer_id, file_type, new_version, 'synced', coach_hash)
  logSyncEvent('sync_success', customer_id, file_type, server_version → new_version)
  
  // 5. Respond
  return 201 Created {
    status: 'synced',
    new_version: new_version,
    last_sync_timestamp: now()
  }
```

### Customer Feedback Submission

```
function handleFeedbackSubmission(request):
  customer_id = request.customer_id
  customer_program_version = request.seen_program_version  // Version customer saw
  feedback_data = request.feedback
  
  // 1. Check program version
  current_program_version = getFileSync(customer_id, 'program').current_version
  
  if customer_program_version != current_program_version:
    // Version mismatch; customer's feedback rejected
    logConflict(customer_id, 'feedback', customer_program_version, current_program_version)
    return 409 Conflict {
      conflict_type: 'customer_feedback_simultaneous',
      new_version: current_program_version,
      message: 'Program was updated; please review and retry feedback'
    }
  
  // 2. Validate feedback
  if not validateFeedback(feedback_data):
    return 422 UnprocessableEntity { error: 'validation_failed', fields: ... }
  
  // 3. Append feedback
  appendFeedback(customer_id, feedback_data)
  recordSyncState(customer_id, 'feedback', ..., 'synced')
  logSyncEvent('sync_success', customer_id, 'feedback', ...)
  
  // 4. Respond
  return 201 Created { entry: feedback_entry }
```

---

## Conflict Logging

Every conflict is logged for audit and debugging:

```json
{
  "timestamp": "2026-09-16T10:30:00Z",
  "customer_id": "alice-smith",
  "file_type": "program",
  "conflict_type": "version_mismatch",
  "coach_version": 3,
  "server_version": 4,
  "resolution": "coach_always_wins",
  "new_version": 5,
  "source": "coach",
  "last_writer": "coach",
  "notes": "Coach edits still applied; server version incremented"
}
```

---

## State Transitions

### For Program File

```
SYNCED (version=3)
  ├─ [Coach edits locally]
  │  └─→ [Coach uploads with version=3]
  │     ├─ [Server version still 3]
  │     │  └─→ SYNCED (version=4, last_writer=coach) ✓
  │     │
  │     └─ [Server version advanced to 4 (concurrent edit)]
  │        └─→ SYNCED (version=5, last_writer=coach, conflict logged) ⚠️
  │           Coach changes still applied; conflict resolved deterministically
  │
  └─ [Customer submits feedback with program_version=3]
     └─ [Server program version still 3]
        └─→ SYNCED (feedback appended) ✓
     
     └─ [Server program version advanced to 4 (concurrent edit)]
        └─→ 409 CONFLICT (feedback rejected, customer retries) ⚠️
           Customer sees "program updated"; no data loss
```

---

## Guarantees

1. **No data loss**: Feedback is never lost; if rejected, customer can retry
2. **Deterministic**: Same inputs always produce same result (coach always wins)
3. **Audit-able**: All conflicts logged for post-mortem analysis
4. **Fast recovery**: Conflicts resolved within seconds (no manual intervention needed)
5. **User transparency**: Clear error messages explain what happened and what to do

---

## Testing Scenarios

1. **Happy path**: Coach syncs, server version matches, succeeds
2. **Stale coach**: Coach has version 2, server has version 3, coach still wins
3. **Simultaneous feedback**: Coach edit + customer feedback at same time, feedback rejected, customer retries
4. **Offline then online**: Coach queues changes offline, connects, syncs all, no conflict
5. **Timeout**: Coach upload fails mid-transfer; server state unchanged, coach retries
