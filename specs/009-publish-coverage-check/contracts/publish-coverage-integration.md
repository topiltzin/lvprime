# Contract: Publish-Time Coverage Reporting

**Components**:
- `app/server/scripts/check-exercise-coverage.js` — refactored to export `checkCoverage()` and
  `formatCoverageReport()`
- `app/server/scripts/publish.js` — extended with `reportProgramCoverage()`

**Requirement Refs**: FR-001 through FR-007, Data Model → Coverage Report / Coverage Report Text

---

## Interface

### `checkCoverage()` *(check-exercise-coverage.js, new export)*

```
checkCoverage(): Promise<{ customerCount, distinctUsedCount, libraryCount, missing }>
```

The scan-and-diff logic already in today's `main()`, unchanged in behavior, now returning data
instead of only printing it. Read-only — never calls `upsertExercise`/`insert`/`update`.

### `formatCoverageReport(report)` *(check-exercise-coverage.js, new export)*

```
formatCoverageReport({ customerCount, distinctUsedCount, libraryCount, missing }): string
```

Pure function. Produces the exact text `main()` already prints today (Data Model → Coverage Report
Text). `main()` is refactored to `console.log(formatCoverageReport(await checkCoverage()))` —
byte-for-byte identical CLI output to before this feature.

### `reportProgramCoverage()` *(publish.js, new export)*

```
reportProgramCoverage(): Promise<void>
```

Calls `checkCoverage()` then `console.log('\n' + formatCoverageReport(...))`. On any error from
`checkCoverage()`, `console.warn`s a one-line message and returns normally — **never** throws or
rejects. Callers (i.e. `publish.js`'s own `main()`) never need their own try/catch around this call.

## Behavior

1. **Trigger condition** (spec FR-001, FR-005): `publish.js`'s `main()` calls
   `await reportProgramCoverage()` if and only if (a) `syncCoachWrite` succeeded, and (b)
   `fileType === 'program'`. A `notes`/`nutrition_plan` publish never calls it.
2. **Ordering**: `reportProgramCoverage()` runs strictly *after* the publish's own write completes
   successfully — never before, never concurrently with it (research.md §3: keeps a coverage-check
   failure from ever looking like a publish failure).
3. **Never blocking** (spec FR-004): a `checkCoverage()` failure inside `reportProgramCoverage()` is
   caught internally; `publish.js`'s own success output (`Published {slug}/{fileType}: ...`) and
   exit code are completely unaffected.
4. **Full-system scope, not per-customer** (spec Edge Cases): `checkCoverage()` scans every
   customer's programs, same as specs/008's `check-exercise-coverage.js` always has — this feature
   does not narrow it to just the customer being published.
5. **Guarded main()**: `publish.js`'s existing `main().catch(...)` at file scope gets the same
   "only run when executed directly" guard already applied to `migrate-exercises.js`/
   `check-exercise-coverage.js`/`backfill-missing-exercises.js`, since `publish.js` now exports
   `reportProgramCoverage()` (and, transitively, imports from `check-exercise-coverage.js`) for
   test use.

## Acceptance Criteria

- [ ] Publishing a `program` file whose content references an exercise with no library match prints
      a coverage report (via `main()`'s own stdout) listing that exercise, after the `Published
      {slug}/program: ...` line.
- [ ] Publishing a `program` file with full coverage prints `No coverage gaps...` after the
      `Published` line.
- [ ] Publishing a `notes` or `nutrition_plan` file prints no coverage report at all — output is
      identical to today's `publish.js` behavior for those file types.
- [ ] `checkCoverage()`/`formatCoverageReport()` throwing (simulated by an unreachable
      `SUPABASE_URL`) does not prevent the `Published {slug}/{fileType}: ...` success line from
      printing, and does not change `publish.js`'s exit code.
- [ ] `check-exercise-coverage.js`'s own CLI output (run standalone, unrelated to `publish.js`) is
      unchanged from before this feature — the refactor into `checkCoverage()`/
      `formatCoverageReport()` is behavior-preserving for existing usage.

## Testing Checklist

- [ ] Unit tests in `app/tests/unit/exercise-coverage.test.js`: `formatCoverageReport()` given a
      Coverage Report with `missing: []` produces the "No coverage gaps..." text; given one or more
      `missing` entries, produces the header line plus one `"name" — used by: ...` line per entry,
      in the same order given.
- [ ] Integration test in `app/tests/integration/publish-coverage.test.js`: imports
      `reportProgramCoverage()` directly and asserts it resolves (doesn't throw) against live data —
      the happy-path proof for the function in isolation.
- [ ] Integration test in `app/tests/integration/publish-cli.test.js` (the FR-008/spec User Story 2
      Scenario 2 end-to-end proof): writes a disposable fixture customer's `program.md` locally
      (a name not referencing any real exercise in the library), spawns
      `node --env-file=.env.local server/scripts/publish.js <fixture-slug> program` as a real child
      process, asserts its stdout contains both the `Published` line and the fixture exercise name
      under the coverage report, then cleans up the local fixture directory and the fixture
      customer's Supabase rows.
