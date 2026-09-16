# Quickstart: Validation Guide

**Purpose**: End-to-end validation scenarios that prove Server-Based Data Sync feature works.

**Prerequisites**:
- Running Node.js 22.5.0+
- App running: `npm run dev` (development server with sync endpoints)
- SQLite database: `app/data/index.sqlite` and `app/server/data/sync-state.db`
- Test customer directory: `customers/test-alice/` with program.md, feedback.md, notes.md

---

## Setup: Create Test Customer

```bash
# Create test customer directory
mkdir -p customers/test-alice

# Create program.md
cat > customers/test-alice/program.md <<'EOF'
# Test Alice's Week 1 Program

## Goal
Build a consistent workout habit

## Week 1 Schedule
- Monday: Upper Body
- Wednesday: Lower Body
- Friday: Cardio

EOF

# Create feedback.md (empty, will be populated)
touch customers/test-alice/feedback.md

# Create notes.md
cat > customers/test-alice/notes.md <<'EOF'
## Coach Notes
- First week starting
- Needs encouragement with consistency

EOF
```

---

## Scenario 1: Coach Creates Program & Customer Sees It

**Goal**: Verify P1 requirement - Coach creates locally, customer sees on server UI within 5 seconds.

### Test Steps

**1. Coach: Create program locally**

```bash
# Simulate coach editing program locally (via Claude Code or direct edit)
cat > customers/test-alice/program.md <<'EOF'
# Test Alice's Week 1 Program - Updated

## Goal
Build a consistent workout habit

## Week 1 Schedule
### Monday: Upper Body
- Push-ups: 3 sets x 10 reps
- Rows: 3 sets x 10 reps
- Rest: 60 seconds between sets

### Wednesday: Lower Body
- Squats: 3 sets x 12 reps
- Lunges: 3 sets x 10 reps
- Rest: 45 seconds between sets

### Friday: Cardio
- 20 minutes jogging
- 5 minutes cool-down walk

## Progression (Week 2)
- Increase reps by 2 on upper body
- Increase squats to 15 reps

EOF
```

**2. Coach: Calculate content hash and sync to server**

```bash
# Compute SHA256 hash of program.md
CONTENT_HASH=$(sha256sum customers/test-alice/program.md | awk '{print $1}')
echo "Content hash: $CONTENT_HASH"

# Read file content
CONTENT=$(cat customers/test-alice/program.md)

# POST to sync endpoint
curl -X POST http://localhost:5173/api/sync/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"test-alice\",
    \"file_type\": \"program\",
    \"current_version\": 0,
    \"content\": $(echo "$CONTENT" | jq -Rs '.'),
    \"content_hash\": \"$CONTENT_HASH\",
    \"offline_queue\": []
  }"
```

**Expected Response**:
```json
{
  "status": "synced",
  "customer_id": "test-alice",
  "file_type": "program",
  "new_version": 1,
  "server_version": 1,
  "last_sync_timestamp": "2026-09-16T10:30:00Z",
  "message": "Sync successful"
}
```

**3. Customer: Fetch program via UI API**

```bash
# Customer (UI) fetches latest program
curl http://localhost:5173/api/customers/test-alice \
  -H "Accept: application/json"
```

**Expected Response**: Program.md content is in response, version = 1

**Verification**:
- [ ] POST /api/sync/upload returns 201 Created
- [ ] Version incremented to 1
- [ ] GET /api/customers/test-alice returns latest program content
- [ ] Response time: < 5 seconds (SC-001)

---

## Scenario 2: Customer Submits Feedback & Coach Sees It

**Goal**: Verify P1 requirement - Customer provides feedback via UI, coach sees it locally within 30 seconds.

### Test Steps

**1. Customer: Submit feedback via UI API**

```bash
# Customer submits feedback
curl -X POST http://localhost:5173/api/customers/test-alice/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-09-16",
    "label": "Monday Workout",
    "fields": {
      "felt": "energized",
      "completed": true,
      "difficulty": "moderate",
      "notes": "Felt strong, could probably increase reps"
    }
  }'
```

