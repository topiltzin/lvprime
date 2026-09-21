---

description: "Task list template for feature implementation"
---

# Tasks: Exercise Library Migration & Video Linking

**Input**: Design documents from `/specs/007-exercise-library-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — the feature's own contracts (`exercise-data-api.md`,
`exercise-video-linking.md`) define explicit Testing Checklists and this codebase's established
convention (`app/package.json`'s `test` script, existing `app/tests/unit/` and
`app/tests/integration/` suites referenced directly by plan.md's Project Structure) treats tests as
part of shipping a feature, not an optional extra.

**Organization**: Tasks are grouped by user story (spec.md: US1 = P1, US2 = P2, US3 = P3) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, from plan.md's Project Structure

---

## Phase 1: Setup

**Purpose**: Create the one piece of shared infrastructure every story needs — the table itself.

- [X] T001 Apply the `exercises` table DDL
      (contracts/database-schema.md) via Supabase Dashboard → SQL Editor: `CREATE TABLE exercises
      (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, category
      VARCHAR(100), video_url TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at
      TIMESTAMP NOT NULL DEFAULT NOW());` followed by `CREATE UNIQUE INDEX idx_exercises_name_lower
      ON exercises (LOWER(name));`. Verify against contracts/database-schema.md's Acceptance
      Criteria: two rows differing only by case fail on the second insert; a row with `video_url`
      omitted succeeds. Claude Code has no DDL execution path against Supabase (no psql/Supabase
      CLI/`pg` dependency in this project) — this step requires the user to run it.

**Checkpoint**: `exercises` table exists and enforces case-insensitive name uniqueness.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared data-access layer every user story calls into. No story work can start
until this is done.

**⚠️ CRITICAL**: Blocks Phase 3, 4, and 5.

- [X] T002 Implement `listExercises()`, `getExerciseVideoLinkMap()`, and `upsertExercise(name, {
      category, videoUrl })` in `app/server/lib/customer-data.js`, following this file's existing
      `get*`/`upsert*` patterns (see `getCustomerNotes`, `upsertCustomer`), per
      contracts/exercise-data-api.md:
      - `listExercises()`: all rows ordered by `name`; throws `DatabaseError` on a Supabase error.
      - `getExerciseVideoLinkMap()`: one query, returns a `Map` keyed by
        `name.trim().toLowerCase()` → `video_url`, **excluding** rows where `video_url` is `NULL`
        or `''`.
      - `upsertExercise(name, { category, videoUrl })`: `name` MUST be a non-empty string ≤255
        chars, else throw `ValidationError('name', ...)`; `videoUrl`, if provided and non-null,
        MUST match `/^https?:\/\//`, else throw `ValidationError('videoUrl', ...)`; upsert conflict
        target is the case-insensitive `name` (so `'Push-Up'` then `'PUSH-UP'` update the same
        row); bumps `updated_at` on every call.
- [X] T003 [P] Unit tests for the three functions above. **Deviation**: split across two files to
      match this codebase's real testing convention (discovered in
      `tests/unit/database.test.js`'s own header — Supabase isn't mocked in unit tests; only
      synchronous validation is unit-tested, success paths go in integration tests against the
      real project). `app/tests/unit/exercise-data.test.js` covers `upsertExercise`'s
      `ValidationError` paths (empty/oversized name, non-http(s) videoUrl, null videoUrl accepted).
      `app/tests/integration/exercise-data.test.js` covers the Acceptance Criteria success paths
      (`listExercises()` order, `getExerciseVideoLinkMap()` excluding unlinked rows, case-
      insensitive upsert merging into one row) against real Supabase with a disposable fixture row,
      mirroring `tests/integration/customer-data.test.js`.

**Checkpoint**: Exercise data-access layer is implemented and tested — user story work can begin.

---

## Phase 3: User Story 1 - Exercise names link straight to a demo video (Priority: P1) 🎯 MVP

**Goal**: When a customer's program is viewed, any exercise name matching the (seeded) exercise
library renders as a clickable link to its video; unmatched names render as plain text.

**Independent Test**: Seed 2-3 rows in `exercises` directly via `upsertExercise()` (no need for the
full migration yet), open a customer program containing one of those exercise names, and confirm it
renders as a link while a non-matching exercise in the same program still renders as plain text.

### Implementation for User Story 1

- [X] T004 [P] [US1] In `app/server/markdown-parser.js`, add a `videoLinkMap` parameter to
      `parseProgramDetail(programMdText, renderMarkdown, videoLinkMap)` and thread it into
      `extractExercises()` so each returned exercise object gains `videoUrl:
      videoLinkMap?.get(name.trim().toLowerCase()) ?? null`, per
      contracts/exercise-video-linking.md. Matching is case-insensitive and otherwise exact — no
      accent-stripping or punctuation normalization beyond case-folding/trim. An absent/empty
      `videoLinkMap` MUST make every `videoUrl` resolve to `null`, never throw. Every existing field
      (`name`, `setsReps`, `rest`, `formTip`) and the day's `html` output MUST remain byte-identical
      to today's output.
