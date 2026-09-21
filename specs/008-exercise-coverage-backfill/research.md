# Phase 0: Research — Exercise Library Coverage Backfill

**Date**: 2026-09-21
**Status**: Complete — no NEEDS CLARIFICATION markers (spec had none; no technical unknowns
surfaced — this feature is a straightforward extension of specs/007's already-established data
layer and matching rules).

---

## 1. Where "exercises already used" comes from

**Decision**: Reuse `extractExercises()`/`parseProgramDetail()` (specs/007-exercise-library-
migration, itself building on specs/002's exercise-row-parsing.md contract) against each
customer's `programs.content`, fetched via the existing `getCustomerProgram()`/`listAllCustomers()`
functions in `customer-data.js`. No new parsing logic.

**Rationale**: This is exactly the extraction the video-linking feature already depends on for
rendering — using anything else risks a name-extraction mismatch where the coverage check "sees"
different exercise names than what actually gets rendered. Reusing the identical function
guarantees the two stay in lockstep by construction.

**Alternatives considered**:
- *Re-scan raw Markdown with a fresh regex* — rejected: duplicate logic that could drift from
  `extractExercises()`'s actual matching rules (e.g. its exact recognized-line shape from
  exercise-row-parsing.md), producing a coverage report that doesn't reflect what actually renders.

---

## 2. Separating the check from the backfill

**Decision**: Two scripts — `check-exercise-coverage.js` (read-only, reports gaps) and
`backfill-missing-exercises.js` (writes, reads a curated data file). Not one combined script.

**Rationale**: Spec User Story 2 explicitly wants a repeatable check independent of any specific
backfill — the check has ongoing value every time a new program is written, while the backfill's
data (this round's 54 researched links) is a one-time curated artifact. Bundling them would mean
every future "just check what's missing" run also needs the (by-then-irrelevant) old backfill data
file to exist and stay valid.

**Alternatives considered**:
- *One script that both reports and immediately backfills with placeholder/generic links* —
  rejected: spec FR-004 requires every video link to be real and verified; a single automated pass
  can't do that without either fabricating links (explicitly disallowed, project-wide instruction
  against guessing URLs) or leaving new rows with no link — which defeats User Story 1's whole
  point of closing the coverage gap.

---

## 3. Where the researched video links live before being applied

**Decision**: A plain data module, `missing-exercises-data.js`, exporting an array of
`{ name, category, videoUrl }` — populated during implementation by researching each of the 54
missing names, mirroring how the original `exercise.md` (specs/007) held the source-of-truth data
for the first 39 before migration.

**Rationale**: Keeps the researched content reviewable as a plain file (like `exercise.md` was)
before it's written to the database, and keeps `backfill-missing-exercises.js` itself simple and
reusable (it's just "upsert everything in this data file"), consistent with
`migrate-exercises.js`'s shape.

**Alternatives considered**:
- *Hardcode the upserts directly as sequential `upsertExercise()` calls in the script* — rejected:
  harder to review 54 entries at a glance than a flat data array, and loses the reusable
  "data file in, upserts out" shape the rest of this codebase's migration scripts already use.

---

## 4. Test safety after specs/007's near-miss

**Decision**: Every test touching `upsertExercise()` uses an obviously-fake, namespaced fixture
name (e.g. prefixed `Coverage Test Fixture —`), never a real exercise or program name, and always
cleans up via `t.after()`.

**Rationale**: specs/007's implementation had a real incident — a unit test called
`upsertExercise('Deadlift', {})` intending to only prove validation passed, but once real Supabase
credentials were present it silently executed and wiped the live "Deadlift" row's `video_url`/
`category` (caught and fixed during that feature's implementation, but avoidable). This feature
explicitly designs tests to make that class of mistake structurally harder to repeat.

**Alternatives considered**:
- *Rely on discipline alone (no naming convention)* — rejected precisely because that's what
  specs/007 tried the first time.

---

## 5. Script location: `server/scripts/` vs. `server/migrations/`

**Decision**: `app/server/scripts/`, alongside `publish.js`.

**Rationale**: `server/migrations/` (per its own two existing scripts) is for one-time,
run-once-and-forget data moves (`migrate-data.js`, `migrate-exercises.js`). The coverage check is
the opposite — designed to be re-run indefinitely (spec User Story 2). `backfill-missing-
exercises.js` is arguably migration-shaped (this particular data file is a one-time batch), but
placing it next to its companion check script keeps the two-script pair discoverable together
rather than splitting a tightly-coupled pair across two directories.

**Alternatives considered**:
- *Put both in `server/migrations/`* — rejected: would misfile the reusable check script under a
  directory whose existing convention (and name) signals "run once."