**Expected Response**:
```json
{
  "id": 1,
  "date": "2026-09-16",
  "label": "Monday Workout",
  "felt": "energized",
  "completed": true,
  "difficulty": "moderate",
  "notes": "Felt strong, could probably increase reps"
}
```

**2. Coach: Download latest feedback**

```bash
# Coach queries feedback (simulating Claude Code reading feedback.md)
curl "http://localhost:5173/api/sync/download?customer_id=test-alice&file_type=feedback" \
  -H "Accept: application/json"
```

**Expected Response**: Includes feedback entry from step 1

**3. Coach: Verify feedback in local feedback.md**

```bash
# Coach reads local feedback.md (which should now include server feedback)
cat customers/test-alice/feedback.md
```

**Expected Content**: Entry for "2026-09-16 Monday Workout" with sentiment "energized"

**Verification**:
- [ ] POST /api/customers/{id}/feedback returns 201 Created
- [ ] GET /api/sync/download returns feedback entry
- [ ] Feedback entry appears in feedback.md
- [ ] Response time: < 30 seconds (SC-002)

---

## Scenario 3: Bi-Directional Sync Consistency

**Goal**: Verify P2 requirement - Coach and customer changes both persist without loss.

### Test Steps

**1. Coach: Sync program update**

```bash
# Coach updates program (week 2 progression details)
cat > customers/test-alice/program.md <<'EOF'
# Test Alice's Week 1-2 Program (Updated)

## Goal
Build a consistent workout habit

## Week 1 Schedule
[... existing content ...]

## Week 2 Progression
- Upper body: Increase all reps by 2
- Lower body: 15 reps on squats
- Add 1 extra cardio session (Sunday, 15 min light walk)

EOF

# Sync to server
CONTENT_HASH=$(sha256sum customers/test-alice/program.md | awk '{print $1}')
CONTENT=$(cat customers/test-alice/program.md)

curl -X POST http://localhost:5173/api/sync/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"test-alice\",
    \"file_type\": \"program\",
    \"current_version\": 1,
    \"content\": $(echo "$CONTENT" | jq -Rs '.'),
    \"content_hash\": \"$CONTENT_HASH\",
    \"offline_queue\": []
  }"
```

**Expected**: 201 Created, new_version = 2

**2. Customer: Submit feedback (simultaneous, within 1 second)**

```bash
# Customer submits feedback for week 2 (happens at nearly the same time)
curl -X POST http://localhost:5173/api/customers/test-alice/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-09-16",
    "label": "Week 2 Monday",
    "fields": {
      "felt": "stronger",
      "completed": true,
      "difficulty": "moderate",
      "notes": "New exercises feel good"
    }
  }'
```

**Possible Response A** (coach sync succeeded first):
```json
{
  "id": 2,
  "date": "2026-09-16",
  "label": "Week 2 Monday",
  [... feedback details ...]
}
```
Status: 201 Created ✓

**Possible Response B** (simultaneous conflict, customer feedback rejected):
```json
{
  "status": "conflict",
  "conflict_type": "customer_feedback_simultaneous",
  "new_version": 2,
  "message": "Program was updated by coach; please review and retry feedback"
}
```
Status: 409 Conflict

**3. Verification**

If Response A (feedback accepted):
```bash
# Both sync succeeded; verify both are visible
curl http://localhost:5173/api/customers/test-alice | jq '.program.version, .feedback.entries[-1].label'
# Expected: version = 2, last feedback = "Week 2 Monday"
```

If Response B (feedback rejected):
```bash
# Coach update succeeded, customer retries feedback
curl -X POST http://localhost:5173/api/customers/test-alice/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-09-16",
    "label": "Week 2 Monday (Retry)",
    [... same fields ...]
  }'

# Should succeed now
# Verify both are visible
curl http://localhost:5173/api/customers/test-alice | jq '.program.version, .feedback.entries[-1].label'
# Expected: version = 2, last feedback = "Week 2 Monday (Retry)"
```

