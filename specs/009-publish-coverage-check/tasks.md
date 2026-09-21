---

description: "Task list template for feature implementation"
---

# Tasks: Publish-Time Exercise Coverage Check

**Input**: Design documents from `/specs/009-publish-coverage-check/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all
present)

**Tests**: Included — same rationale as specs/007/008: the contract here defines explicit
acceptance criteria and testing checklist, and this codebase treats tests as part of shipping.
**Test-safety rule carried forward** (specs/008 research.md §4, specs/009 plan.md Constraints):
any test that publishes/upserts a fixture customer or exercise uses a disposable, clearly-namespaced
name and cleans up both its local file and its Supabase rows — never a real customer or real
exercise.

**Organization**: Tasks are grouped by user story (spec.md: US1 = P1 detection, US2 = P2
gap-closing + end-to-end proof).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths are exact, from plan.md's Project Structure

---

## Phase 1: Setup

- [X] T001 Confirmed: 93 rows present. Confirm prerequisites: `app/.env.local` has `SUPABASE_URL`/`SUPABASE_SECRET_KEY` set and
      the `exercises` table has 93 rows (specs/007 + specs/008's backfill):
      `node --env-file=.env.local -e "import('./server/lib/customer-data.js').then(async ({listExercises}) => console.log((await listExercises()).length))"`
      from `app/`.

**Checkpoint**: Prerequisites confirmed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract specs/008's inline check logic into reusable, exported functions — both user
stories depend on `publish.js` being able to call the exact same logic `check-exercise-coverage.js`
already uses.

**⚠️ CRITICAL**: Blocks Phase 3 and Phase 4.

- [X] T002 In `app/server/scripts/check-exercise-coverage.js`, extract the scan-and-diff logic
      currently inline in `main()` into `export async function checkCoverage()` returning
      `{ customerCount, distinctUsedCount, libraryCount, missing }` (Data Model → Coverage Report);
      extract the console-text-building logic into
      `export function formatCoverageReport({ customerCount, distinctUsedCount, libraryCount, missing })`
      returning the exact string `main()` already prints today (Data Model → Coverage Report Text);
      refactor `main()` to `console.log(formatCoverageReport(await checkCoverage()))` — behavior-
      preserving, no output change for existing standalone use of this script.
- [X] T003 [P] Unit tests in `app/tests/unit/exercise-coverage.test.js`: `formatCoverageReport()`
      given `missing: []` produces the "No coverage gaps — every referenced exercise name has a
      library match." text; given one or more `missing` entries, produces the
      `Scanned N customer(s)...`/`Library has L exercise(s).`/`Missing: K` header followed by one
      `"name" — used by: slug1, slug2` line per entry, in the given order — per
      contracts/publish-coverage-integration.md's Testing Checklist.
- [X] T004 Regression check: ran standalone before and after T002's refactor — output byte-for-byte
      identical (`Scanned 2 customer(s), 60 distinct exercise name(s)...` / `Missing: 0` / `No
      coverage gaps...`), confirming the refactor is behavior-preserving.

**Checkpoint**: `checkCoverage()`/`formatCoverageReport()` exist, are tested, and are proven
behavior-preserving — both user stories can now proceed.

---

## Phase 3: User Story 1 - Coverage gaps are surfaced the moment a program is published (Priority: P1) 🎯 MVP

**Goal**: Publishing a `program` file reports exercise-coverage gaps as part of that same action,
without blocking the publish.

**Independent Test**: Per spec — publish any customer's program (new or existing) and confirm the
coverage result is reported as part of that same publish action, without running any separate
command.

### Implementation for User Story 1

- [X] T005 [US1] In `app/server/scripts/publish.js`: add
      `export async function reportProgramCoverage()` that calls `checkCoverage()` +
      `formatCoverageReport()` (imported from `check-exercise-coverage.js`) and
      `console.log('\n' + ...)`s the result; wraps the whole body in `try/catch` —
      `console.warn`s a one-line message on any error and returns normally, **never** throws (spec
      FR-004). Add the same "only run when executed directly" guard already used in
      `migrate-exercises.js`/`check-exercise-coverage.js`/`backfill-missing-exercises.js` around the
      existing `main().catch(...)` call at the bottom of the file, since this file now exports a
      function tests will import.
- [X] T006 [US1] In `publish.js`'s `main()`, after a successful `syncCoachWrite` call, add
      `if (fileType === 'program') await reportProgramCoverage();` (spec FR-001, FR-005) — `notes`
      and `nutrition_plan` publishes must be completely unaffected. Depends on T005.
- [X] T007 [P] [US1] Integration test in `app/tests/integration/publish-coverage.test.js`: imports
      `reportProgramCoverage()` directly and asserts it resolves (doesn't throw) against live data —
      the happy-path proof in isolation, per contracts/publish-coverage-integration.md's Testing
      Checklist.
- [X] T008 [US1] Manual verification: published `topiltzin-flores`'s existing program (full
      coverage) — got `Published topiltzin-flores/program: version 0 -> 1` followed by `No coverage
      gaps...` (spec FR-004, SC-004). Published `topiltzin-flores`'s `notes` — got only the
      `Published .../notes: ...` line, no coverage report at all (spec FR-005).

**Checkpoint**: Every `program` publish now surfaces coverage gaps in its own output; `notes`/
`nutrition_plan` publishes are unaffected; the check never blocks a publish.

---

## Phase 4: User Story 2 - A surfaced gap gets closed and proven end-to-end (Priority: P2)

**Goal**: Prove the whole loop — publish a new customer with a novel exercise, see it flagged, close
it, see it render — with a real disposable test customer through the real `publish.js` path.

**Independent Test**: Per spec — publish a genuinely new test customer's program containing one
exercise name with no library entry; confirm it's reported; add a real video link; confirm that
customer's program renders it, with no re-publish needed.

### Implementation for User Story 2

- [X] T009 [US2] Integration test in `app/tests/integration/publish-cli.test.js` (the FR-008/spec
      User Story 2 Scenario 2 end-to-end proof, per contracts/publish-coverage-integration.md):
      writes `customers/<disposable-fixture-slug>/program.md` locally with one exercise line
      referencing a clearly-synthetic name (not a real exercise, so it can never collide with a
      real library entry); spawns
      `node --env-file=.env.local server/scripts/publish.js <fixture-slug> program` as a real child
      process via `node:child_process`; asserts stdout contains both the `Published` line and the
      fixture exercise name under the coverage report; in a `t.after`, deletes the local fixture
      directory and the fixture customer's Supabase rows (cascade via `customers` delete). Depends
      on T006 (the behavior under test) and T002 (Foundational). Passed; cleanup verified (no
      leftover local dir, no leftover Supabase customer row).
- [X] T010 [US2] Live run of quickstart.md Scenario 1: created+published a real disposable
      "coverage-check-fixture" customer via the actual CLI. Output: `Customer
      "coverage-check-fixture" not found in Supabase yet — creating as...`, then `Published
      coverage-check-fixture/program: version 0 -> 1`, then `Missing: 1` /
      `"Totally Novel Publish-Time Exercise" — used by: coverage-check-fixture` — the literal
      "tested with a new customer" proof from the original request.
- [X] T011 [US2] Closed the gap: `upsertExercise('Totally Novel Publish-Time Exercise', ...)` with a
      real, already-verified link. Confirmed via a live `getExerciseVideoLinkMap()` +
      `parseProgramDetail()` call that the fixture customer's program resolved the `videoUrl` with
      no re-publish (spec FR-007, SC-003). Deleted the fixture exercise row, the local
      `customers/coverage-check-fixture/` directory, and the fixture customer's Supabase row —
      confirmed clean (T013).

**Checkpoint**: The full detect → close → render loop is proven end-to-end with a real (disposable)
new customer, both by an automated test (T009) and a live manual run (T010-T011).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T012 Ran: 64 pass, 6 skipped (pre-existing, always-skip "superseded" tests, unrelated to
      credentials), 4 fail. Every new/extended test from T003, T007, T009 passes. All 4 failures
      are the same pre-existing `feedback.md` filesystem-vs-Supabase drift flagged during specs/007
      and specs/008's implementations — unrelated to this feature.
- [X] T013 Confirmed: `customers/` has exactly `README-BACKUP-NOTICE.md`, `jaqueline-orellano`,
      `test-alice`, `topiltzin-flores` — no fixture directories. `listExercises()` returns 93.
      `listAllCustomers()` returns exactly the 3 real customers.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS both user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2.
- **User Story 2 (Phase 4)**: Depends on Foundational *and* US1's T006 (the actual wiring US2's
  end-to-end test exercises) — the one cross-story dependency in this feature, and it's inherent:
  US2 proves US1's behavior end-to-end, it can't run before US1's behavior exists.
- **Polish (Phase 5)**: Depends on both user stories.

### Parallel Opportunities

- T003 (unit tests) can be written in parallel with T002 (the refactor) — the exact target
  signature is already fully specified in contracts/publish-coverage-integration.md.
- T007 (integration test, different file) can be written in parallel with T006 (the `main()`
  wiring) — both only depend on T005's already-specified `reportProgramCoverage()` export.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Once the target signatures are agreed (they're already fully specified in the contract):
Task: "Refactor check-exercise-coverage.js to export checkCoverage()/formatCoverageReport()" # T002
Task: "Unit tests for formatCoverageReport() in tests/unit/exercise-coverage.test.js"          # T003
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational (T002-T004) — shared logic extracted and proven behavior-preserving.
3. Phase 3: User Story 1 (T005-T008) — every `program` publish now surfaces coverage gaps.
4. **STOP and VALIDATE**: quickstart.md Scenarios 3-4.

### Incremental Delivery

1. Setup + Foundational → shared coverage-report logic ready to be called from anywhere.
2. Add User Story 1 → gaps surface automatically on every publish going forward (MVP — closes the
   loop specs/008 left open).
3. Add User Story 2 → the loop is proven end-to-end with a real new customer, both automated and by
   hand — the literal "tested with a new customer" from the original request.
4. Polish → full-suite validation and a final check that no fixture data was left behind (T012-T013).
