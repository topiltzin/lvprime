# Tasks: Customer Data Storage Migration for Vercel Deployment

**Input**: Design documents from `/specs/006-customer-data-storage/`

**Prerequisites**: plan.md (✅ complete), spec.md (✅ complete), data-model.md (✅ complete), contracts/ (✅ complete), research.md (✅ complete), quickstart.md (✅ complete)

**Tests**: Validation scenarios provided in quickstart.md; unit/integration test tasks included in Polish phase

**Organization**: Tasks are grouped by user story (US1-US4, all Priority P1) to enable independent implementation and testing

**Tech Stack**: JavaScript/Node.js, Vite, Vue 3, Supabase PostgreSQL, `@supabase/supabase-js`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Supabase project provisioning

- [X] T001 Create Supabase project (or use existing) and record project URL + service role key
- [X] T002 Install `@supabase/supabase-js` dependency in `app/package.json`
- [X] T003 [P] Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` placeholders to `app/.env.example`
- [X] T004 [P] Verify `.env.local` is excluded via `app/.gitignore` (never commit real credentials)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, client setup, and DAL scaffolding that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Execute the "Full Schema SQL" block from `specs/006-customer-data-storage/contracts/database-schema.md` in Supabase SQL Editor to create all 7 tables (`customers`, `programs`, `feedbacks`, `notes`, `nutrition_plans`, `sync_events`, `offline_queue_entries`) with their indexes, foreign keys, and CHECK constraints
- [X] T006 Run the verification query from `contracts/database-schema.md` and confirm all 7 tables exist via Supabase dashboard
- [X] T007 Create Supabase client initialization in `app/server/lib/database-client.js` exporting `supabase` client built from `process.env.SUPABASE_URL` and `process.env.SUPABASE_SECRET_KEY` (per contracts/data-api-layer.md)
- [X] T008 [P] Create custom error classes `CustomerNotFoundError`, `ValidationError`, `DatabaseError` in `app/server/lib/customer-data.js` (per contracts/data-api-layer.md error handling section)
- [X] T009 [P] Add slug validation helper in `app/server/lib/customer-data.js` enforcing regex `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, 3-100 characters (per contracts/database-schema.md customers table constraints)

**Checkpoint**: Database schema live, client connects, error classes and validation helpers ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Migrate Existing Customer Data to Database (Priority: P1) 🎯 MVP

**Goal**: Migrate all existing customer data from `/customers/[name]/*.md` files into Supabase with zero data loss

**Independent Test**: Run the migration script against the existing `customers/` directory; verify each customer's `program.md`, `feedback.md`, `notes.md`, `nutrition_plan.md` content is retrievable from the database with identical content

### Implementation for User Story 1

- [ ] T010 [US1] Create migration script skeleton in `app/server/migrations/migrate-data.js` that scans the `customers/` directory for subdirectories
- [ ] T011 [US1] Implement customer record creation in `migrate-data.js`: insert into `customers` table with `slug` (directory name), `name` (derived from slug, title-cased)
- [ ] T012 [US1] Implement `program.md` migration in `migrate-data.js`: read file content and insert into `programs` table (`customer_id`, `content` as TEXT); skip if `content` exceeds 500KB and log a warning (per data-model.md Program validation rules: "content MUST NOT exceed 500KB")
- [ ] T013 [US1] Implement `notes.md` migration in `migrate-data.js`: read file content and insert into `notes` table (`customer_id`, `content` as TEXT); enforce same 500KB limit as T012
- [ ] T014 [US1] Implement `nutrition_plan.md` migration in `migrate-data.js`: read file content (skip customers without this file) and insert into `nutrition_plans` table (`customer_id`, `content` as TEXT); enforce the 100KB limit (per specs/005-nutrition-plan-tab FR-008, not the 500KB used for programs/notes)
- [ ] T015 [US1] Implement `feedback.md` migration in `migrate-data.js`: read the raw file content as-is (no parsing/reshaping) and insert into `feedbacks` table as `content` TEXT (per corrected data-model.md Feedback entity — freeform per-customer template, not a fixed JSONB shape); default to `content: ''` if no file exists
- [ ] T016 [US1] Verify migrated feedback content round-trips through `parseFeedbackEntries`/`extractFeedbackTemplate` (from `markdown-parser.js`) in `migrate-data.js`'s post-migration check: run both functions against each migrated customer's `feedbacks.content` and confirm entry count matches `parseFeedbackEntries` run against the original file (sanity check only — these are pure functions with no filesystem dependency, so behavior is identical against DB-sourced text)
- [ ] T017 [US1] Add post-migration verification step in `migrate-data.js`: compare row counts (`customers`, `programs`, `notes`, `nutrition_plans`, `feedbacks`) against the number of source files/directories and print a summary report
- [ ] T018 [US1] Add backup safeguard in `migrate-data.js`: refuse to run if target Supabase tables already contain rows for a customer slug (idempotency guard), to avoid duplicate migration
- [ ] T019 [US1] Run `node server/migrations/migrate-data.js` against the real `customers/` directory (including `jaqueline-orellano`) and confirm the summary report shows zero errors and matching row counts

