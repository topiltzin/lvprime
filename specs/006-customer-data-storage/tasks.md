# Tasks: Customer Data Storage Migration for Vercel Deployment

**Input**: Design documents from `/specs/006-customer-data-storage/`

**Prerequisites**: plan.md (✅ complete), spec.md (✅ complete), data-model.md (✅ complete), contracts/ (✅ complete), research.md (✅ complete), quickstart.md (✅ complete)

**Tests**: Validation scenarios provided in quickstart.md; unit/integration test tasks included in Polish phase

**Organization**: Tasks are grouped by user story (US1-US4, all Priority P1) to enable independent implementation and testing

**Tech Stack**: JavaScript/Node.js, Vite, Vue 3, Supabase PostgreSQL, `@supabase/supabase-js`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Supabase project provisioning

- [ ] T001 Create Supabase project (or use existing) and record project URL + service role key
- [ ] T002 Install `@supabase/supabase-js` dependency in `app/package.json`
- [ ] T003 [P] Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` placeholders to `app/.env.example`
- [ ] T004 [P] Verify `.env.local` is excluded via `app/.gitignore` (never commit real credentials)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, client setup, and DAL scaffolding that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Execute PostgreSQL DDL from `specs/006-customer-data-storage/contracts/database-schema.md` in Supabase SQL Editor to create `customers`, `programs`, `feedbacks`, `notes`, `nutrition_plans` tables with their indexes and foreign keys
- [ ] T006 Verify all 5 tables and their indexes (`idx_customers_slug`, `idx_programs_customer_id`, `idx_feedbacks_customer_id`, `idx_notes_customer_id`, `idx_nutrition_plans_customer_id`) exist via Supabase dashboard
- [ ] T007 Create Supabase client initialization in `app/src/lib/database-client.js` exporting `supabase` client built from `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY` (per contracts/data-api-layer.md)
- [ ] T008 [P] Create custom error classes `CustomerNotFoundError`, `ValidationError`, `DatabaseError` in `app/src/lib/customer-data.js` (per contracts/data-api-layer.md error handling section)
- [ ] T009 [P] Add slug validation helper in `app/src/lib/customer-data.js` enforcing regex `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, 3-100 characters (per contracts/database-schema.md customers table constraints)

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
- [ ] T014 [US1] Implement `nutrition_plan.md` migration in `migrate-data.js`: read file content (skip customers without this file) and insert into `nutrition_plans` table (`customer_id`, `content` as TEXT); enforce same 500KB limit
- [ ] T015 [US1] Implement `feedback.md` migration in `migrate-data.js`: parse each dated entry into the JSONB entries schema `{date, week, how_customer_felt, completed, notes, overall_impression}` (per data-model.md Feedback entries schema) and insert as a single row into `feedbacks` table with `entries` as a JSONB array; default to `entries: []` if no file exists (per contracts/database-schema.md feedbacks default `'[]'::jsonb`)
- [ ] T016 [US1] Validate parsed feedback entries in `migrate-data.js` against required schema: each entry must have `date` in `YYYY-MM-DD` format and `overall_impression` one of `Easy`, `Moderate`, `Hard` (per data-model.md Feedback validation rules); log and skip malformed entries rather than failing the whole migration
- [ ] T017 [US1] Add post-migration verification step in `migrate-data.js`: compare row counts (`customers`, `programs`, `notes`, `nutrition_plans`, `feedbacks`) against the number of source files/directories and print a summary report
- [ ] T018 [US1] Add backup safeguard in `migrate-data.js`: refuse to run if target Supabase tables already contain rows for a customer slug (idempotency guard), to avoid duplicate migration
- [ ] T019 [US1] Run `node server/migrations/migrate-data.js` against the real `customers/` directory (including `jaqueline-orellano`) and confirm the summary report shows zero errors and matching row counts

**Checkpoint**: All existing customer data now exists in Supabase; filesystem data remains untouched as backup

---

## Phase 4: User Story 2 - Read Customer Data from Database in App (Priority: P1)

**Goal**: Application reads all customer data (program, feedback, notes, nutrition plan) from Supabase instead of the filesystem, with zero visible change to the coach

