# Quickstart: Exercise Library Coverage Backfill

**Purpose**: Runnable steps to validate this feature end-to-end — see the gap, close it, prove it
stays closed.

**Prerequisites**:
- `app/.env.local` has `SUPABASE_URL`/`SUPABASE_SECRET_KEY` set (same as specs/007).
- specs/007's `exercises` table and data-access functions already exist and are populated with the
  original migration.

---

## Scenario 1 — See the current gap

1. From `app/`: `node --env-file=.env.local server/scripts/check-exercise-coverage.js`.
2. **Expected**: reports the 54 names listed in `contracts/coverage-check.md`'s Acceptance Criteria
   as missing (before this feature's backfill has been applied).

## Scenario 2 — Apply the backfill

1. Confirm `server/scripts/missing-exercises-data.js` has all 54 entries, each with a real,
   individually-verified `videoUrl` (contracts/exercise-backfill-data.md).
2. From `app/`: `node --env-file=.env.local server/scripts/backfill-missing-exercises.js`.
3. **Expected**: `Added 54 exercise(s). Skipped 0 (already present).`
4. Re-run the same command.
5. **Expected**: `Added 0 exercise(s). Skipped 54 (already present).` — idempotent.

## Scenario 3 — Confirm the gap is closed

1. Re-run: `node --env-file=.env.local server/scripts/check-exercise-coverage.js`.
2. **Expected**: `No coverage gaps — every referenced exercise name has a library match.` (spec
   SC-001, SC-003).

## Scenario 4 — See it render for real

1. `cd app && npm run dev`, open `jaqueline-orellano` or `topiltzin-flores`'s program in the
   dashboard.
2. **Expected**: exercises that previously rendered as plain text (e.g. "Barbell Bench Press",
   "Sentadilla libre / Goblet squat") now render as links to their video (spec SC-002) — no code
   change needed to see this; it's purely a consequence of Scenario 2's new rows.

## Scenario 5 — Prove the check stays useful going forward

1. Temporarily add a new, clearly novel line to any test program's content (e.g. via
   `upsertExercise`-adjacent test tooling, not a real customer's program) referencing an exercise
   name that doesn't exist in the library.
2. Run `check-exercise-coverage.js` again.
3. **Expected**: reports exactly that one new name as missing (spec User Story 2, Scenario 1) —
   proving the check isn't a one-off tied to today's 54, but a durable capability.
4. Revert the temporary addition.

## Automated tests

- `cd app && node --env-file=.env.local --test tests/unit/*.test.js tests/integration/*.test.js`
  (the `npm test` directory-glob form has a pre-existing, unrelated failure on some Node versions —
  see specs/007-exercise-library-migration's implementation notes; this explicit-glob form is the
  proven workaround used throughout that feature's verification).