**Checkpoint**: All existing customer data now exists in Supabase; filesystem data remains untouched as backup

---

## Phase 4: User Story 2 - Read Customer Data from Database in App (Priority: P1)

**Goal**: Application reads all customer data (program, feedback, notes, nutrition plan) from Supabase instead of the filesystem, with zero visible change to the coach

**Independent Test**: Open a customer profile in the app; verify all four tabs (Program, Nutrition Plan, Feedback, Notes) display content sourced from the database (confirm via Supabase query matching what's on screen)

### Implementation for User Story 2

- [X] T020 [P] [US2] Implement `getCustomer(slug)` in `app/server/lib/customer-data.js`: query `customers` table by `slug`, throw `CustomerNotFoundError` if no row found (per contracts/data-api-layer.md)
- [X] T021 [P] [US2] Implement `getCustomerProgram(slug)` in `app/server/lib/customer-data.js`: resolve customer via `getCustomer`, query `programs` table by `customer_id`, return `null` if no row exists (per contracts/data-api-layer.md)
- [X] T022 [P] [US2] Implement `getCustomerFeedback(slug)` in `app/server/lib/customer-data.js`: resolve customer via `getCustomer`, query `feedbacks` table by `customer_id` for `content`, then derive `entries` via `parseFeedbackEntries(content)` and `template` via `extractFeedbackTemplate(content)` (both imported unchanged from `../markdown-parser.js`); return `{ content: '', entries: [], template: <fallback>, updatedAt: null }` if no row exists (per corrected contracts/data-api-layer.md — REDO: previous implementation used the wrong fixed-JSONB schema, see data-model.md "Schema revision" note)
- [X] T023 [P] [US2] Implement `getCustomerNotes(slug)` in `app/server/lib/customer-data.js`: resolve customer via `getCustomer`, query `notes` table by `customer_id`, return `null` if no row exists (per contracts/data-api-layer.md)
- [X] T024 [P] [US2] Implement `getCustomerNutritionPlan(slug)` in `app/server/lib/customer-data.js`: resolve customer via `getCustomer`, query `nutrition_plans` table by `customer_id`, return `null` if no row exists (per contracts/data-api-layer.md)
- [ ] T025 [US2] Modify `handleGetCustomer` and `handleGetCustomers` in `app/server/index.js` to replace `listCustomers`/`reindexIfStale`/`fs.readFileSync` calls with `getCustomer`, `getCustomerProgram`, `getCustomerFeedback`, `getCustomerNotes`, `getCustomerNutritionPlan` from `customer-data.js`, preserving the existing response shapes (`toCustomerSummary`, the `{ slug, displayName, program, notes, nutrition, feedback, attachments }` object)
- [ ] T026 [US2] Modify `handleGetNutrition` in `app/server/index.js` (`GET /api/customers/:slug/nutrition`) to use `getCustomerNutritionPlan` instead of `fs.readFileSync`/`fs.existsSync` on `nutrition_plan.md`, preserving the existing response shape `{ content, isEmpty, lastModified }` and the 413 "file too large" behavior (now enforced via the 500KB check in `getCustomerNutritionPlan`)
- [ ] T027 [US2] Update `app/src/views/customer-view.js` if response shapes from `serve.js` changed, ensuring `data.program`, `data.feedback`, `data.notes`, `data.nutrition` are populated identically to the pre-migration format
- [ ] T028 [US2] Verify `app/src/components/tab-container.js` renders Program, Nutrition Plan, Feedback, and Notes tabs unchanged (no code changes expected here unless data shape changed in T027)
- [ ] T029 [US2] Manually test in browser: load `jaqueline-orellano` profile and confirm all four tabs show content matching the pre-migration filesystem files

**Checkpoint**: Coach can view all customer data with the app fully backed by Supabase reads

---

## Phase 5: User Story 3 - Write Customer Data Updates to Database (Priority: P1)

**Goal**: Coach can add feedback entries and update notes/program/nutrition plan content, with changes persisted to Supabase

**Independent Test**: Add a new feedback entry via the UI, reload the page, and confirm the entry persists and is retrieved from the database

### Implementation for User Story 3

- [X] T030 [P] [US3] Implement `addFeedbackEntry(slug, displayName, { date, label, fields })` in `app/server/lib/customer-data.js`: mirror `feedback-writer.js`'s `appendFeedbackEntry` exactly — read current `feedbacks.content`, derive `template` via `extractFeedbackTemplate`, format via `formatFeedbackEntry(template, {date, label, fieldValues: fields})`, append (writing the `# {displayName} - Feedback & Progress Log` header if this is the first entry), upsert `feedbacks.content`, return the newly parsed entry via `parseFeedbackEntries` (per corrected contracts/data-api-layer.md — REDO: previous implementation used the wrong fixed-schema `entry` object and strict enum, see data-model.md "Schema revision" note)
- [X] T031 [P] [US3] Implement `updateCustomerNotes(slug, content)` in `app/server/lib/customer-data.js`: validate `content` is non-empty and does not exceed 500KB (per data-model.md Notes validation: "content MUST NOT exceed 500KB"), throwing `ValidationError` otherwise; upsert the `notes` row for the customer
- [X] T032 [P] [US3] Implement `updateCustomerProgram(slug, content)` in `app/server/lib/customer-data.js`: validate `content` is non-empty and does not exceed 500KB (per data-model.md Program validation), throwing `ValidationError` otherwise; upsert the `programs` row for the customer
- [X] T033 [P] [US3] Implement `updateCustomerNutritionPlan(slug, content)` in `app/server/lib/customer-data.js`: validate `content` is non-empty and does not exceed 100KB (per data-model.md NutritionPlan validation / specs/005-nutrition-plan-tab FR-008), throwing `ValidationError` otherwise; upsert the `nutrition_plans` row for the customer
- [ ] T034 [US3] Modify `handlePostFeedback` and `handleGetCustomer` in `app/server/index.js`: get the template via `(await getCustomerFeedback(slug)).template` instead of `getFeedbackTemplate(slug)` (which does `fs.readFileSync`), keep calling `validateFeedbackSubmission(template, body)` unchanged (pure function, no fs dependency), then call `addFeedbackEntry` from `customer-data.js` instead of `appendFeedbackEntry` (from `feedback-writer.js`) — same response shape (`toFeedbackEntryJson`)
- [ ] T035 [US3] Wire the existing feedback submission form (in `app/src/components/feedback-entry.js` or equivalent) to call the new feedback POST endpoint instead of any prior filesystem-backed endpoint
- [ ] T036 [US3] Manually test in browser: submit a new feedback entry for `jaqueline-orellano`, reload the page, and confirm the entry appears and is present in the `feedbacks.entries` JSONB column in Supabase

**Checkpoint**: Coaches can both read and write customer data through Supabase with validation enforced

---

## Phase 6: Sync System Migration (Absorbs specs/004-server-data-sync into Supabase)

**Goal**: Replace `server/sync-state.js`'s JSON-file-backed, in-memory store and `server/offline-queue.js`'s file-embedded queue with the `programs`/`notes` version columns plus the new `sync_events` and `offline_queue_entries` tables — required because the JSON file (`server/data/sync-state.json`) does not survive Vercel's stateless serverless functions any more than the customer `.md` files do

**Independent Test**: Submit a coach sync upload for `program` with a stale `current_version`; confirm the response reports `conflicted: true`, the `programs` row's `version` increments by exactly 1, and a `sync_conflict` row appears in `sync_events`

### Implementation for Sync Migration

- [X] T037 Implement `syncCoachWrite(slug, fileType, { currentVersion, content, contentHash })` in `app/server/lib/customer-data.js` per contracts/data-api-layer.md: verify `contentHash` via `hash-utils.js` `verifyContentHash`, detect conflict via version comparison, write to `programs`/`notes` row (`content`, `version = serverVersion + 1`, `content_hash`, `last_writer: 'coach'`, `sync_status: 'synced'`), and insert a `sync_events` row — smoke-tested against live Supabase: fresh write, no-conflict write, and stale-version write all produced correct `version`/`conflicted` results
- [X] T038 Implement `getSyncState(slug, fileType)` in `app/server/lib/customer-data.js`: query `programs` or `notes` by `customer_id` and return `{ version, syncStatus, lastWriter, contentHash, updatedAt }`, or `null` if no row exists
- [X] T039 [P] Implement `queueOfflineChange(slug, fileType, entry)` in `app/server/lib/customer-data.js`: validate `fileType` is `'program'` or `'notes'`, `sequence` starts at 1 and increments without gaps per (customer, fileType) — replicate the exact error messages from `offline-queue.js` ("Sequence gap: expected N+1, got X", "First sequence must be 1, got X"), `content_hash` matches `^[a-f0-9]{64}$`, `content_size_bytes > 0`, `timestamp` is valid ISO8601; insert into `offline_queue_entries` and set the corresponding row's `sync_status = 'pending'` — smoke-tested: sequence gap correctly rejected
- [X] T040 [P] Implement `getOfflineQueue(slug, fileType)` and `clearOfflineQueue(slug, fileType)` in `app/server/lib/customer-data.js` per contracts/data-api-layer.md
- [X] T041 [P] Implement `recordSyncEvent(slug, fileType, eventType, metadata)` and `getRecentSyncEvents(slug, limit)` in `app/server/lib/customer-data.js` per contracts/data-api-layer.md
- [ ] T042 Modify `handleSyncUpload` in `app/server/index.js` to call `syncCoachWrite` instead of `fs.writeFileSync` + `syncState.updateSyncMetadata`; keep the existing request/response JSON shape unchanged so `app/src/lib/status.js` and any client callers don't need changes
- [ ] T043 Modify `handleSyncDownload` in `app/server/index.js` to read content via `getCustomerProgram`/`getCustomerNotes` (T021/existing) and version/hash via `getSyncState` instead of `fs.readFileSync` + `syncState.getSyncState`
- [ ] T044 Modify `handleSyncStatus` in `app/server/index.js` to call `getSyncState` for `program`/`notes` and `getCustomerFeedback` (for entry count) instead of `syncState.getSyncState` + `fs.readFileSync`
- [ ] T045 Retire `server/sync-state.js` and `server/offline-queue.js`'s file-backed implementations once T042-T044 are verified working (keep `sync-engine.js`'s pure functions `detectVersionMismatch`/`resolveCoachSync`/`resolveFeedbackConflict` — those have no filesystem dependency and can stay as-is or be inlined into `customer-data.js`)
- [ ] T046 Manually test: submit two sequential `POST /api/sync/upload` calls for the same customer/program with the second using a stale `current_version`; confirm `conflicted: true` in the response and a matching `sync_conflict` row in the `sync_events` table

