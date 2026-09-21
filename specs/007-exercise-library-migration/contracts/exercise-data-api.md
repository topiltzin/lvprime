# Contract: Exercise Library Data Access

**Component**: `app/server/lib/customer-data.js` (new exports, following this file's existing
`get*`/`upsert*` function patterns — see `getCustomerNotes`, `upsertCustomer`)

**Requirement Refs**: FR-001, FR-003, FR-007, FR-008, FR-010, Data Model → Exercise

---

## Interface

### `listExercises()`

```
listExercises(): Promise<Array<{ id, name, category, video_url, updated_at }>>
```

Returns every row in `exercises`, unfiltered, ordered by `name`. Used by the migration-
verification step (spec SC-001) and any future exercise-library listing UI.

- Throws `DatabaseError` on a Supabase error (same convention as every other `get*`/`list*`
  function in this file).

### `getExerciseVideoLinkMap()`

```
getExerciseVideoLinkMap(): Promise<Map<string, string>>
```

Loads the full `exercises` table in one query and returns a `Map` keyed by
`name.trim().toLowerCase()` to `video_url` — **only** for rows where `video_url` is non-null/
non-empty. This is the lookup structure `parseProgramDetail()` consumes to resolve each exercise
line's `videoUrl` (see `exercise-video-linking.md`), so an exercise with no link simply has no
entry in the map, and a miss is a fast `Map.get() === undefined` check.

- One query, not N — this is the function that keeps FR-per-exercise linking inside the existing
  <500ms customer-profile-load budget (plan.md Performance Goals).
- Throws `DatabaseError` on a Supabase error.

### `upsertExercise(name, { category, videoUrl })`

```
upsertExercise(name: string, { category?: string | null, videoUrl?: string | null }): Promise<ExerciseRow>
```

Inserts a new exercise or updates the existing one matched case-insensitively by `name` (mirrors
`upsertCustomer`'s `onConflict` pattern, but conflict target is the functional unique index on
`LOWER(name)`). Used by both `migrate-exercises.js` (initial migration) and any future
coach-facing "add/edit exercise" action (spec FR-010).

- `name` MUST be a non-empty string ≤255 chars → else `ValidationError('name', ...)`.
- `videoUrl`, if provided and non-null, MUST match `/^https?:\/\//` → else
  `ValidationError('videoUrl', ...)`.
- Bumps `updated_at` to `new Date().toISOString()` on every call (insert or update), matching
  every other `upsert*` function in this file.
- Throws `DatabaseError` on a Supabase error.

## Behavior

1. **Read path never touches `exercise.md`**: none of these functions read the filesystem; they
   only talk to the `exercises` table. Once the migration has run, `exercise.md` has no runtime
   dependents (spec FR-009, US3 Scenario 2).
2. **Case-insensitive identity**: `upsertExercise('Push-Up', ...)` called after
   `upsertExercise('push-up', ...)` updates the same row rather than creating a duplicate (spec
   FR-008).
3. **No cross-table joins**: consistent with the Data Model's "logical only" relationship to
   `Program` — these functions never accept or return a `customer_id`.

## Acceptance Criteria

- [ ] `listExercises()` returns all rows, alphabetically by `name`.
- [ ] `getExerciseVideoLinkMap()` excludes rows with `video_url IS NULL` or `''` from the returned
      `Map`.
- [ ] `getExerciseVideoLinkMap()` issues exactly one Supabase query regardless of table size.
- [ ] `upsertExercise('Push-up', { videoUrl: 'https://...' })` followed by
      `upsertExercise('PUSH-UP', { category: 'Strength' })` results in exactly one row in
      `exercises`, with both the video link and the category set.
- [ ] `upsertExercise('', { videoUrl: 'https://x' })` throws `ValidationError` on `name`.
- [ ] `upsertExercise('Deadlift', { videoUrl: 'not-a-url' })` throws `ValidationError` on
      `videoUrl`.

## Testing Checklist

- [ ] Unit tests in `app/tests/unit/customer-data.test.js` (or a new
      `app/tests/unit/exercise-data.test.js`, matching this file's existing per-module test-file
      convention) covering each acceptance criterion above against a mocked/stubbed Supabase
      client.
- [ ] Integration test verifying `getExerciseVideoLinkMap()` round-trips through a real
      `upsertExercise()` write in a test Supabase project/schema.
