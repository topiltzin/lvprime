---

description: "Task list template for feature implementation"
---

# Tasks: Exercise Library Coverage Backfill

**Input**: Design documents from `/specs/008-exercise-coverage-backfill/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all
present)

**Tests**: Included — same rationale as specs/007-exercise-library-migration/tasks.md: the
contracts here define explicit Testing Checklists and this codebase treats tests as part of
shipping, not optional. **Test-safety rule carried over from specs/007's own incident** (research.md
§4): every test that calls `upsertExercise()` MUST use a disposable, clearly-namespaced fixture
name with `t.after()` cleanup — never a real exercise name from the library or from any customer's
program.

**Organization**: Tasks are grouped by user story (spec.md: US1 = P1 backfill, US2 = P2 repeatable
check).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths are exact, from plan.md's Project Structure

---

## Phase 1: Setup

**Purpose**: Confirm the prerequisites this feature builds on (specs/007's table and data layer)
are in place before starting.

- [X] T001 Confirmed: 39 rows present. Confirm `app/.env.local` has `SUPABASE_URL`/`SUPABASE_SECRET_KEY` set and the `exercises`
      table from specs/007-exercise-library-migration exists and is populated (39 rows expected):
      `node --env-file=.env.local -e "import('./server/lib/customer-data.js').then(async ({listExercises}) => console.log((await listExercises()).length))"`
      from `app/`.

**Checkpoint**: Prerequisites confirmed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The coverage-check script both stories depend on — US1 needs its output to know what
to research and backfill; US2's entire promise *is* this script being repeatable.

**⚠️ CRITICAL**: Blocks Phase 3 and Phase 4.

- [X] T002 Implement `app/server/scripts/check-exercise-coverage.js` per
      contracts/coverage-check.md: for every customer from `listAllCustomers()` with a program
      (`getCustomerProgram()`), call `parseProgramDetail(content, renderMarkdown)` (no
      `videoLinkMap` needed) and collect every `weeklySchedule[].exercises[].name` across all days;
      compare each `name.trim().toLowerCase()` against `listExercises()`'s names the same way
      (case-insensitive, exact — specs/007 FR-007's rule, not fuzzy); print a report of missing
      names deduplicated across customers, each with the list of referencing customer slugs, or
      `No coverage gaps...` if none; **never** calls `upsertExercise`/`insert`/`update` — read-only;
      always exits 0 (a nonzero gap count is a normal report, not a script error).
- [X] T003 [P] Unit test in `app/tests/unit/exercise-coverage.test.js`: pure diff logic (given
      `[{name, slug}]` usages and a list of library names, returns the correct missing set grouped
      by name with all referencing slugs, case-insensitive) — no Supabase import, per
      contracts/coverage-check.md's Testing Checklist.
- [X] T004 [P] Integration test in `app/tests/integration/exercise-coverage.test.js`: runs the real
      extraction + diff against live Supabase data (read-only, skips cleanly without
      `SUPABASE_URL`/`SUPABASE_SECRET_KEY`) and asserts internal consistency — every name reported
      missing is genuinely absent from a fresh `listExercises()` call — rather than asserting a
      hardcoded count (the real gap will be zero once Phase 3 lands).

**Checkpoint**: `check-exercise-coverage.js` works and is tested — both user stories can now
proceed.

---

## Phase 3: User Story 1 - Every real customer workout gets video coverage (Priority: P1) 🎯 MVP

**Goal**: Every exercise name referenced in any current customer's program has a library entry with
a real, verified video link.

**Independent Test**: Per spec — for a given customer's program, list every exercise name it
contains and confirm each one resolves to a video link when the program is viewed.

### Implementation for User Story 1

- [X] T005 [US1] Ran live: 60 distinct names, 54 missing, exactly matching contracts/coverage-check.md
      (no drift since planning).
- [X] T006 [P] [US1] Delegated to a background research fork (52 WebSearch calls) — all 54 entries
      written to `missing-exercises-data.js`, each with a real, individually-verified video (title/
      channel confirmed in search results, no guessed IDs). Verified post-hoc: 54 unique names,
      exact character-for-character match against T005's list, all `http(s)` URLs, all categories
      present. Three entries intentionally reuse another entry's video where they're the literal
      same movement under a different name string (e.g. "Dumbbell Incline Press" ≡ "Incline
      dumbbell press") — not a fabrication shortcut, a genuine match.
- [X] T007 [P] [US1] Implemented, with one refinement beyond the task description: the core loop
      is exported as `backfillExercises(entries)` (not just called from an unexported `main()`) so
      T011's integration test can exercise the identical code path against disposable fixture data
      instead of duplicating the loop logic.
- [X] T008 [US1] First run: `Added 54 exercise(s). Skipped 0 (already present).` Second run:
      `Added 0 exercise(s). Skipped 54 (already present).` — idempotent, confirmed live.
- [X] T009 [US1] Re-ran: `Missing: 0` / `No coverage gaps...`, library now 93 rows (39 + 54).
- [X] T010 [US1] Verified programmatically rather than by eye in a browser: ran the exact same
      `getExerciseVideoLinkMap()` → `parseProgramDetail()` path `handleGetCustomer` uses, against
      both customers' real content. Result: jaqueline-orellano 38/38 exercises linked,
      topiltzin-flores 30/30 — full coverage (spec SC-002). The render logic itself (name → `<a>`)
      was already tested in specs/007; this confirms every name now has a `videoUrl` to render.
- [X] T011 [P] [US1] All 3 subtests pass (add, idempotent re-run, no-overwrite-of-existing).
      Cleanup verified: library back to 93 rows post-test, zero leftover fixture rows.

**Checkpoint**: All exercises referenced in current customer programs have video links; the
backfill is proven idempotent.

---

## Phase 4: User Story 2 - Coverage gaps don't silently reappear (Priority: P2)

**Goal**: Prove the coverage check (built in Foundational) correctly identifies a newly introduced
gap, not just today's already-known one.

**Independent Test**: Per spec — add a new, clearly novel exercise name to a test program, run the
coverage check, confirm it's reported as missing.

### Implementation for User Story 2

- [X] T012 [US2] Quickstart.md Scenario 5: temporarily add a clearly novel exercise name to a
      **test** program's content (not a real customer's program — use a disposable fixture, same
      test-safety rule as T011), run `check-exercise-coverage.js`, confirm it reports exactly that
      one new name as missing and nothing else (spec User Story 2, Scenario 1), then revert the
      temporary addition. Depends on T009 (verifying against a clean, zero-gap baseline makes the
      "exactly one new gap" assertion meaningful).

      **[X] Done.** Created a disposable customer (`coverage-check-us2-fixture`) via `upsertCustomer`
      + `updateCustomerProgram` with one line, `"Totally Novel Fixture Exercise XYZ"`. Ran the
      check: `Missing: 1` — `"Totally Novel Fixture Exercise XYZ" — used by: coverage-check-us2-fixture`,
      nothing else. Deleted the fixture customer (cascades to its program row). Re-ran: back to
      `Missing: 0` across the real 2 customers — confirmed clean.

**Checkpoint**: Both user stories independently verified — the check is proven to matter beyond
today's one-time backfill.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories together.

- [X] T013 Ran `cd app && node --env-file=.env.local --test tests/unit/*.test.js
      tests/integration/*.test.js`: 60 pass, 6 skipped (pre-existing, always-skip "superseded"
      tests, unrelated to credentials), 4 fail. Every new/extended test from T003, T004, T011
      (and T002/T007's own scripts) passes. All 4 failures are pre-existing `feedback.md`
      filesystem-vs-Supabase drift across 3 customers (jaqueline-orellano, test-alice,
      topiltzin-flores) — the same class of issue flagged during specs/007's implementation,
      entirely unrelated to exercises/programs/this feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS both user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (needs `check-exercise-coverage.js`'s output
  to know what to research). No dependency on US2.
- **User Story 2 (Phase 4)**: Depends on Foundational (the script itself) and, for a clean
  assertion, on US1's T009 (zero-gap baseline) — the one cross-story dependency in this feature,
  and it's a testing-order dependency, not a code dependency (US2's own deliverable, the check
  script, was already complete in Foundational).
- **Polish (Phase 5)**: Depends on both user stories.

### Parallel Opportunities

- T003 and T004 (different files, both testing T002's already-fully-specified contract) can be
  built in parallel with each other and don't need to wait on T002's actual code, only its
  contract.
- T006 (data authoring) and T007 (backfill script) touch different files and only depend on the
  documented data shape, not each other — fully parallel.
- T011 (backfill integration test, disposable fixtures) can be written in parallel with T006 (real
  data research) — different files, and T011 never touches `MISSING_EXERCISES`.

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Once T005 (current missing-names list) is confirmed:
Task: "Research + author missing-exercises-data.js"                          # T006
Task: "Implement backfill-missing-exercises.js against the documented shape" # T007
Task: "Integration test for the backfill code path (disposable fixtures)"    # T011
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational (T002-T004) — the check script exists and is trustworthy.
3. Phase 3: User Story 1 (T005-T011) — every real customer program gets full video coverage.
4. **STOP and VALIDATE**: quickstart.md Scenarios 1-4.

### Incremental Delivery

1. Setup + Foundational → the coverage-check tool exists and is tested.
2. Add User Story 1 → today's 54-exercise gap is closed (MVP — this is the whole point of the
   original request).
3. Add User Story 2 → proven that the same tool keeps working for tomorrow's not-yet-written
   programs, not just today's.
4. Polish → full-suite validation (T013).