- [X] T005 [P] [US1] In `app/src/components/program-day.js`'s `renderExerciseRow()`, render the
      exercise name as `<a href="{exercise.videoUrl}" target="_blank"
      rel="noopener noreferrer">{exercise.name}</a>` when `exercise.videoUrl` is non-null, and keep
      today's plain `<span>` with `textContent = exercise.name` when it is `null`.
- [X] T006 [US1] In `app/server/index.js`'s `handleGetCustomer`, call `getExerciseVideoLinkMap()`
      (in parallel with the existing `Promise.all` of program/notes/nutrition/feedback queries so
      the <500ms customer-profile-load budget from specs/006 SC-004 is preserved) and pass the
      resulting map as `parseProgramDetail`'s third argument. Depends on T004. **Note**: implemented
      as `Promise.all([getCustomerFullProfile(slug), getExerciseVideoLinkMap()])` — a sibling
      parallel call rather than nested inside `getCustomerFullProfile`'s own internal `Promise.all`,
      since the exercise library isn't customer-scoped; same one-extra-parallel-query effect.
- [X] T007 [P] [US1] Unit tests in `app/tests/unit/markdown-parser.test.js` covering
      contracts/exercise-video-linking.md's Testing Checklist: the existing Spanish/English Monday
      fixtures resolve `videoUrl` correctly against a small fixture `videoLinkMap`; a name present
      in the program but absent from the map yields `videoUrl: null`; a case-mismatched name (map
      has `"push-up"`, program has `"Push-Up"`) still resolves; an absent map yields `videoUrl: null`
      for every exercise without throwing.
- [X] T008 [US1] Integration test asserting the read path resolves `videoUrl` correctly end-to-end
      with real data. **Deviation**: not added to `tests/integration/customer-detail.test.js` — that
      file's fixture-filesystem-based HTTP harness is already marked superseded/skipped pending a
      rework against a Supabase test project (its own file header, predating this feature); redoing
      that harness is out of scope here. Instead:
      `app/tests/integration/exercise-video-linking.test.js` calls a real `getExerciseVideoLinkMap()`
      then a real `parseProgramDetail()` against a fixture program string with one matching and one
      non-matching exercise name, against real Supabase with a disposable fixture row. Depends on
      T006.

**Checkpoint**: User Story 1 is fully functional and independently testable (quickstart.md Scenario
3, using manually seeded rows).

---

## Phase 4: User Story 2 - Exercise reference data lives in one central place (Priority: P2)

**Goal**: Every exercise currently in `exercise.md` exists as a row in `exercises`, migrated by a
reusable, idempotent script.

**Independent Test**: Run the migration script, then call `listExercises()` directly (independent
of any customer program) and confirm every exercise from `exercise.md` is present with name and
video link intact (spec SC-001).

### Implementation for User Story 2

- [X] T009 [US2] Create `app/server/migrations/migrate-exercises.js`, mirroring
      `migrate-data.js`'s existing shape (idempotent, safe to re-run): read `exercise.md` from the
      repo root, parse its five category tables (Strength — Upper Body, Strength — Lower Body,
      Core, Cardio, Flexibility & Mobility) into `{name, category, videoUrl}` rows, and call
      `upsertExercise()` (T002) for each — skipping/reporting rows already present rather than
      erroring, per research.md §5. Run via `node server/migrations/migrate-exercises.js` from
      `app/`. Parsing logic exported as `parseExerciseMd()` and its `main()` guarded to only run
      when the file is executed directly, so it's safely importable for unit testing.
- [X] T010 Ran the migration: 39 exercises migrated on first run, 0 inserted/39 skipped on a
      second run (idempotency confirmed live). Verified against `exercise.md` before deletion:
      all 39 present with matching `video_url`/`category`, zero mismatches (spec SC-001 satisfied).