**Checkpoint**: The existing Coach Local Sync feature (specs/004-server-data-sync) now runs entirely on Supabase and survives Vercel cold starts and redeployments

---

## Phase 7: User Story 4 - Ensure Vercel Compatibility & Persistence (Priority: P1)

**Goal**: Verify customer data persists across Vercel deployments, cold starts, and serverless function invocations

**Independent Test**: Deploy the app to a Vercel preview environment, confirm data loads correctly, trigger a redeploy, and confirm the same data is still accessible afterward

### Implementation for User Story 4

- [ ] T047 [US4] Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the Vercel project's Environment Variables (Production and Preview scopes)
- [ ] T048 [US4] Add graceful error handling in `app/server/lib/customer-data.js` for Supabase connection failures: catch errors from the client and re-throw as `DatabaseError` with a user-friendly message (per contracts/data-api-layer.md)
- [ ] T049 [US4] Surface `DatabaseError` in `app/src/views/customer-view.js` / `app/src/components/tab-container.js` as a toast message ("Unable to load customer data. Please try again.") instead of an unhandled exception
- [ ] T050 [US4] Deploy the app to a Vercel preview environment and verify `jaqueline-orellano` profile loads all four tabs correctly from Supabase
- [ ] T051 [US4] Trigger a redeploy on Vercel (e.g., empty commit or redeploy button) and re-verify the same customer data still loads correctly with no data loss (per quickstart.md Scenario 5)
- [ ] T052 [US4] Measure and record customer data load time on the Vercel preview deployment, confirming it meets the <500ms target (per spec SC-004)

