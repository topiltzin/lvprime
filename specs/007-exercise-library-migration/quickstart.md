# Quickstart: Exercise Library Migration & Video Linking

**Purpose**: Runnable steps to validate this feature end-to-end once implemented, from schema
creation through seeing a linked exercise in the dashboard, to safely removing `exercise.md`.

**Prerequisites**:
- `app/.env.local` has `SUPABASE_URL` / `SUPABASE_SECRET_KEY` set (see
  `app/.env.example`, same as specs/006's quickstart).
- specs/006's schema (at least `customers`, `programs`) already exists in that Supabase project.
- Dependencies installed: `cd app && npm install`.

---

## Scenario 1 — Create the schema

1. Open Supabase Dashboard → SQL Editor → New Query.
2. Paste and run the DDL from `contracts/database-schema.md`.
3. **Expected**: `exercises` table and `idx_exercises_name_lower` index exist; no errors.

## Scenario 2 — Migrate `exercise.md` into the table

1. From `app/`: `node server/migrations/migrate-exercises.js`.
2. **Expected**: console output reports one migrated row per exercise in `exercise.md` (~40),
   idempotent — re-running reports "already present" for each, inserts nothing new, and exits 0.
3. Verify completeness (spec SC-001):
   ```js
   import { listExercises } from './server/lib/customer-data.js';
   const rows = await listExercises();
   console.log(rows.length); // expect it to match exercise.md's row count exactly
   ```
   Spot-check a few `name`/`video_url` pairs against `exercise.md` by eye.

## Scenario 3 — See a linked exercise in the dashboard

1. `cd app && npm run dev`.
2. Open a customer whose `program.md` (now `programs.content`) contains an exercise also present
   in `exercises` (e.g. "Push-up", "Squat", "Plank" — all present in the migrated set).
3. **Expected**: that exercise's name renders as a clickable link (per
   `contracts/exercise-video-linking.md`) opening its demo video in a new tab; an exercise with no
   match still renders as plain text, and the rest of the program renders unchanged.

## Scenario 4 — Update a video link and see it propagate

1. `upsertExercise('Squat', { videoUrl: 'https://www.youtube.com/watch?v=<new-id>' })` (via a
   Node REPL/script importing `customer-data.js`, or directly via the Supabase table editor).
2. Reload any customer program containing "Squat" in the dashboard (no code redeploy, no program
   edit).
3. **Expected**: the link now points at the new URL (spec SC-005) — confirms linking is resolved
   at read time, not baked into stored program content.

## Scenario 5 — Retire `exercise.md`

1. Confirm Scenario 2's completeness check passed (every row migrated).
2. Confirm Scenario 3 works with the dev server running and `exercise.md` **temporarily renamed**
   (not yet deleted) — proves nothing at runtime still reads the file.
3. Delete `exercise.md` from the repository.
4. Re-run Scenario 3 end-to-end once more against the running app.
5. **Expected**: identical behavior to step 2 — the app never depended on the file's presence.

## Automated tests

- `cd app && npm test` — runs the full `node --test tests/` suite, including the new/extended
  cases from `contracts/exercise-data-api.md` and `contracts/exercise-video-linking.md`'s Testing
  Checklists.
