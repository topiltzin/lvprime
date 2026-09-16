# Contract: Weekly Progression Parsing

**Function**: `parseProgramDetail()` (`app/server/markdown-parser.js`)
**Requirement Refs**: FR-004, FR-005

---

## Interface

### Input

The full text of a customer's `program.md`, exactly as read from disk today (no new input
parameter — `weeklyProgression` extraction happens as part of the existing
`parseProgramDetail(programMdText, renderMarkdown)` call).

### Output (new field)

`weeklyProgression: { weekNumber: number, text: string }[]` added to the object already
returned by `parseProgramDetail()`, alongside the unchanged `weeklySchedule` and
`progressionHtml`.

### Matching rule

- Scan for a heading section whose text matches `Progresi[oó]n Semanal|Weekly Progression`
  (same section `progressionHtml` already captures).
- Within that section, each bullet line matching `**Semana N:**` or `**Week N:**` (case
  insensitive, `N` a integer) becomes one entry: `{ weekNumber: N, text: <rest of the line,
  trimmed> }`.
- Entries where `N` is not in `1..4` are dropped — this feature's UI only ever has four week
  selectors (spec.md's fixed 4-week structure), so an out-of-range entry has nowhere to
  display and must not silently attach to the wrong week.
- If the program has no matching section at all, `weeklyProgression` is `[]` — never `null`
  and never an error.
- Order of `weeklyProgression` follows document order; duplicate week numbers (malformed
  authoring) keep the **first** occurrence only, since a program.md with two `Semana 2:`
  lines is an authoring mistake this parser should not amplify by picking arbitrarily.

## Behavior Notes

- This is a pure extension of the existing section-scanning approach used for
  `progressionHtml` — it does not change or remove `progressionHtml`, which keeps rendering
  the full section verbatim as it does today (still shown independent of per-week
  selection).
- No change to how `program.md` files are authored is required; existing customer files with
  or without a weekly progression section both parse without error.

## Acceptance Criteria

- [ ] A program.md with a well-formed 4-entry weekly progression section produces
      `weeklyProgression` with exactly 4 entries, `weekNumber` 1 through 4, `text` matching
      the authored bullet content.
- [ ] A program.md with no weekly progression section produces `weeklyProgression: []`.
- [ ] A program.md whose weekly progression section only covers some weeks (e.g. 1 and 3)
      produces exactly those entries — no synthetic entries for the missing weeks.
- [ ] A program.md with an out-of-range week number (e.g. `Semana 5:`) does not include that
      entry in `weeklyProgression`, and parsing the rest of the file is unaffected.

## Testing Checklist

- [ ] `tests/unit/markdown-parser.test.js` — new cases per the acceptance criteria above.
- [ ] `tests/integration/customer-detail.test.js` — the customer detail API response includes
      `weeklyProgression` on the `program` object.
