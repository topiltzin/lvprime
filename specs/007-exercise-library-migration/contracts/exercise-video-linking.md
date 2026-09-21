# Contract: Exercise Name → Video Linking

**Extends**: specs/002-premium-studio-redesign/contracts/exercise-row-parsing.md — this contract
adds the `videoUrl` field that document's own "Output" section reserves room for; every rule in
that contract (recognized line shape, per-day fallback, "no write-back," etc.) still applies
unchanged.

**Components**:
- `app/server/markdown-parser.js` → `parseProgramDetail()` / `extractExercises()`
- `app/server/index.js` → `handleGetCustomer` (passes the video-link map through)
- `app/src/components/program-day.js` → `renderExerciseRow()`

**Requirement Refs**: FR-003, FR-004, FR-005, FR-006, FR-007, Data Model → Program amendment

---

## Interface

### Input

- The same per-day `bodyLines` `extractExercises()` already parses (unchanged).
- A `videoLinkMap: Map<string, string>` (lowercased exercise name → video URL), produced by
  `getExerciseVideoLinkMap()` (`exercise-data-api.md`) and passed into `parseProgramDetail()` as a
  new parameter, alongside the existing `renderMarkdown` callback:

  ```
  parseProgramDetail(programMdText, renderMarkdown, videoLinkMap)
  ```

### Output

Each extracted exercise object gains `videoUrl` (see `data-model.md` Program amendment):

```
{
  name: string,
  setsReps: string,
  rest: string | null,
  formTip: string | null,
  videoUrl: string | null   // NEW
}
```

`videoUrl` is computed as `videoLinkMap.get(name.trim().toLowerCase()) ?? null` — no other
transformation of `name` (no accent-stripping, no punctuation normalization beyond
case-folding/trim).

## Behavior

1. **Matching is case-insensitive, exact otherwise** (FR-007): `"Push-up"`, `"push-up"`, and
   `"PUSH-UP"` all resolve to the same map entry; `"Push Up"` (space instead of hyphen) does
   **not** match `"Push-up"` — this is a deliberate no-match, not a bug (spec Edge Cases /
   Assumptions).
2. **No match is not an error** (FR-005): a `null` `videoUrl` is a normal, expected value. The
   day's other fields (`html`, other exercises) are computed exactly as today regardless.
3. **Backend resolves the link, frontend only renders it**: `program-day.js` MUST NOT do its own
   name matching or fetch the exercise library — it only reads `exercise.videoUrl` off the object
   it's given.
4. **Rendering** (`renderExerciseRow()` in `program-day.js`): when `exercise.videoUrl` is
   non-null, the exercise-name element becomes an `<a href="{videoUrl}" target="_blank"
   rel="noopener noreferrer">{name}</a>` instead of a plain `<span>` — the name text itself is the
   link (per spec Assumption: "the exercise's name itself becomes the clickable link"), not a
   separate icon/label appended after it. When `null`, rendering is unchanged from today (plain
   `<span>` with `textContent`).
5. **Applies uniformly to every program view** (FR-006): since resolution happens in
   `parseProgramDetail()`, called from `handleGetCustomer` for every customer profile load, this
   applies to every existing customer's program the same way it applies to newly generated ones —
   no separate "backfill" step is needed for already-stored program content.

## Acceptance Criteria

- [ ] An exercise line whose name matches `videoLinkMap` (any case) renders as a link to the
      mapped URL.
- [ ] An exercise line whose name does not match renders as plain text, identical to current
      behavior, and the rest of that day's card renders normally.
- [ ] A day with `exercises: []` (rest day / no matching lines) is entirely unaffected — this
      contract only touches the `exercises` array's elements, never the `html` fallback path.
- [ ] Passing an empty/absent `videoLinkMap` (e.g. before migration has run, or if the query
      fails-soft) makes every `videoUrl` resolve to `null` — the feature degrades to "no links,"
      never to a thrown error or missing program data.
- [ ] Existing `weeklySchedule[].html` output and every pre-existing `exercises[]` field remain
      byte-identical to today's output (matches exercise-row-parsing.md's own acceptance
      criterion — this feature is additive only).

## Testing Checklist

- [ ] Unit test in `app/tests/unit/markdown-parser.test.js`: same fixtures
      exercise-row-parsing.md already uses (Spanish/English Monday blocks), asserting `videoUrl`
      resolves correctly given a small fixture `videoLinkMap`.
- [ ] Unit test: exercise name present in program but absent from `videoLinkMap` → `videoUrl:
      null`.
- [ ] Unit test: case-mismatched name (map has `"push-up"`, program has `"Push-Up"`) still
      resolves.
- [ ] Integration test in `app/tests/integration/customer-detail.test.js`: full profile load
      against a fixture with a seeded `exercises` table row, asserting the API response's
      `program.weeklySchedule[0].exercises[0].videoUrl` is populated.
- [ ] Manual/DOM check (`program-day.js`): a linked exercise renders an `<a>` with the right
      `href`; an unlinked one still renders a plain `<span>` with the exercise name.
