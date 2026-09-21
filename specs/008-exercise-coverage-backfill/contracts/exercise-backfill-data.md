# Contract: Missing-Exercise Backfill Data & Script

**Components**:
- `app/server/scripts/missing-exercises-data.js` (data)
- `app/server/scripts/backfill-missing-exercises.js` (script — consumes the data)

**Requirement Refs**: FR-003, FR-004, FR-005, FR-006, FR-008, Data Model → Missing-Exercise
Backfill Entry

---

## Interface

### `missing-exercises-data.js`

```js
export const MISSING_EXERCISES: Array<{ name: string, category: string, videoUrl: string }>;
```

One entry per name `contracts/coverage-check.md`'s Acceptance Criteria lists as missing (54 as of
this writing). See Data Model's field table for per-field constraints.

### `backfill-missing-exercises.js`

CLI script, no arguments. For each `MISSING_EXERCISES` entry, calls
`upsertExercise(name, { category, videoUrl })` (specs/007 contracts/exercise-data-api.md,
unchanged). Run via `node server/scripts/backfill-missing-exercises.js` from `app/`.

Console output:
```
Added N exercise(s). Skipped S (already present). Total processed: N + S.
```

## Behavior

1. **Additive only** (spec FR-006): before upserting, checks `listExercises()` for a case-
   insensitive match; if one already exists, skips that entry (reports it as skipped) rather than
   overwriting it — even if `missing-exercises-data.js` is stale or re-run after a name was already
   added another way. Mirrors `migrate-exercises.js`'s own already-present-skip pattern.
2. **Atomic names, verbatim** (spec FR-008): `name` is passed to `upsertExercise()` exactly as
   written in `missing-exercises-data.js` — no splitting on `+`/`/`, no trimming beyond what
   `upsertExercise()` already does internally.
3. **Real links only** (spec FR-004): every `videoUrl` in `missing-exercises-data.js` MUST be a
   link individually verified (during the research step that produced this file) to actually open
   and show a demonstration of that specific exercise — this is a data-authoring rule, not
   something the script itself can enforce at runtime beyond the existing `http(s)` format check
   `upsertExercise()` already performs.
4. **No program writes**: never touches `programs` — purely additive against `exercises` (spec
   FR-007, shared with `coverage-check.md`).
5. **Re-runnable**: running it twice in a row (e.g. after a partial failure) inserts nothing the
   second time — same idempotency guarantee `migrate-exercises.js` already established for the
   original 39, via the same underlying `upsertExercise()` case-insensitive-match behavior.

## Acceptance Criteria

- [ ] Running against a `missing-exercises-data.js` populated with all 54 researched entries adds
      all 54 (spec SC-001), each with a working `video_url` and a category from the five existing
      groupings (or a justified new one, per Data Model's note).
- [ ] Running a second time inserts 0, skips 54.
- [ ] An entry whose `name` already exists in the library (case-insensitively) is skipped without
      overwriting that row's existing `category`/`video_url` — proven with a disposable fixture
      name/row in the integration test, never a real library entry (see plan.md Constraints — test
      safety, following the incident from specs/007's implementation).
- [ ] An entry with a compound name (e.g. `"Biceps curl + Triceps pushdown"`) is added as one row
      with that exact name — never split into two `upsertExercise()` calls.

## Testing Checklist

- [ ] Integration test in `app/tests/integration/exercise-backfill.test.js`: upserts a small,
      disposable, clearly-fake fixture set (2-3 entries with fixture-namespaced names, cleaned up
      via `t.after`) through the same code path `backfill-missing-exercises.js` uses, asserting
      idempotency (second run of the same fixture set inserts 0) and that an already-present fixture
      row's data is left untouched. Does **not** run the real `MISSING_EXERCISES` data against a
      test environment — that's the one-time, already-verified production backfill itself, covered
      by manual verification (quickstart.md), not a repeatable automated test.