**Independent Test**: Open a customer profile in the app; verify all four tabs (Program, Nutrition Plan, Feedback, Notes) display content sourced from the database (confirm via Supabase query matching what's on screen)

### Implementation for User Story 2

- [ ] T020 [P] [US2] Implement `getCustomer(slug)` in `app/src/lib/customer-data.js`: query `customers` table by `slug`, throw `CustomerNotFoundError` if no row found (per contracts/data-api-layer.md)
- [ ] T021 [P] [US2] Implement `getCustomerProgram(slug)` in `app/src/lib/customer-data.js`: resolve customer via `getCustomer`, query `programs` table by `customer_id`, return `null` if no row exists (per contracts/data-api-layer.md)
- [ ] T022 [P] [US2] Implement `getCustomerFeedback(slug)` in `app/src/lib/customer-data.js`: resolve customer via `getCustomer`, query `feedbacks` table by `customer_id`, return `{ entries: [] }` if no row exists (per contracts/data-api-layer.md)
- [ ] T023 [P] [US2] Implement `getCustomerNotes(slug)` in `app/src/lib/customer-data.js`: resolve customer via `getCustomer`, query `notes` table by `customer_id`, return `null` if no row exists (per contracts/data-api-layer.md)
- [ ] T024 [P] [US2] Implement `getCustomerNutritionPlan(slug)` in `app/src/lib/customer-data.js`: resolve customer via `getCustomer`, query `nutrition_plans` table by `customer_id`, return `null` if no row exists (per contracts/data-api-layer.md)
- [ ] T025 [US2] Modify `app/server/serve.js` to replace filesystem reads in the customer data GET endpoint(s) with calls to `getCustomer`, `getCustomerProgram`, `getCustomerFeedback`, `getCustomerNotes`, `getCustomerNutritionPlan` from `customer-data.js`
- [ ] T026 [US2] Modify `app/server/serve.js` nutrition endpoint (`GET /api/customer/:slug/nutrition`) to use `getCustomerNutritionPlan` instead of reading `nutrition_plan.md` from disk, preserving the existing response shape `{ content, isEmpty, lastModified }`
- [ ] T027 [US2] Update `app/src/views/customer-view.js` if response shapes from `serve.js` changed, ensuring `data.program`, `data.feedback`, `data.notes`, `data.nutrition` are populated identically to the pre-migration format
- [ ] T028 [US2] Verify `app/src/components/tab-container.js` renders Program, Nutrition Plan, Feedback, and Notes tabs unchanged (no code changes expected here unless data shape changed in T027)
- [ ] T029 [US2] Manually test in browser: load `jaqueline-orellano` profile and confirm all four tabs show content matching the pre-migration filesystem files

**Checkpoint**: Coach can view all customer data with the app fully backed by Supabase reads

---

## Phase 5: User Story 3 - Write Customer Data Updates to Database (Priority: P1)

**Goal**: Coach can add feedback entries and update notes/program/nutrition plan content, with changes persisted to Supabase

**Independent Test**: Add a new feedback entry via the UI, reload the page, and confirm the entry persists and is retrieved from the database

### Implementation for User Story 3

- [ ] T030 [P] [US3] Implement `addFeedbackEntry(slug, entry)` in `app/src/lib/customer-data.js`: validate `entry` has required fields `date` (YYYY-MM-DD), `week`, `how_customer_felt`, `completed` (boolean), `notes`, `overall_impression` (one of `Easy`, `Moderate`, `Hard`) throwing `ValidationError` on missing/invalid fields (per contracts/data-api-layer.md); append to existing `entries` JSONB array and update the `feedbacks` row (create the row first if none exists, per data-model.md default `'[]'::jsonb`)
- [ ] T031 [P] [US3] Implement `updateCustomerNotes(slug, content)` in `app/src/lib/customer-data.js`: validate `content` is non-empty and does not exceed 500KB (per data-model.md Notes validation: "content MUST NOT exceed 500KB"), throwing `ValidationError` otherwise; upsert the `notes` row for the customer
- [ ] T032 [P] [US3] Implement `updateCustomerProgram(slug, content)` in `app/src/lib/customer-data.js`: validate `content` is non-empty and does not exceed 500KB (per data-model.md Program validation), throwing `ValidationError` otherwise; upsert the `programs` row for the customer
- [ ] T033 [P] [US3] Implement `updateCustomerNutritionPlan(slug, content)` in `app/src/lib/customer-data.js`: validate `content` is non-empty and does not exceed 500KB (per data-model.md NutritionPlan validation), throwing `ValidationError` otherwise; upsert the `nutrition_plans` row for the customer
- [ ] T034 [US3] Add/update POST endpoint in `app/server/serve.js` for feedback submission (e.g., `POST /api/customer/:slug/feedback`) that calls `addFeedbackEntry` and returns the updated feedback list
- [ ] T035 [US3] Wire the existing feedback submission form (in `app/src/components/feedback-entry.js` or equivalent) to call the new feedback POST endpoint instead of any prior filesystem-backed endpoint
- [ ] T036 [US3] Manually test in browser: submit a new feedback entry for `jaqueline-orellano`, reload the page, and confirm the entry appears and is present in the `feedbacks.entries` JSONB column in Supabase

**Checkpoint**: Coaches can both read and write customer data through Supabase with validation enforced

---

## Phase 6: User Story 4 - Ensure Vercel Compatibility & Persistence (Priority: P1)

**Goal**: Verify customer data persists across Vercel deployments, cold starts, and serverless function invocations

**Independent Test**: Deploy the app to a Vercel preview environment, confirm data loads correctly, trigger a redeploy, and confirm the same data is still accessible afterward

### Implementation for User Story 4

- [ ] T037 [US4] Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Vercel project's Environment Variables (Production and Preview scopes)
- [ ] T038 [US4] Add graceful error handling in `app/src/lib/customer-data.js` for Supabase connection failures: catch errors from the client and re-throw as `DatabaseError` with a user-friendly message (per contracts/data-api-layer.md)
- [ ] T039 [US4] Surface `DatabaseError` in `app/src/views/customer-view.js` / `app/src/components/tab-container.js` as a toast message ("Unable to load customer data. Please try again.") instead of an unhandled exception
- [ ] T040 [US4] Deploy the app to a Vercel preview environment and verify `jaqueline-orellano` profile loads all four tabs correctly from Supabase
- [ ] T041 [US4] Trigger a redeploy on Vercel (e.g., empty commit or redeploy button) and re-verify the same customer data still loads correctly with no data loss (per quickstart.md Scenario 5)
- [ ] T042 [US4] Measure and record customer data load time on the Vercel preview deployment, confirming it meets the <500ms target (per spec SC-004)

**Checkpoint**: App is verified to work correctly when deployed on Vercel with persistent Supabase-backed storage

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Testing, validation, and cleanup affecting all user stories

- [ ] T043 [P] Add unit tests for `customer-data.js` DAL functions (mocking the Supabase client) in `app/tests/unit/database.test.js`
- [ ] T044 [P] Add integration tests against a Supabase test project in `app/tests/integration/customer-data.test.js` covering `getCustomer`, `addFeedbackEntry`, and `updateCustomerNotes`
- [ ] T045 [P] Add data integrity validation test comparing filesystem source files to migrated database rows (per quickstart.md Scenario 8)
- [ ] T046 Run the full `quickstart.md` validation suite (Scenarios 1-8) end-to-end and record results
- [ ] T047 Remove or comment out now-unused filesystem read/write code paths in `app/server/serve.js` once migration is verified stable
- [ ] T048 [P] Document Supabase environment variable setup and migration steps for future deployments in `app/README.md` or `CLAUDE.md`
- [ ] T049 Retain the `customers/` filesystem directory as a 30-day backup (per spec Assumption 7); add a dated reminder/note for its eventual removal

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only - can start immediately after Phase 2
- **User Story 2 (Phase 4)**: Depends on Foundational; DAL read functions (T020-T024) can be built in parallel with US1, but full independent testing (T029) requires migrated data from US1
- **User Story 3 (Phase 5)**: Depends on Foundational; DAL write functions (T030-T033) can be built in parallel with US1/US2, but full independent testing (T036) benefits from US2's read path to verify persistence
- **User Story 4 (Phase 6)**: Depends on US1, US2, and US3 being functionally complete (needs real read/write paths to validate against a live Vercel deployment)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1** (Migration): No dependencies on other stories - foundational data must exist before US2/US3 can be meaningfully validated
- **US2** (Read): DAL functions independent of US1/US3 code, but validation requires migrated data (US1)
- **US3** (Write): DAL functions independent of US1/US2 code, but validation benefits from US2's read functions to confirm writes
- **US4** (Vercel/Persistence): Integration validation story - depends on US1 + US2 + US3 all being functional

### Within Each User Story

- US1: T010 → T011 → T012/T013/T014/T015 (can proceed in sequence per file) → T016 → T017 → T018 → T019
- US2: T020-T024 can run in parallel [P] (different functions, same file but independent logic) → T025 → T026 → T027 → T028 → T029
- US3: T030-T033 can run in parallel [P] → T034 → T035 → T036
- US4: T037 → T038 → T039 → T040 → T041 → T042

### Parallel Opportunities

```bash
# Phase 1 Setup — parallel:
Task: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY placeholders to app/.env.example"
Task: "Verify .env.local is excluded via app/.gitignore"

# Phase 2 Foundational — parallel after T007:
Task: "Create custom error classes in app/src/lib/customer-data.js"
Task: "Add slug validation helper in app/src/lib/customer-data.js"

# Phase 4 US2 — parallel DAL functions:
Task: "Implement getCustomer(slug) in app/src/lib/customer-data.js"
Task: "Implement getCustomerProgram(slug) in app/src/lib/customer-data.js"
Task: "Implement getCustomerFeedback(slug) in app/src/lib/customer-data.js"
Task: "Implement getCustomerNotes(slug) in app/src/lib/customer-data.js"
Task: "Implement getCustomerNutritionPlan(slug) in app/src/lib/customer-data.js"

# Phase 5 US3 — parallel DAL functions:
Task: "Implement addFeedbackEntry(slug, entry) in app/src/lib/customer-data.js"
Task: "Implement updateCustomerNotes(slug, content) in app/src/lib/customer-data.js"
Task: "Implement updateCustomerProgram(slug, content) in app/src/lib/customer-data.js"
Task: "Implement updateCustomerNutritionPlan(slug, content) in app/src/lib/customer-data.js"

# Phase 7 Polish — parallel:
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

### Incremental Delivery ⏱️ 8-12 hours total

1. Setup + Foundational → schema and client ready
2. US1 (Migration) → Test independently → all data in Supabase ✓
3. US2 (Read) → Test independently → app displays DB-backed data ✓
4. US3 (Write) → Test independently → feedback/notes/program writes persist ✓
5. US4 (Vercel/Persistence) → Test independently → verified on real Vercel deployment ✓
6. Polish (tests, cleanup, docs) → Merge ✓

### Parallel Team Strategy (2-3 developers)

- Developer A: Phase 1 + Phase 2 (Setup + Foundational) — must finish first
- Once Foundational is done:
  - Developer A: US1 (Migration, T010-T019)
  - Developer B: US2 (Read DAL + endpoints, T020-T029) — can build against schema immediately, validate fully once US1 lands
  - Developer C: US3 (Write DAL + endpoints, T030-T036) — same pattern as US2
- All: US4 (Vercel validation) once US1-US3 merged
- All: Polish phase (T043-T049) split across team

---

## Commit Strategy

Suggest committing after each user story validation:

```bash
git commit -m "feat(customer-data): create Supabase schema and DAL scaffolding [Foundational]"
git commit -m "feat(customer-data): migrate filesystem data to Supabase [US1]"
git commit -m "feat(customer-data): read customer data from Supabase in app [US2]"
git commit -m "feat(customer-data): write feedback/notes/program updates to Supabase [US3]"
git commit -m "test(customer-data): verify Vercel deployment persistence [US4]"
git commit -m "polish(customer-data): tests, cleanup, and documentation"
```

---

## File Summary

**Files to Create**:
- `app/src/lib/database-client.js` — Supabase client initialization
- `app/src/lib/customer-data.js` — Data access layer (all CRUD functions + error classes)
- `app/server/migrations/migrate-data.js` — One-time filesystem → Supabase migration script
- `app/tests/unit/database.test.js` — Unit tests for DAL
- `app/tests/integration/customer-data.test.js` — Integration tests against Supabase

**Files to Modify**:
- `app/package.json` — Add `@supabase/supabase-js` dependency
- `app/.env.example` — Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/server/serve.js` — Replace filesystem reads/writes with DAL calls
- `app/src/views/customer-view.js` — Adjust data loading if response shape changes
- `app/src/components/tab-container.js` — Adjust rendering only if data shape changes
- `app/src/components/feedback-entry.js` (or equivalent) — Wire to new feedback write endpoint

**Files NOT to Modify** (ensures zero regression):
- `app/src/components/nutrition-pdf.js` — PDF export unchanged
- `app/src/components/program-pdf.js` — PDF export unchanged
- `app/vite.config.js` — No build config changes needed

**Files Preserved as Backup** (not deleted):
- `customers/[customer-name]/*.md` — Retained 30 days per spec Assumption 7

---

## Notes

- [P] tasks = can run in parallel (different functions/files, no interdependencies)
- [Story] label (US1, US2, US3, US4) maps task to specific user story for traceability
- All 4 user stories are Priority P1 — sequence reflects natural build order (migrate → read → write → verify persistence), not relative importance
- Constraint values (500KB limits, date formats, enum values, slug regex) are quoted directly from data-model.md and contracts/database-schema.md so they aren't left to implementation-time guessing
- Commit after each user story validation checkpoint
- Stop at any checkpoint to validate independently before proceeding

---

**Total Task Count**: 49 tasks
**Estimated Effort**: 8-12 hours (sequential) / 4-6 hours (parallel team of 2-3)
**Status**: Ready for implementation
**Next**: Begin with Phase 1 (Setup) and Phase 2 (Foundational)

---

**Last Updated**: 2026-09-17
**Feature Branch**: `006-customer-data-storage`