**Verification**:
- [ ] Coach sync returns 201 with new_version = 2
- [ ] Feedback either succeeds (201) or is rejected with 409 (recoverable)
- [ ] No data loss: if feedback rejected, customer can retry
- [ ] Final state: both program update and feedback are visible
- [ ] SC-003 (99.9% consistency): All changes persist

---

## Scenario 4: Offline Coach Workflow

**Goal**: Verify FR-006 requirement - Coach works offline, syncs on reconnect.

### Test Steps

**1. Coach: Simulate offline (stop network)**

```bash
# Simulate disconnecting (in real scenario, coach has no wifi/internet)
# For testing, we'll just queue changes without syncing
```

**2. Coach: Make offline edits**

```bash
# Coach edits notes.md while offline
cat > customers/test-alice/notes.md <<'EOF'
## Coach Notes - Week 2 Review

- Customer progressing well, feeling stronger
- Form looks good on squats
- Suggestion: Add mobility work 2x per week
- Consider increasing cardio to 30 min once consistency established

## Adjustments for Week 3
- Add 10 min yoga/mobility session Tuesday and Thursday
- Progress upper body to 12 reps if feeling good

EOF

# Offline queue created locally (not yet synced)
# Would appear as: 
# {offline_queue: [{sequence: 1, timestamp: ..., file_type: 'notes', content: ...}]}
```

**3. Coach: Reconnect and sync**

```bash
# Coach reconnects (wifi available)
# System detects connectivity, initiates flush

CONTENT_HASH=$(sha256sum customers/test-alice/notes.md | awk '{print $1}')
CONTENT=$(cat customers/test-alice/notes.md)

curl -X POST http://localhost:5173/api/sync/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"test-alice\",
    \"file_type\": \"notes\",
    \"current_version\": 1,
    \"content\": $(echo "$CONTENT" | jq -Rs '.'),
    \"content_hash\": \"$CONTENT_HASH\",
    \"offline_queue\": []
  }"
```

**Expected Response**:
```json
{
  "status": "synced",
  "customer_id": "test-alice",
  "file_type": "notes",
  "new_version": 2,
  "message": "Sync successful"
}
```

**Verification**:
- [ ] Offline edits queued successfully
- [ ] sync_status = 'pending' while offline
- [ ] Sync succeeds on reconnect (201 Created)
- [ ] sync_status = 'synced' after upload
- [ ] offline_queue cleared
- [ ] SC-004 (100% successful sync on reconnect): All queued changes synced

---

## Scenario 5: Conflict Resolution (Coach Wins)

**Goal**: Verify FR-007 requirement - Coach changes take precedence.

### Test Steps

**1. Initialize: Coach has program version 2**

```bash
# Current state: version 2
curl "http://localhost:5173/api/sync/status?customer_id=test-alice" | jq '.files.program.current_version'
# Expected: 2
```

**2. Simulate server advance: Another sync updates program**

```bash
# Simulate external update (another coach or admin)
# For testing, directly update version in sync_metadata
# Or: Coach makes edit via different session
# Result: Server version = 3

# Coach in session 1 still thinks version = 2
# Coach makes edit based on old information
cat > customers/test-alice/program.md <<'EOF'
# Test Alice's Week 3 Program (Session 1 Edit)

## Updated based on Week 2 feedback
[... content reflecting Week 2 changes ...]
EOF
```

**3. Coach: Attempt sync with stale version**

```bash
CONTENT_HASH=$(sha256sum customers/test-alice/program.md | awk '{print $1}')
CONTENT=$(cat customers/test-alice/program.md)

# Coach sends current_version = 2 (stale; server is at 3)
curl -X POST http://localhost:5173/api/sync/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"test-alice\",
    \"file_type\": \"program\",
    \"current_version\": 2,
    \"content\": $(echo "$CONTENT" | jq -Rs '.'),
    \"content_hash\": \"$CONTENT_HASH\",
    \"offline_queue\": []
  }"
```

