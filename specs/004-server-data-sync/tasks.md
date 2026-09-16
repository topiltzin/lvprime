# Tasks: Server-Based Data Sync

**Input**: Design documents from `/specs/004-server-data-sync/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Technology Stack**: Node.js 22.5.0+, JavaScript (ES modules), SQLite, Vite, Custom HTTP server

**Tests**: Optional - included per spec validation scenarios (quickstart.md)

**Organization**: Tasks grouped by user story for independent implementation and testing.

---

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3)
- **File paths**: Relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database setup

- [x] T001 Create `app/server/sync-engine.js` with module exports (stub functions for sync coordination)
- [x] T002 Create `app/server/sync-state.js` with SQLite sync state management (connect to sync-state.db)
- [x] T003 Create `app/server/offline-queue.js` with queue persistence and retrieval functions
- [x] T004 Initialize `app/server/data/sync-state.db` SQLite database with schema:
  - `sync_metadata` table: `id, customer_id, file_type, last_sync_timestamp, current_version, last_writer, sync_status, last_content_hash, offline_queue, created_at, updated_at`
  - `sync_log` table: `id, timestamp, customer_id, file_type, event_type, source, version_from, version_to, conflict_description, error_message, content_hash`
  - Indexes on `sync_status`, `customer_id`, `timestamp` per data-model.md
- [x] T005 [P] Create `app/server/hash-utils.js` with SHA256 content hash computation function
- [x] T006 [P] Update `app/server/index.js` to import new sync modules (no functional changes yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core sync infrastructure that enables all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Implement sync state schema validation in `app/server/sync-state.js`:
  - Verify sync_metadata table exists and is queryable ✓
  - Provide functions: `getSyncState(customer_id, file_type)`, `initializeSyncState(customer_id, file_type)` ✓
  - All queries logged for audit (FR-010) ✓
- [x] T008 [P] Implement sync metadata table operations in `app/server/sync-state.js` ✓
  - `updateSyncStatus(customer_id, file_type, status)` - Update status (synced, pending, conflicted)
  - `recordSyncEvent(customer_id, file_type, event_type, metadata)` - Log sync events
  - `getLastSyncTimestamp(customer_id, file_type)` - Retrieve last sync time
  - `incrementVersion(customer_id, file_type)` - Atomically increment version counter
- [x] T009 [P] Implement offline queue operations in `app/server/offline-queue.js` ✓
  - `queueChange(customer_id, entry)` - Add entry to offline queue, enforce validation per offline-queue.md (sequence continuity, timestamp format, file_type check)
  - `getQueue(customer_id)` - Retrieve entire queue
  - `clearQueue(customer_id)` - Clear after successful sync
  - Queue entries must have: sequence, timestamp, file_type, action, content_hash, content_size_bytes, description
- [x] T010 [P] Implement conflict detection in `app/server/sync-engine.js` ✓
- [x] T011 [P] Implement conflict resolution in `app/server/sync-engine.js` ✓
- [x] T012 [P] Add content hash utilities in `app/server/hash-utils.js` ✓
- [x] T013 [P] Implement sync endpoints skeleton in `app/server/index.js` ✓
- [x] T014 Add comprehensive logging to sync layer in `app/server/sync-state.js` ✓
- [x] T015 Add error handling middleware for sync endpoints in `app/server/index.js` ✓

**Checkpoint**: Foundation complete - user story implementation can begin

---

## Phase 3: User Story 1 - Coach Creates Program Locally (Priority: P1) 🎯 MVP

**Goal**: Coach can save program.md locally and it syncs to server within 5 seconds (SC-001)

**Independent Test**: 
- Coach creates/edits program.md in customers/{customer-name}/program.md
- Call POST /api/sync/upload with program content, hash, version
- Verify response: 201 Created, new_version incremented, last_sync_timestamp updated
- GET /api/customers/{customer-name} returns latest program content
- Timing < 5 seconds

### Contract Tests for User Story 1 ⚠️

- [x] T016 [P] [US1] Create `tests/contract/test_sync_upload_program.js` ✓
- [x] T017 [P] [US1] Create `tests/contract/test_sync_status.js` ✓

### Implementation for User Story 1

- [x] T018 [US1] Implement POST /api/sync/upload handler in `app/server/index.js` ✓
- [x] T019 [US1] Implement GET /api/sync/download handler in `app/server/index.js` ✓
- [x] T020 [US1] Implement GET /api/sync/status handler in `app/server/index.js` ✓
- [x] T021 [US1] Add sync event logging to POST /api/sync/upload ✓

**Checkpoint**: User Story 1 complete - coach can sync programs to server

---

## Phase 4: User Story 2 - Customer Provides Feedback via UI (Priority: P1)

**Goal**: Customer can submit feedback via UI and coach sees it locally within 30 seconds (SC-002)

**Independent Test**:
- Customer POSTs feedback to /api/customers/{customer-name}/feedback (existing endpoint, no changes needed)
- Feedback entry appended to customers/{customer-name}/feedback.md
- Coach calls GET /api/sync/download?customer_id=X&file_type=feedback
- Response includes latest feedback entry with correct formatting (date, label, fields, impression)
- Timing < 30 seconds

### Contract Tests for User Story 2 ⚠️

- [ ] T022 [P] [US2] Create `tests/contract/test_sync_download_feedback.js`:
  - Test: GET /api/sync/download?customer_id=X&file_type=feedback returns latest entries
  - Expected: current_version incremented, content includes feedback markdown entries
  - Test: Feedback chronological ordering (all entries date-sorted)
  - Test: Consistent formatting (dates YYYY-MM-DD, all required fields present)
  - All scenarios from sync-protocol.md
- [ ] T023 [P] [US2] Create `tests/contract/test_feedback_sync_state.js`:
  - Test: Feedback sync_metadata initialized when first feedback submitted
  - Test: Feedback version incremented on each new entry
  - Test: GET /api/sync/status shows feedback entry count and last entry timestamp

### Implementation for User Story 2

- [ ] T024 [US2] Update feedback submission in existing `/api/customers/{id}/feedback` endpoint in `app/server/index.js`:
  - After appending feedback entry to feedback.md:
    * Call `getSyncState(customer_id, 'feedback')` to check if sync_metadata row exists
    * If not exists: Call `initializeSyncState(customer_id, 'feedback')` with version=0, status='synced'
    * Call `incrementVersion(customer_id, 'feedback')` to advance version
    * Compute content_hash of updated feedback.md (entire file)
    * Call `recordSyncEvent('sync_success', ..., event_type='sync_success')` with new version
    * Update sync_metadata: last_sync_timestamp=now(), last_writer='customer', sync_status='synced'
  - This ensures coach can query feedback via sync download (no schema changes to feedback, just sync tracking)
- [ ] T025 [US2] Ensure GET /api/sync/download returns feedback in correct markdown format:
  - Read customers/{customer_id}/feedback.md
  - Verify format matches Lili Trainer spec (date YYYY-MM-DD, consistent field structure)
  - Return content as-is (preserve all fields per FR-008)
  - Update sync_metadata: current_version matches actual file
- [ ] T026 [US2] Add feedback sync logging:
  - When feedback submitted, log sync event: 'sync_success', customer='feedback', version_from→version_to
  - Verify feedback.md content_hash matches downloaded version (integrity check)
  - All logged to sync_log table

**Checkpoint**: User Stories 1 AND 2 complete - programs sync to server, feedback syncs to coach

---

## Phase 5: User Story 3 - Bi-Directional Sync & Conflict Resolution (Priority: P2)

**Goal**: Coach and customer changes don't conflict; offline coach workflow supported (SC-003, SC-004, SC-007)

**Independent Test**:
- Coach edits program.md locally (simulating offline or low connectivity)
- Queue change in offline_queue with: sequence=1, timestamp, file_type='program', content_hash, content_size_bytes
- Call POST /api/sync/upload with offline_queue populated
- Server processes queue, detects conflict if needed, applies coach-always-wins rule
- Verify: all queued changes applied, offline_queue cleared, sync_status='synced'
- Verify: customer feedback simultaneously submitted either succeeds or fails gracefully (409 with retry option)

### Contract Tests for User Story 3 ⚠️

- [ ] T027 [P] [US3] Create `tests/contract/test_offline_queue.js`:
  - Test: Offline queue entry structure (sequence, timestamp, file_type, content_hash, content_size_bytes)
  - Test: Queue entry validation (sequence continuity 1,2,3..., valid timestamp, file_type check)
  - Test: Reject invalid entries (sequence gaps, empty content, invalid hash format)
  - Test: Persist and retrieve queue (queueChange → getQueue returns all entries)
- [ ] T028 [P] [US3] Create `tests/contract/test_conflict_resolution.js`:
  - Test: Coach version mismatch handling - coach version 2, server version 4 → coach wins (201 Created, new_version=5)
  - Test: Feedback conflict - customer feedback rejected (409) when program version mismatch
  - Test: Conflict logging - conflict recorded in sync_log with full details
  - Test: Offline queue flush on reconnect - all queue entries processed in order
- [ ] T029 [P] [US3] Create `tests/contract/test_concurrent_sync.js`:
  - Test: Simultaneous coach upload + customer feedback
  - Scenario A: Coach upload succeeds first → customer feedback rejected (409), customer can retry
  - Scenario B: Customer feedback succeeds first → coach upload succeeds, increments version from latest
  - Both scenarios: No data loss, both changes eventually visible

### Implementation for User Story 3

- [ ] T030 [US3] Implement offline queue population in sync client/coach workflow:
  - When coach edits program.md/notes.md locally without connectivity:
    * Read file content
    * Compute SHA256 hash
    * Create queue entry: {sequence=N, timestamp=now(), file_type='program'/'notes', action='write', content_hash, content_size_bytes, description='local edit'}
    * Call `queueChange(customer_id, entry)` in `app/server/offline-queue.js`
    * Update sync_metadata: sync_status='pending', offline_queue populated
  - Note: This logic lives in a sync client (could be server-side for coaches, or client-side for UI)
  - For MVP: Implement in server as part of POST /api/sync/upload handler
- [ ] T031 [US3] Enhance POST /api/sync/upload to process offline_queue:
  - If offline_queue provided in request (populated during disconnected period):
    * Iterate through queue entries in sequence order
    * For each entry: Validate hash, verify content_size_bytes matches (sanity check)
    * On validation error: Pause flush, return 422, keep queue in storage
    * On success: Merge all queue entries into single file content, write to file system, increment version once for entire batch
    * Clear offline_queue on success
    * Log each queue entry flush event
  - If offline_queue empty (normal online sync):
    * Process single upload as before (T018-T021)
- [ ] T032 [US3] Implement coach-always-wins conflict resolution in POST /api/sync/upload:
  - Detect: coach_version < server_version (coach has stale version)
  - Resolve: Accept coach's content anyway, increment server_version, set new_version = server_version + 1
  - Log conflict: recordSyncEvent('sync_conflict', ..., conflict_description='Coach version {coach_version}, server version {server_version}, coach changes applied')
  - Return 201 Created (not 409) with new_version per conflict-resolution.md
  - This ensures coach's offline work is never lost
- [ ] T033 [US3] Implement feedback conflict rejection in existing /api/customers/{id}/feedback endpoint:
  - Before appending feedback, query sync_metadata for program current_version
  - Compare to customer's program_version_seen (passed in feedback submission request or extracted from headers)
  - If program_version_seen < current_program_version: Conflict detected (concurrent coach edit)
  - Reject feedback: Return 409 with message 'Program was updated by coach. Please review and resubmit feedback.' per conflict-resolution.md
  - Do NOT create feedback entry
  - Do NOT update sync_metadata (feedback sync state unchanged)
  - Log: recordSyncEvent('sync_conflict', event_type='sync_conflict', conflict_description='Feedback rejected: customer saw program version {customer_version}, current is {server_version}')
  - Customer can immediately retry (will succeed after reading new program)
- [ ] T034 [US3] Implement sync conflict detection in POST /api/sync/upload:
  - Call `detectVersionMismatch(coach_version, server_version)` from sync-engine.js
  - If true: Log with full details, but continue (coach wins per FR-007)
  - If conflict is with simultaneous feedback: Coach update succeeds, any concurrent feedback is rejected by T033
- [ ] T035 [US3] Add validation for format consistency through sync (Principle I, FR-008):
  - All file content must preserve:
    * Date format YYYY-MM-DD (validate on sync write)
    * Markdown structure (no reformatting)
    * UTF-8 encoding
  - If format validation fails: Log warning, but still write (don't reject valid coach work)
  - Hash verification (T012) catches corruption; format check is defensive

**Checkpoint**: All user stories complete - system is conflict-free, offline-capable, and consistent

---

## Phase 6: Integration & Validation

**Purpose**: Prove all scenarios work end-to-end per quickstart.md

- [ ] T036 [P] Run Scenario 1 from quickstart.md: Coach Creates Program & Customer Sees It
  - Create customers/test-alice/ with program.md
  - POST /api/sync/upload with program content
  - GET /api/customers/test-alice → verify latest program returned
  - Timing check: < 5 seconds (SC-001)
  - PASS: Response 201, program visible on UI
- [ ] T037 [P] Run Scenario 2 from quickstart.md: Customer Submits Feedback & Coach Sees It
  - POST /api/customers/test-alice/feedback with form data
  - GET /api/sync/download?customer_id=test-alice&file_type=feedback
  - Verify feedback entry in response, chronologically ordered
  - Timing check: < 30 seconds (SC-002)
  - PASS: Feedback appears in coach download
- [ ] T038 [P] Run Scenario 3 from quickstart.md: Bi-Directional Sync Consistency
  - Coach POST sync update
  - Simultaneously customer POST feedback (within 1 second)
  - Verify: Coach update succeeds (201), customer feedback either succeeds or is rejected (409) with retry message
  - No data loss: Either feedback succeeds immediately or customer can retry after seeing updated program
  - PASS: No conflicts observed, or conflicts properly logged and recovered
- [ ] T039 [P] Run Scenario 4 from quickstart.md: Offline Coach Workflow
  - Queue local edits to program.md with offline_queue: [{seq:1, timestamp, content_hash, ...}]
  - Simulate reconnection, POST /api/sync/upload with offline_queue
  - Verify: sync succeeds (201), offline_queue cleared, sync_status='synced'
  - PASS: 100% of offline edits synced (SC-004)
- [ ] T040 [P] Run Scenario 5 from quickstart.md: Conflict Resolution (Coach Wins)
  - Coach has program version 2, server has version 3 (concurrent edit)
  - Coach uploads with version=2 (stale)
  - Verify: Sync succeeds (201), new_version=4 (server won't reject, coach changes applied)
  - Conflict logged with full details
  - PASS: Coach-always-wins rule enforced (FR-007, SC-007)
- [ ] T041 [P] Run Scenario 6 from quickstart.md: Sync Status Check
  - GET /api/sync/status?customer_id=test-alice
  - Verify: All files reported with current versions, sync_status, timestamps
  - PASS: Status endpoint returns accurate information for monitoring
- [ ] T042 [US3] Verify 99.9% data consistency (SC-003):
  - Query sync_log for all sync events
  - Verify: No 'sync_error' events (or < 0.1% of attempts)
  - Verify: All 'sync_success' events have matching file content (hash stored)
  - Verify: Conflict events logged but resolved (no orphaned conflicts)
  - PASS: Data consistency maintained across all scenarios
- [ ] T043 [US3] Performance validation (SC-001, SC-002, SC-006):
  - Measure: Program sync latency (upload → server → customer retrieval) < 5s
  - Measure: Feedback sync latency (customer submit → coach download) < 30s
  - Load test: 10+ simultaneous customers submitting feedback
  - Verify: No service degradation under load
  - PASS: All timing targets met

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and hardening

- [ ] T044 [P] Add comprehensive error handling and validation:
  - Validate all request bodies (customer_id, file_type, content, content_hash format)
  - Reject oversized files (set limit per deployment, default 50MB)
  - Reject invalid UTF-8 content
  - Return meaningful error messages per sync-protocol.md
  - Test: All 422/409/404/401/403 responses covered
- [ ] T045 [P] Add audit trail completeness:
  - Verify sync_log table captures all sync events (start, success, conflict, error)
  - Verify each log entry has: timestamp, customer_id, file_type, event_type, versions, hash
  - Verify offline_queue changes are logged (for debugging disconnected workflows)
  - Spot-check: Query sync_log for test customer, verify 6+ events from integration tests
- [ ] T046 [P] Documentation:
  - Update README.md with sync architecture overview
  - Document sync endpoints in API docs (or comments in app/server/index.js)
  - Document conflict resolution behavior for coaches (when/why feedback is rejected)
  - Add troubleshooting guide for common sync issues
- [ ] T047 [P] Code quality:
  - Ensure all new files have JSDoc comments on public functions
  - Verify test coverage: All sync endpoints tested (contract tests pass)
  - Lint: Run linter on new sync modules (app/server/sync-*.js)
  - No hardcoded values (all config from environment or constants)
- [ ] T048 Final cleanup:
  - Delete test customer directory (customers/test-alice/)
  - Remove any debug console.logs
  - Verify all TODOs/FIXMEs resolved
  - Commit: "Complete server-based data sync implementation"

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: No dependencies - START HERE
2. **Foundational (Phase 2)**: Depends on Setup - MUST complete before user stories
3. **User Story 1 (Phase 3)**: Depends on Foundational - Begin after Phase 2
4. **User Story 2 (Phase 4)**: Depends on Foundational - Can run parallel with US1, but US1 should complete first (US1 is MVP)
5. **User Story 3 (Phase 5)**: Depends on Foundational + US1 + US2 - Begin after both stories working
6. **Integration (Phase 6)**: Depends on all user stories - Begin after Phase 5
7. **Polish (Phase 7)**: Depends on Integration - Final pass

### User Story Dependencies

- **US1 (Coach Local Sync)**: No dependency on other stories - Independent
- **US2 (Customer Feedback)**: No dependency on US1 - Independent (but US1 is MVP priority)
- **US3 (Conflict Resolution)**: Depends on US1 + US2 existing - Requires both sync paths working to test conflicts

### Within Each User Story

- Tests (if included) MUST pass BEFORE implementation
- Models before services before endpoints
- Core functionality before edge cases
- Story complete and validated before moving to next priority

### Parallel Opportunities

**Within Setup Phase**:
- T002, T003, T005, T006 can run in parallel (marked [P])

**Within Foundational Phase**:
- T008, T009, T010, T011, T012 can run in parallel (marked [P])

**Across User Stories (After Foundational)**:
- Once Foundational complete:
  - Developer A: US1 (T016-T021)
  - Developer B: US2 (T022-T026)
  - Both can work independently
  - US3 (T027-T035) starts after both US1 and US2 are testable

**Within Each Story's Tests**:
- T016 + T017 (US1 tests) can run in parallel
- T022 + T023 (US2 tests) can run in parallel
- T027 + T028 + T029 (US3 tests) can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Complete Phase 1: Setup (T001-T006)
2. ✅ Complete Phase 2: Foundational (T007-T015)
3. ✅ Complete Phase 3: US1 (T016-T021)
4. **STOP and VALIDATE**: Run Scenario 1 from quickstart.md
5. Deploy MVP: Coach can sync programs to server (< 5s latency)
6. **Decision**: Launch with MVP or add US2?

### Incremental Delivery (Add US2, Then US3)

7. Complete Phase 4: US2 (T022-T026)
8. **VALIDATE**: Run Scenario 2 (Coach sees feedback < 30s)
9. Deploy: Now coaches and customers can share programs and feedback
10. Complete Phase 5: US3 (T027-T035)
11. **VALIDATE**: Run Scenarios 3, 4, 5, 6 (conflicts, offline, sync status)
12. Deploy: Full bi-directional sync with conflict resolution

### Parallel Team Strategy

With 2-3 developers:
- **Dev 1**: Phases 1-2 (Setup + Foundational) - blocking work
- **Dev 1 + Dev 2**: Phase 3 (US1) - US1 is MVP
- Once US1 working:
  - **Dev 2**: Phase 4 (US2) in parallel
  - **Dev 3** (if available): Phase 5 (US3)
- **All**: Phase 6 (Integration) and Phase 7 (Polish)

---

## Testing Strategy

**Contract Tests** (included):
- T016-T017 (US1): Verify sync upload/download/status endpoints
- T022-T023 (US2): Verify feedback sync and status
- T027-T029 (US3): Verify offline queue, conflict detection, concurrent sync

**Integration Tests** (Phase 6):
- T036-T043: Run all 6 quickstart.md scenarios end-to-end
- Validate performance targets (SC-001, SC-002, SC-006)
- Validate data consistency (SC-003)
- Validate offline support (SC-004)

**No Unit Tests Required** for this feature (per specification - quickstart.md provides validation).

---

## Task Checklist Summary

- **Total Tasks**: 48
- **Setup**: 6
- **Foundational**: 9
- **US1 (P1)**: 8 (including tests)
- **US2 (P1)**: 5 (including tests)
- **US3 (P2)**: 10 (including tests)
- **Integration**: 8
- **Polish**: 5

**MVP Scope** (Recommended first release):
- Complete Setup + Foundational + US1
- Deploy when Scenario 1 passes (coach can sync programs < 5s)
- Estimated: 23 tasks (T001-T021)

**Next Increment**:
- Add US2 (customer feedback)
- Deploy when Scenario 2 passes
- Estimated: +5 tasks (T022-T026)

**Final Release**:
- Add US3 (conflict resolution, offline support)
- Add Integration + Polish
- Deploy when all 6 quickstart scenarios pass
- Estimated: +18 tasks (T027-T048)

---

## Notes

- All file paths are repository-relative (e.g., `app/server/sync-engine.js`)
- Each task is independently completable; follow dependencies for logical grouping
- Tests are contract tests (verify API contracts match spec), not unit tests
- No migration needed; sync_metadata is side-by-side with existing index.sqlite
- Preserve existing /api/customers/* endpoints; only add new /api/sync/* endpoints
- Constitution principles preserved throughout (FR-008, FR-010 logging, verify-before-save in conflict detection)
