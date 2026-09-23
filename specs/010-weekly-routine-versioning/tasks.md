---

description: "Task list for Independent Weekly Routines with History Tracking"
---

# Tasks: Independent Weekly Routines with History Tracking

**Input**: Design documents from `/specs/010-weekly-routine-versioning/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — this codebase has an established integration/unit test convention
(`app/tests/integration/*.test.js`, `app/tests/unit/*.test.js`, `node --test`) followed by every
prior feature (specs 006-009); this feature's own `plan.md` Project Structure names the exact
test files below.

**Organization**: Tasks are grouped by user story (spec.md: US1=P1, US2=P2, US3=P3) so each can be
implemented and independently tested.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1/US2/US3
- All paths are relative to the repo root; the app lives under `app/`

---

## Phase 1: Setup

**Purpose**: Prepare the database for multiple rows per customer before any application code changes.

- [ ] T001 *(SQL written to `app/server/migrations/010-weekly-routine-versioning.sql`, verifier at `…/010-weekly-routine-versioning.js`; pending: run the SQL in the Supabase SQL Editor)* Create and run a migration script `app/server/migrations/010-weekly-routine-versioning.js` (idempotent, following the existing `app/server/migrations/migrate-exercises.js` pattern — safe to re-run) that applies `specs/010-weekly-routine-versioning/contracts/database-schema-delta.md`'s SQL: on `programs`, drop `UNIQUE(customer_id)`, add `week_number INTEGER NOT NULL CHECK (week_number >= 1)` defaulting existing rows to `1` then drop the default, add `UNIQUE(customer_id, week_number)`; on `sync_events` and `offline_queue_entries`, add a nullable `week_number INTEGER` column. Run it against the dev Supabase project and confirm every pre-existing `programs` row now has `week_number = 1` with content unchanged (contract Acceptance Criteria).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared logic and schema every user story writes against. No user story task may start before this phase is complete.

**⚠️ CRITICAL**: This phase must fully land before Phase 3+.

- [X] T002 [P] Implement `app/server/lib/week-lock-rule.js` exporting: `deriveWeekState(weekNumbers)` → per `data-model.md`'s derived rule, returns each week's `isCurrent`/`isLocked` where `isCurrent ⟺ weekNumber === Math.max(...weekNumbers)`, exactly one `true` whenever `weekNumbers` is non-empty; and `validateNextWeekNumber(currentMaxWeek, requestedWeekNumber)` per `research.md` Decision 3 — valid only for `requestedWeekNumber === currentMaxWeek` (update current) or `=== currentMaxWeek + 1` (new week); anything lower throws a `WeekLockedError`, anything higher throws a `WeekNumberGapError` (both new error classes, same file), matching the exact `week_locked`/`week_number_gap` error shapes in `contracts/weekly-routine-api.md`.
- [X] T003 Unit tests in `app/tests/unit/week-lock-rule.test.js` for `week-lock-rule.js` (T002): single week → `isCurrent: true`, zero locked; three weeks → only the highest `isCurrent`, the other two `isLocked: true`; `validateNextWeekNumber(2, 2)` and `(2, 3)` succeed; `(2, 1)` throws `WeekLockedError`; `(2, 4)` throws `WeekNumberGapError`.
- [X] T004 [P] Retire the 4-slot progression-note mechanism in `app/server/markdown-parser.js` per `research.md` Decision 4: delete `parseWeeklyProgression` and the `weeklyProgression` field (`progressionHtml` intentionally kept — see research.md Decision 4 implementation note) from `parseProgramDetail`'s return value and the regex/matching code that builds them. Leave the day-heading `weeklySchedule` scanning logic itself untouched — it now always runs against one week's own content, so the duplicate-day-heading failure mode this feature replaces (seen against `customers/topiltzin-flores/program.md` earlier) cannot recur by construction.
- [X] T005 Extend `app/server/lib/customer-data.js` to be week-aware (depends on T001, T002):
  - `getCustomerProgram(slug, weekNumber = null)` — `weekNumber` omitted resolves to the customer's current (max `week_number`) row.
  - New `listCustomerProgramWeeks(slug)` — queries all `programs` rows for the customer, runs them through `deriveWeekState` (T002), returns `[{ weekNumber, isCurrent, isLocked, updatedAt }]` ordered ascending; returns `[]` for a customer with no program rows (not an error).
  - New `getCustomerProgramWeek(slug, weekNumber)` — full row for one `(slug, weekNumber)`; throws a new `WeekNotFoundError` if no such row exists.
  - `syncCoachWrite(slug, fileType, { weekNumber, currentVersion, content, contentHash })` — for `fileType === 'program'`, call `validateNextWeekNumber` (T002) against the customer's current max `week_number` **before** calling the existing `resolveCoachSync`; on `WeekLockedError`/`WeekNumberGapError`, propagate without writing (no `sync_events` success row); on success, upsert with `onConflict: 'customer_id,week_number'` instead of `'customer_id'`. Other `fileType` values (`notes`, `nutrition_plan`) keep today's single-row behavior unchanged.
  - `getSyncState(slug, fileType, weekNumber = null)` — same current-week default as `getCustomerProgram`.
  - `updateCustomerProgram(slug, content, weekNumber)` — align this existing direct-upsert helper with the same `(customer_id, week_number)` targeting and the same `validateNextWeekNumber` lock check as `syncCoachWrite`, so it cannot remain an unguarded second write path that bypasses FR-008's locking guarantee.
  - `getCustomerFullProfile(slug)` and `listAllCustomers()`'s `programGoal`/program queries — update every `programs` query in this file that currently assumes one row per customer to instead read the current (max `week_number`) row, since the new `UNIQUE(customer_id, week_number)` constraint means a plain `.maybeSingle()` against `customer_id` alone will start erroring once any customer has 2+ weeks.

**Checkpoint**: Schema supports multiple weeks per customer; the lock/gap rule is implemented, tested, and impossible to bypass through any existing write path; the parser no longer expects the retired progression-note shape; every other `programs` reader in `customer-data.js` is current-week-aware.

---

## Phase 3: User Story 1 - Give a customer a genuinely different routine for a new week (Priority: P1) 🎯 MVP

**Goal**: A coach can record a new week's routine that is entirely independent of the previous week's — creating it doesn't alter or merge with what came before.

**Independent Test**: Publish a distinctly different routine as a new week for a test customer, then confirm the previous week's routine is still returned, unchanged, when queried directly.

- [X] T006 [P] [US1] Integration test in `app/tests/integration/weekly-routine-lifecycle.test.js` (new file, disposable fixture customer per the `publish-cli.test.js` convention — namespaced slug, `t.after()` cleanup): publish week 1, then publish a distinctly different week 2 via `--new-week`; assert `GET /api/customers/:slug/program/weeks` returns both with week 1 `isLocked:true`/week 2 `isCurrent:true`, and `GET /api/customers/:slug/program/weeks/1` still returns week 1's original content byte-for-byte (quickstart.md Scenario 1).
- [X] T007 [US1] Add `GET /api/customers/:slug/program/weeks` route in `app/server/index.js` calling `listCustomerProgramWeeks` (T005); empty case returns `{ "weeks": [] }` with `200`, per `contracts/weekly-routine-api.md`.
- [X] T008 [US1] Add `GET /api/customers/:slug/program/weeks/:week` route in `app/server/index.js` calling `getCustomerProgramWeek` (T005); on `WeekNotFoundError`, respond `404`.
- [X] T009 [US1] Update `handleGetCustomer` (`GET /api/customers/:slug`) in `app/server/index.js`: `program` in the response becomes the current week's detail (via `getCustomerProgram(slug)` with no week argument), and the response gains a `programWeeks` array from `listCustomerProgramWeeks` (T005), per `contracts/weekly-routine-api.md`'s "Changed" section.
- [X] T010 [US1] Extend the `POST /api/sync/upload` handler in `app/server/index.js`: accept an optional `week_number` in the request body, pass it through to `syncCoachWrite` (T005); map a thrown `WeekLockedError` to `423` with body `{ "error": "week_locked", "weekNumber": <target>, "currentWeek": <max> }`, and `WeekNumberGapError` to `400` with body `{ "error": "week_number_gap", "expected": <max + 1> }`, per `contracts/weekly-routine-api.md`.
- [X] T011 [P] [US1] Add `--week <N>` and `--new-week` flags to `app/server/scripts/publish.js` for the `program` file type: no flag targets the current week (equivalent to the customer's max `week_number`); `--new-week` targets `current + 1`; `--week <N>` targets exactly `N`. Surface the exact failure text from `contracts/publish-cli.md` (`Publish failed: week <N> is locked (current week is <M>)...` / `...would leave a gap (next available is <N>)...`) with a non-zero exit, mirroring the existing `Publish failed: <message>` pattern. `notes`/`nutrition_plan` publishing is unaffected — no new flags accepted for those file types.
- [X] T012 [P] [US1] Update `app/src/components/week-subnav.js`: replace the hardcoded `WEEK_NUMBERS = [1, 2, 3, 4]` array with a `weeks` parameter (the `programWeeks` shape from T009 — `{weekNumber, isCurrent, isLocked}[]`), render one chip per entry in ascending order, and add a locked indicator (class/icon) on chips where `isLocked` is true, per `contracts/week-tab-navigation-v2.md`.

**Checkpoint**: User Story 1 is independently functional — a coach can create a genuinely different week 2 via the CLI, and both the new API and the updated chip list confirm week 1 is untouched.

---

## Phase 4: User Story 2 - Update the current week's training as the customer progresses (Priority: P2)

**Goal**: A coach can revise the routine the customer is actively following, in place, without affecting any other week.

**Independent Test**: Edit an already-published current week's routine (e.g. swap one exercise) and confirm the change is live immediately while every other week's stored routine and version are untouched.

- [X] T013 [US2] Extend `app/tests/integration/weekly-routine-lifecycle.test.js` (same file as T006, sequential) with the update-current-week scenario: publish an edit to `program.md` with no `--week`/`--new-week` flag against the fixture customer's existing current week; assert the edit is reflected and every other week's `content`/`version` is unchanged (quickstart.md Scenario 2).
- [X] T014 [US2] Extend the `GET /api/sync/download` and `GET /api/sync/status` handlers in `app/server/index.js` with the same optional `week_number` query parameter (default: current week), per `contracts/weekly-routine-api.md`'s symmetry requirement — needed so a coach's publish flow reads the correct `current_version` for the specific week it's about to write.

**Checkpoint**: User Stories 1 AND 2 both work independently — a new week can be created (US1) and subsequently revised in place (US2) without ever touching history.

---

## Phase 5: User Story 3 - Look back at what a customer was training in a past week (Priority: P3)

**Goal**: A coach or customer can browse any past week's routine exactly as it was originally recorded, clearly marked as history.

**Independent Test**: With at least one locked past week and one later update present, navigate to the past week and confirm its full, original routine renders — distinct from the current week's content — and is visibly marked as history.

- [X] T015 [P] [US3] Extend `app/tests/integration/weekly-routine-lifecycle.test.js` with locking-enforcement checks: `--week` targeting the now-locked week 1 exits non-zero and leaves its content/version unchanged; `--week` targeting `current + 2` (a gap) exits non-zero and creates no new row (quickstart.md Scenario 3). *(Same file as T006/T013 but its own prerequisites are already complete by this phase, so it's parallelizable with T016/T017 below.)*
- [X] T016 [US3] Rewrite `renderProgramContent` in `app/src/components/tab-container.js` per `contracts/week-tab-navigation-v2.md`: default the active week to the current (max) week from `programWeeks` instead of a hardcoded Week 1 (`research.md` Decision 6); on chip selection, check an in-memory per-page-visit cache keyed by week number — render from cache if present, otherwise fetch `GET /api/customers/:slug/program/weeks/:week` (T008) and cache the result; render that week's own `weeklySchedule` via the existing `renderDaySubnav`/`renderProgramDay`; show a loading state while a fetch is in flight without blanking the previously-shown week; show the locked indicator when the active week's `isLocked` is true.
- [X] T017 [US3] Update `buildProgramWeekPdfContent` in `app/src/components/program-pdf.js` to take the currently-active week's own loaded detail (from T016's cache) instead of reusing one shared `weeklySchedule` relabeled per week number, so a downloaded PDF's content matches the week number in its filename.

**Checkpoint**: All three user stories are independently functional — routines are genuinely per-week, the current week is editable and revisable, and the full history is browsable and trustworthy in both the CLI/API and the UI.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Run `specs/010-weekly-routine-versioning/quickstart.md` end-to-end (all 5 scenarios) against a disposable test customer; record results in the PR/change description.
- [X] T019 [P] Add a one-line supersession notice at the top of `specs/003-program-weekly-tabs-pdf/contracts/week-tab-navigation.md` pointing to `specs/010-weekly-routine-versioning/contracts/week-tab-navigation-v2.md`, so a future reader of the old contract isn't misled into implementing against it.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001) for T005; T002/T003/T004 only depend on each other as noted. **Blocks all user stories.**
- **User Stories (Phase 3-5)**: All depend on Foundational (Phase 2) completing. US1 (Phase 3) has no dependency on US2/US3. US2 (Phase 4) reuses US1's routes/CLI plumbing (T006-T011) rather than duplicating them, so build it after US1. US3 (Phase 5) reads via US1's routes (T007, T008) and displays via US1's chip changes (T012), so build it after US1; it does not depend on US2.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only.
- **User Story 2 (P2)**: Foundational + User Story 1's routes/CLI (reuses the same code paths with a different `week_number` target — no new route needed).
- **User Story 3 (P3)**: Foundational + User Story 1's read routes and chip list.

### Within Each Phase

- Foundational: T002 → T003; T004 independent; T005 depends on T001 + T002.
- US1: T006 (test) can be written first per TDD; T007 → T008 → T009 → T010 are sequential (same file, `app/server/index.js`); T011 and T012 are independent of the route work and of each other.
- US2: T013 depends on T006 (same test file); T014 depends on T007-T010 having landed (same file, `index.js`).
- US3: T015 depends on T006/T013 (same test file) but is otherwise free to run alongside T016/T017; T017 depends on T016.

### Parallel Opportunities

- Foundational: T002 and T004 can start together.
- US1: T011 (CLI) and T012 (week-subnav.js) can run in parallel with each other and with the T007-T010 route sequence (all different files).
- US3: T015 can run in parallel with T016/T017; T017 must follow T016.
- Phase 6: T018 and T019 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Once Foundational (T002-T005) is complete, these can run together:
Task: "Add --week/--new-week flags to app/server/scripts/publish.js"          # T011
Task: "Make week-subnav.js render a dynamic, lock-aware chip list"             # T012
Task: "Write the weekly-routine-lifecycle integration test (creation scenario)" # T006

# T007 -> T008 -> T009 -> T010 proceed sequentially against app/server/index.js
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001 — migration).
2. Phase 2: Foundational (T002-T005 — **blocking**, do not start US1 early).
3. Phase 3: User Story 1 (T006-T012).
4. **STOP and VALIDATE**: run `quickstart.md` Scenario 1 against a disposable test customer.
5. This alone already fixes the bug this feature exists to address (a customer's week 2 no
   longer shows the same content as week 1) — it's a legitimate, demoable increment on its own.

### Incremental Delivery

1. Setup + Foundational → schema and shared rules ready, nothing user-visible yet.
2. + User Story 1 → coaches can create genuinely independent weeks (MVP, quickstart Scenario 1).
3. + User Story 2 → coaches can revise the current week safely (quickstart Scenario 2).
4. + User Story 3 → coaches and customers can browse trustworthy history in the UI (quickstart
   Scenarios 3-5).
5. + Polish → old contract cross-referenced, full quickstart run recorded.

---

## Notes

- 19 tasks total: 1 Setup, 4 Foundational, 7 US1, 2 US2, 3 US3, 2 Polish.
- Every task names an exact file path; none require additional context to start.
- `app/src/components/program-day.js` is intentionally **not** touched by any task — per
  `plan.md`'s Project Structure, it already operates on one week's `weeklySchedule` at a time and
  needs no change once each week's content is genuinely independent (the cross-week DOM-id
  collision risk noted during planning research never arises, by construction).
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently before continuing.