**Expected Response** (Coach-Always-Wins applied):
```json
{
  "status": "synced",
  "customer_id": "test-alice",
  "file_type": "program",
  "coach_version": 2,
  "server_version": 3,
  "new_version": 4,
  "message": "Sync successful",
  "conflict_resolved": true
}
```

**Verification**:
- [ ] POST succeeds despite version mismatch (201 Created, not 409)
- [ ] Coach's content applied (version incremented to 4)
- [ ] Conflict logged for audit
- [ ] No data loss: Coach's changes preserved
- [ ] FR-007: Coach-always-wins rule enforced
- [ ] SC-007 (< 2 min resolution): Automatic, instant

---

## Scenario 6: Sync Status Check

**Goal**: Verify sync health monitoring.

### Test Steps

**1. Check overall sync status**

```bash
curl http://localhost:5173/api/sync/status?customer_id=test-alice \
  -H "Accept: application/json"
```

**Expected Response**:
```json
{
  "customer_id": "test-alice",
  "files": {
    "program": {
      "status": "synced",
      "current_version": 4,
      "last_sync_timestamp": "2026-09-16T10:45:00Z"
    },
    "feedback": {
      "status": "synced",
      "entry_count": 2,
      "last_entry_timestamp": "2026-09-16T10:40:00Z"
    },
    "notes": {
      "status": "synced",
      "current_version": 2,
      "last_sync_timestamp": "2026-09-16T10:35:00Z"
    }
  },
  "overall_status": "synced",
  "message": "All files in sync"
}
```

**Verification**:
- [ ] Status returns correct versions for all files
- [ ] All files show "synced" status
- [ ] Timestamps are recent (within test run)
- [ ] Entry count matches actual feedback entries

---

## Validation Checklist

After running all scenarios:

### Performance (SC-001, SC-002, SC-006)
- [ ] Coach upload sync completes in < 5 seconds
- [ ] Customer feedback appears on coach side in < 30 seconds
- [ ] System handles 10+ feedback submissions without delay (can be tested with load test)

### Data Consistency (SC-003)
- [ ] No feedback entries lost during sync
- [ ] No program updates lost
- [ ] No data corruption (hashes verified)

### Offline Support (SC-004)
- [ ] Coach can edit offline without errors
- [ ] All queued changes sync when reconnected
- [ ] 100% of offline edits transferred (none lost)

### User Clarity (SC-005)
- [ ] UI displays current version number
- [ ] Coach sees timestamp of last sync
- [ ] Customer sees program version they're viewing

### Conflict Resolution (SC-007)
- [ ] Conflicts resolved automatically within 2 minutes
- [ ] Coach changes always win (test via scenario 5)
- [ ] Clear messaging to user on retry

---

## Debugging

### View Sync Metadata

```bash
# Query SQLite directly
sqlite3 app/server/data/sync-state.db \
  "SELECT customer_id, file_type, current_version, sync_status, last_sync_timestamp FROM sync_metadata WHERE customer_id = 'test-alice';"
```

### View Sync Log (Audit Trail)

```bash
sqlite3 app/server/data/sync-state.db \
  "SELECT timestamp, customer_id, file_type, event_type, conflict_description FROM sync_log WHERE customer_id = 'test-alice' ORDER BY timestamp DESC LIMIT 10;"
```

### Check Offline Queue

```bash
sqlite3 app/server/data/sync-state.db \
  "SELECT offline_queue FROM sync_metadata WHERE customer_id = 'test-alice' AND file_type = 'program';"
```

---

## Notes

- All URLs assume dev server running on `http://localhost:5173`
- Timestamps should be in UTC ISO8601 format
- Content hashes are SHA256 (lowercase hex)
- Test customer can be deleted with: `rm -rf customers/test-alice/`
