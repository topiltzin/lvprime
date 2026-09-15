# Contract: Exercise Row Extraction

**Component**: `parseProgramDetail()` (`app/server/markdown-parser.js`)
**Requirement Refs**: FR-009, FR-010, FR-011, Data Model → Exercise

---

## Interface

### Input

The Markdown body of one `TrainingDay` (the same `bodyLines` block already extracted per day,
before it is passed to `renderMarkdown()` for the existing `html` field). Content may be
authored in Spanish or English and is never rewritten by this feature.

### Output

Each `TrainingDay` gains an `exercises` array (see data-model.md → Exercise). Every element:

```
{
  name: string,          // e.g. "Sentadilla libre / Goblet squat" | "Barbell Bench Press"
  setsReps: string,      // e.g. "3 x 8-10" | "4 × 6-8 reps"        — kept as authored text
  rest: string | null,   // e.g. "90-120 seg" | "2 min"             — null if no rest segment found
  formTip: string | null // from the next "- Forma:"/"- Form tip:" line, else null
}
```

### Recognized line shape

A numbered list item whose first bolded run is the exercise name, followed by one or more
dash-separated segments, the last of which names the rest period:

```
<N>. **<name>** [(<parenthetical>)] - <sets x reps segment> - <Descanso|Rest> <duration>
```

optionally followed, on the very next line, by an indented bullet whose label matches
`Forma:`/`Form tip:`/`Form:`, whose remaining text becomes `formTip`.

## Behavior

1. **Language-agnostic matching**: The "rest" label is matched case-insensitively against both
   `Descanso` and `Rest` (and the form-tip label against `Forma`/`Form tip`/`Form`); the
   exercise `name`, `setsReps`, and `formTip` values themselves are captured verbatim and never
   translated, reformatted, or corrected.
2. **Partial match is not a match**: A line must contain a bolded name AND a rest segment to
   become an `Exercise`. A line with only a bolded name (no dash-separated sets/rest) is left
   out of `exercises` for that day — it does not produce a partially-filled row.
3. **Per-day fallback, not per-file**: `exercises` is computed independently per day. A day
   where zero lines match yields `exercises: []` for that day only; other days in the same
   program are unaffected.
4. **Never a substitute for `html`**: The existing `html` field on each day is always still
   populated exactly as it is today. `exercises` is additive.
5. **No write-back**: This is a read-only transform for API responses. `program.md` on disk is
   never modified by this parsing.

## Acceptance Criteria

- [ ] A day matching the pattern in Spanish (`Descanso`, `Forma`) produces one `Exercise` per
      matching line, in source order.
- [ ] A day matching the pattern in English (`Rest`, `Form tip`) produces the same shape.
- [ ] A day whose body has no matching lines (e.g. a rest day described only in prose) produces
      `exercises: []` and its `html` field is unchanged/non-empty.
- [ ] An exercise line without a following form-tip bullet produces `formTip: null`, not a
      missing field or a thrown error.
- [ ] Existing `weeklySchedule[].html` output is byte-identical to today's output for every day
      (this feature adds a field, it does not change existing ones).

## Testing Checklist

- [ ] Unit test in `app/tests/unit/markdown-parser.test.js` using a fixture matching
      `customers/jaqueline-orellano/program.md`'s Monday block (Spanish, with form tips)
- [ ] Unit test using a fixture matching `customers/topiltzin-flores/program.md`'s Monday block
      (English, with form tips)
- [ ] Unit test for a rest-day-style body with no numbered exercise lines → `exercises: []`
- [ ] Integration test in `app/tests/integration/customer-detail.test.js` asserting
      `program.weeklySchedule[0].exercises` is present and non-empty for a fixture program