**Checkpoint**: App is verified to work correctly when deployed on Vercel with persistent Supabase-backed storage

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Testing, validation, and cleanup affecting all user stories

- [ ] T053 [P] Add unit tests for `customer-data.js` DAL functions (mocking the Supabase client) in `app/tests/unit/database.test.js`, including `syncCoachWrite` conflict detection
- [ ] T054 [P] Add integration tests against a Supabase test project in `app/tests/integration/customer-data.test.js` covering `getCustomer`, `addFeedbackEntry`, `updateCustomerNotes`, and `syncCoachWrite`
- [ ] T055 [P] Add data integrity validation test comparing filesystem source files to migrated database rows (per quickstart.md Scenario 8)
- [ ] T056 Run the full `quickstart.md` validation suite (Scenarios 1-8) end-to-end and record results
- [ ] T057 Remove or comment out now-unused filesystem read/write code paths in `app/server/index.js`, `app/server/customers-repo.js`, `app/server/feedback-writer.js`, `app/server/sync-state.js`, and `app/server/offline-queue.js` once migration is verified stable
- [ ] T058 [P] Document Supabase environment variable setup and migration steps for future deployments in `app/README.md` or `CLAUDE.md`
- [ ] T059 Retain the `customers/` filesystem directory as a 30-day backup (per spec Assumption 7); add a dated reminder/note for its eventual removal

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only - can start immediately after Phase 2
- **User Story 2 (Phase 4)**: Depends on Foundational; DAL read functions (T020-T024) can be built in parallel with US1, but full independent testing (T029) requires migrated data from US1
- **User Story 3 (Phase 5)**: Depends on Foundational; DAL write functions (T030-T033) can be built in parallel with US1/US2, but full independent testing (T036) benefits from US2's read path to verify persistence
- **Sync System Migration (Phase 6)**: Depends on Foundational (needs `programs`/`notes` version columns and `sync_events`/`offline_queue_entries` tables from T005); can proceed in parallel with US1-US3 since it touches different functions, but T042-T044 modify `server/index.js` handlers that are separate from the US2/US3 GET/POST handlers
- **User Story 4 (Phase 7)**: Depends on US1, US2, US3, AND Phase 6 all being functionally complete (needs the full read/write/sync surface working to validate against a live Vercel deployment)
- **Polish (Phase 8)**: Depends on all prior phases being complete