- [X] T011 [P] [US2] **Deviation**: rather than literally invoking `migrate-exercises.js` twice from
      a test (this codebase's migration scripts are run manually, never imported/invoked by tests —
      see `migration-data-integrity.test.js`'s read-only pattern), idempotency is proven two ways:
      `app/tests/unit/migrate-exercises.test.js` unit-tests `parseExerciseMd()` against the real
      `exercise.md` (no duplicate names parsed); `app/tests/integration/migrate-exercises.test.js`
      asserts the live `exercises` table has no case-duplicate names and matches `exercise.md`
      exactly (the observable proof re-running couldn't have created duplicates, since
      `upsertExercise`'s case-insensitive matching, already covered in T003's integration test, is
      what guarantees it). Both ran and passed against the live table. **Further deviation**: after
      T013 deleted `exercise.md`, `tests/integration/migrate-exercises.test.js`'s cross-reference
      against the file was trimmed to an ongoing structural check (no case-duplicate names, every
      row has a name) — the original cross-reference served its one-time purpose in T010 and would
      otherwise break permanently now that the source file is gone.

**Checkpoint**: All ~40 exercises from `exercise.md` are verified present in `exercises` — User
Story 1's linking now works with real data for every migrated exercise, and User Story 2 is
independently testable via `listExercises()` alone.

---

## Phase 5: User Story 3 - The local exercise file is retired (Priority: P3)

**Goal**: `exercise.md` no longer exists in the project once migration is verified, with zero
runtime dependency on it.

**Independent Test**: After Story 2's verification passes, confirm `exercise.md` no longer exists,
and that a customer program view still resolves video links correctly.

### Implementation for User Story 3

- [X] T012 [US3] Confirmed zero runtime dependents via `grep -rn "exercise\.md" app/server app/src`
      — only the migration script (expected) and a doc comment. **Note**: verified via the
      automated integration tests (exercise-video-linking, exercise-data) rather than manually
      running the dev server in a browser — they already prove the read path resolves `videoUrl`
      entirely from Supabase with no filesystem access.
- [X] T013 [US3] Deleted `exercise.md` from the repository root. Re-ran
      `exercise-video-linking.test.js`/`exercise-data.test.js` immediately after — both pass
      identically with the file gone, confirming no runtime dependency.

**Checkpoint**: All three user stories are independently functional; `exercise.md` is gone.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories together.

- [X] T014 [P] Ran live: `upsertExercise('Squat', { videoUrl: '<temp-url>' })`, confirmed
      `getExerciseVideoLinkMap()` immediately reflected it (spec SC-005), then restored Squat's
      real video URL. No customer program was touched.
- [X] T015 Ran `node --env-file=.env.local --test tests/unit/*.test.js
      tests/integration/exercise-data.test.js tests/integration/exercise-video-linking.test.js
      tests/integration/migrate-exercises.test.js` (workaround for a pre-existing, unrelated
      `npm test`/`node --test tests/` directory-glob failure on this Node v24.21 install — see
      Notes). 39/40 pass; the one failure (`topiltzin-flores/feedback.md` real-entry-count
      mismatch) predates this feature and is untouched by this diff.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (table must exist) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational only. No dependency on US1/US3 — can run in
  parallel with Phase 3 if staffed.
- **User Story 3 (Phase 5)**: Depends on US1 (T008) and US2 (T010) both being verified — it deletes
  the file the other two stories' independent tests were seeded/validated around.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002 and T003 are sequential (T003 tests T002's own file's exports), but Phase 2 as a whole
  gates Phase 3/4/5.
- Once Phase 2 is done, **Phase 3 (US1) and Phase 4 (US2) can run fully in parallel** — different
  files, no shared dependency other than the already-complete Foundational layer.
- Within Phase 3: T004, T005, T007 touch different files and only depend on the already-written
  contracts docs, so they can run in parallel; T006 depends on T004, and T008 depends on T006.
- Within Phase 4: T009 then T010 are sequential (script must exist to run it); T011 can run in
  parallel with T010 (different files).

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Once Phase 2 (Foundational) is complete, launch together:
Task: "Add videoLinkMap param + videoUrl attachment in app/server/markdown-parser.js"     # T004
Task: "Render exercise name as a link when videoUrl is present in app/src/components/program-day.js" # T005
Task: "Unit tests for videoUrl attachment in app/tests/unit/markdown-parser.test.js"      # T007

# Then, once T004 lands:
Task: "Wire getExerciseVideoLinkMap() into handleGetCustomer in app/server/index.js"      # T006
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational (T002, T003).
3. Phase 3: User Story 1 (T004-T008), validated with a couple of manually seeded `exercises` rows.
4. **STOP and VALIDATE**: quickstart.md Scenario 3 — a coach can already see working video links on
   real customer programs, even before the full library is migrated.

### Incremental Delivery

1. Setup + Foundational → data-access layer ready.
2. Add User Story 1 → linking works (MVP, demoable with seed data).
3. Add User Story 2 → the real ~40-exercise library is migrated in, so US1's linking now covers
   every exercise `exercise.md` ever had.
4. Add User Story 3 → `exercise.md` is safely removed.
5. Polish → cross-story validation (T014, T015).
