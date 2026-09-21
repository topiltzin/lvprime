# Quickstart: Publish-Time Exercise Coverage Check

**Purpose**: Runnable steps proving the full "publish → gap surfaced → gap closed → renders" loop,
end-to-end, with a real disposable test customer.

**Prerequisites**: `app/.env.local` has `SUPABASE_URL`/`SUPABASE_SECRET_KEY` set; specs/007's
`exercises` table and specs/008's backfill are already in place (93 exercises expected).

---

## Scenario 1 — A gap is surfaced automatically on publish

1. From the repo root, create a disposable fixture customer's local program file:
   `customers/coverage-check-fixture/program.md` containing one exercise line with a name not in
   the library, e.g. `1. **Totally Novel Publish-Time Exercise** - 3 x 10 - Rest 60s` under a day
   heading.
2. From `app/`: `node --env-file=.env.local server/scripts/publish.js coverage-check-fixture program`.
3. **Expected**: output includes `Published coverage-check-fixture/program: version 0 -> 1`,
   followed by a coverage report listing `"Totally Novel Publish-Time Exercise" — used by:
   coverage-check-fixture` (spec FR-001, FR-003, SC-001, SC-002).

## Scenario 2 — Close the gap, see it render, no re-publish

1. Add a real, verified video link for that exact name to the library (same mechanism as specs/
   008's backfill — one `upsertExercise` call).
2. Re-view `coverage-check-fixture`'s program (e.g. via `getExerciseVideoLinkMap()` +
   `parseProgramDetail()`, same read path as every other customer).
3. **Expected**: the exercise now has a `videoUrl` — no re-publish needed (spec FR-007, SC-003).

## Scenario 3 — The check never blocks the publish

1. Publish a program with full exercise coverage (e.g. re-publish `jaqueline-orellano`'s or
   `topiltzin-flores`'s existing content).
2. **Expected**: `Published ...` line followed by `No coverage gaps...` — publish succeeds
   identically whether or not gaps exist (spec FR-004, SC-004).

## Scenario 4 — Non-program publishes are unaffected

1. `node --env-file=.env.local server/scripts/publish.js <any-existing-slug> notes`.
2. **Expected**: only the `Published .../notes: ...` line — no coverage report at all (spec FR-005).

## Cleanup (after Scenarios 1-2)

1. Delete the local fixture directory: `rm -rf customers/coverage-check-fixture`.
2. Delete the fixture customer's Supabase row (cascades to its program row) — e.g. via
   `supabase.from('customers').delete().eq('slug', 'coverage-check-fixture')`.
3. Delete the fixture exercise added in Scenario 2 from the `exercises` table, unless it's a real
   exercise worth keeping.

## Automated tests

- `cd app && node --env-file=.env.local --test tests/unit/*.test.js tests/integration/*.test.js`
  (the `npm test` directory-glob form has the pre-existing, unrelated Node v24 failure noted in
  specs/007's implementation).