### User Story Dependencies

- **US1** (Migration): No dependencies on other stories - foundational data must exist before US2/US3 can be meaningfully validated
- **US2** (Read): DAL functions independent of US1/US3 code, but validation requires migrated data (US1)
- **US3** (Write): DAL functions independent of US1/US2 code, but validation benefits from US2's read functions to confirm writes
- **Sync Migration**: Independent of US1/US2/US3 DAL functions (different tables/columns), but shares `app/server/lib/customer-data.js` as a file, so coordinate merges
- **US4** (Vercel/Persistence): Integration validation story - depends on US1 + US2 + US3 + Sync Migration all being functional

### Within Each User Story

- US1: T010 → T011 → T012/T013/T014/T015 (can proceed in sequence per file) → T016 → T017 → T018 → T019
- US2: T020-T024 can run in parallel [P] (different functions, same file but independent logic) → T025 → T026 → T027 → T028 → T029
- US3: T030-T033 can run in parallel [P] → T034 → T035 → T036
- Sync Migration: T037 → T038 → T039/T040/T041 (can proceed in parallel [P]) → T042 → T043 → T044 → T045 → T046
- US4: T047 → T048 → T049 → T050 → T051 → T052

### Parallel Opportunities

```bash
# Phase 1 Setup — parallel:
Task: "Add SUPABASE_URL and SUPABASE_SECRET_KEY placeholders to app/.env.example"
Task: "Verify .env.local is excluded via app/.gitignore"

# Phase 2 Foundational — parallel after T007:
Task: "Create custom error classes in app/server/lib/customer-data.js"
Task: "Add slug validation helper in app/server/lib/customer-data.js"

# Phase 4 US2 — parallel DAL functions:
Task: "Implement getCustomer(slug) in app/server/lib/customer-data.js"
Task: "Implement getCustomerProgram(slug) in app/server/lib/customer-data.js"
Task: "Implement getCustomerFeedback(slug) in app/server/lib/customer-data.js"
Task: "Implement getCustomerNotes(slug) in app/server/lib/customer-data.js"
Task: "Implement getCustomerNutritionPlan(slug) in app/server/lib/customer-data.js"

# Phase 5 US3 — parallel DAL functions:
Task: "Implement addFeedbackEntry(slug, entry) in app/server/lib/customer-data.js"
Task: "Implement updateCustomerNotes(slug, content) in app/server/lib/customer-data.js"
Task: "Implement updateCustomerProgram(slug, content) in app/server/lib/customer-data.js"
Task: "Implement updateCustomerNutritionPlan(slug, content) in app/server/lib/customer-data.js"

# Phase 6 Sync Migration — parallel:
Task: "Implement queueOfflineChange(slug, fileType, entry) in app/server/lib/customer-data.js"
Task: "Implement getOfflineQueue/clearOfflineQueue in app/server/lib/customer-data.js"
Task: "Implement recordSyncEvent/getRecentSyncEvents in app/server/lib/customer-data.js"

# Phase 8 Polish — parallel:
Task: "Add unit tests in app/tests/unit/database.test.js"
Task: "Add integration tests in app/tests/integration/customer-data.test.js"
Task: "Add data integrity validation test"
Task: "Document Supabase environment variable setup"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) ⏱️ 2-3 hours

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T009) — CRITICAL, blocks everything
3. Complete Phase 3: User Story 1 (T010-T019)
4. **STOP and VALIDATE**: Confirm migrated data matches filesystem source exactly
5. This alone proves the data model and schema are sound before building read/write paths

### Incremental Delivery ⏱️ 14-20 hours total

1. Setup + Foundational → schema and client ready
2. US1 (Migration) → Test independently → all data in Supabase ✓
3. US2 (Read) → Test independently → app displays DB-backed data ✓
4. US3 (Write) → Test independently → feedback/notes/program writes persist ✓
5. Sync Migration → Test independently → coach sync survives Vercel cold starts ✓
6. US4 (Vercel/Persistence) → Test independently → verified on real Vercel deployment ✓
7. Polish (tests, cleanup, docs) → Merge ✓

### Parallel Team Strategy (2-3 developers)

- Developer A: Phase 1 + Phase 2 (Setup + Foundational) — must finish first
- Once Foundational is done:
  - Developer A: US1 (Migration, T010-T019)
  - Developer B: US2 (Read DAL + endpoints, T020-T029) — can build against schema immediately, validate fully once US1 lands
  - Developer C: US3 (Write DAL + endpoints, T030-T036) — same pattern as US2
- Once US1-US3 land: Developer A or B takes Sync Migration (T037-T046) — touches `customer-data.js` and `server/index.js`, coordinate merges with US2/US3 authors
- All: US4 (Vercel validation, T047-T052) once Sync Migration merged
- All: Polish phase (T053-T059) split across team

---

## Commit Strategy

Suggest committing after each phase's validation checkpoint:

```bash
git commit -m "feat(customer-data): create Supabase schema and DAL scaffolding [Foundational]"
git commit -m "feat(customer-data): migrate filesystem data to Supabase [US1]"
git commit -m "feat(customer-data): read customer data from Supabase in app [US2]"
git commit -m "feat(customer-data): write feedback/notes/program updates to Supabase [US3]"
git commit -m "feat(customer-data): migrate coach sync system onto Supabase [Sync Migration]"
git commit -m "test(customer-data): verify Vercel deployment persistence [US4]"
git commit -m "polish(customer-data): tests, cleanup, and documentation"
```

---

## File Summary

**Files to Create**:
- `app/server/lib/database-client.js` — Supabase client initialization
- `app/server/lib/customer-data.js` — Data access layer (all CRUD + sync/offline-queue functions + error classes)
- `app/server/migrations/migrate-data.js` — One-time filesystem → Supabase migration script
- `app/tests/unit/database.test.js` — Unit tests for DAL
- `app/tests/integration/customer-data.test.js` — Integration tests against Supabase

**Files to Modify**:
- `app/package.json` — Add `@supabase/supabase-js` dependency
- `app/.env.example` — Add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- `app/server/index.js` — Replace filesystem/SQLite reads and file writes in `handleGetCustomer`, `handleGetCustomers`, `handleGetNutrition`, `handlePostFeedback`, `handleSyncUpload`, `handleSyncDownload`, `handleSyncStatus` with `customer-data.js` DAL calls
- `app/server/sync-state.js` — Superseded by `sync_events`/`offline_queue_entries` + `programs`/`notes` columns; retire per T057
- `app/server/offline-queue.js` — Superseded by `offline_queue_entries` table; retire per T057
- `app/server/customers-repo.js` / `app/server/db.js` — SQLite index cache becomes unnecessary once Supabase is the read path (evaluate for removal in T057; not a hard requirement since it's harmless as a cache)

**Files NOT to Modify** (ensures zero regression):
- `app/src/components/nutrition-pdf.js` — PDF export unchanged
- `app/src/components/program-pdf.js` — PDF export unchanged
- `app/server/sync-engine.js` — Pure functions (`detectVersionMismatch`, `resolveCoachSync`, etc.) have no filesystem dependency; reused as-is by `syncCoachWrite`
- `app/vite.config.js` — No build config changes needed

**Files Preserved as Backup** (not deleted):
- `customers/[customer-name]/*.md` — Retained 30 days per spec Assumption 7

---

## Notes

- [P] tasks = can run in parallel (different functions/files, no interdependencies)
- [Story] label (US1, US2, US3, US4) maps task to specific user story for traceability; Foundational/Sync Migration/Polish tasks carry no story label
- All 4 user stories are Priority P1 — sequence reflects natural build order (migrate → read → write → sync → verify persistence), not relative importance
- The Sync Migration phase exists because `server/sync-state.js` currently persists to a local JSON file (`server/data/sync-state.json`) and an in-memory object — neither survives Vercel's stateless serverless functions, so this phase is required for true Vercel compatibility, not optional cleanup
- Constraint values (500KB limits, date formats, enum values, slug regex, sequence/hash rules) are quoted directly from data-model.md and contracts/database-schema.md so they aren't left to implementation-time guessing
- Commit after each phase's validation checkpoint
- Stop at any checkpoint to validate independently before proceeding

---

**Total Task Count**: 59 tasks
**Estimated Effort**: 14-20 hours (sequential) / 7-10 hours (parallel team of 2-3)
**Status**: Blocked on Supabase project credentials (T001) — see conversation for setup instructions; all design docs ready
**Next**: User creates Supabase project + runs schema SQL from contracts/database-schema.md, provides `SUPABASE_URL`/`SUPABASE_SECRET_KEY` via `app/.env.local`, then begin Phase 1 (Setup) and Phase 2 (Foundational)

---

**Last Updated**: 2026-09-17
**Feature Branch**: `006-customer-data-storage`
