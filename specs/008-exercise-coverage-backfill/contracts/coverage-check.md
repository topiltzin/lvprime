# Contract: Exercise Coverage Check

**Component**: `app/server/scripts/check-exercise-coverage.js`

**Requirement Refs**: FR-001, FR-002, FR-009, spec User Story 2

---

## Interface

### Input

None (CLI script, no arguments). Reads live data via existing functions only:
- `listAllCustomers()` + `getCustomerProgram(slug)` (`customer-data.js`) for every customer's
  current program content.
- `listExercises()` (`customer-data.js`) for the current library state.

### Output

Console report:

```
Scanned N customer(s), M distinct exercise name(s) referenced.
Library has L exercise(s).
Missing: K

  "Exercise Name A" — used by: slug-1, slug-2
  "Exercise Name B" — used by: slug-3
  ...

(or, if K = 0:)
No coverage gaps — every referenced exercise name has a library match.
```

Exits `0` in both cases (a nonzero missing count is a normal, expected report outcome, not a script
failure — only an actual error, e.g. a Supabase failure, exits nonzero).

## Behavior

1. **Extraction reuse**: for each customer with a program, calls `parseProgramDetail(content,
   renderMarkdown)` (no `videoLinkMap` needed — this script only needs `name`, not `videoUrl`) and
   collects every `weeklySchedule[].exercises[].name` across every day.
2. **Case-insensitive matching, exact otherwise**: a referenced name is "covered" if
   `name.trim().toLowerCase()` matches an existing `exercises.name` the same way (specs/007 FR-007's
   rule, reused verbatim — no fuzzy matching).
3. **Deduplication for the report**: a missing name used by multiple customers is reported once,
   with all referencing customer slugs listed (spec User Story 1, Scenario 3) — never once per
   customer occurrence.
4. **Read-only**: never calls `upsertExercise()` or writes to `programs` — this script only reports
   (spec FR-007, User Story 2).
5. **Repeatable / idempotent by nature**: since it only reads and reports, running it any number of
   times in a row produces the same result for unchanged data, and correctly reflects new gaps the
   moment a new program is written (spec FR-009, SC-003).

## Acceptance Criteria

- [ ] Run against current data (before this feature's backfill lands), reports exactly the 54 names
      below as missing (order not significant; grouped here by which customer's program references
      them, matching the research run that grounded spec SC-001):

  **jaqueline-orellano** (25): Sentadilla libre / Goblet squat · Extensión de pierna · Hip abduction
  · Reverse crunch · Hollow hold · Pull-up progression · Push-up progression · Dumbbell chest press
  · Seated cable row · Lateral raises · Biceps curl · Triceps rope pushdown · Step-up · Leg curl ·
  Pallof press · Plank shoulder taps · One-arm dumbbell row · Incline dumbbell press · Lat pulldown /
  assisted pull-up · Face pull · Biceps curl + Triceps pushdown · Goblet squat / squat · Reverse
  lunge · Hip thrust / glute bridge · Plank frontal

  **topiltzin-flores** (29): Barbell Bench Press · Bent-Over Barbell Rows · Dumbbell Incline Press ·
  Lat Pulldown (Machine) · Cable Chest Fly · Deadlifts (Conventional) · Machine Shoulder Press ·
  Face Pulls · Vertical Chest Machine · Rear Delt Fly Machine · Incline Barbell Press · Weighted
  Pull-ups · Dumbbell Rows · Machine Lateral Raise · Chest Dips (assisted if needed) · Barbell Back
  Squat · Romanian Deadlifts · Leg Curls (Machine) · Calf Raises · Barbell Front Squat · Leg Curl
  (Lying) · Walking Lunges (Dumbbells) · Leg Extension · Seated Calf Raises · Trap Bar Deadlifts ·
  Belt Squat · Bulgarian Split Squats · Leg Press Calf Raises · Abductor Machine

- [ ] Run again after `backfill-missing-exercises.js` has been applied: reports zero missing (spec
      SC-003).
- [ ] Adding a brand-new, not-yet-catalogued exercise name to any customer's program and re-running
      reports exactly that one new name as missing, nothing else (spec User Story 2, Scenario 1).
- [ ] A customer with no program (`programs` row absent) is skipped without error, not treated as
      contributing zero exercises incorrectly or crashing the scan.
- [ ] Never issues a write call of any kind (verified by code review — no `upsert`/`insert`/`update`
      call anywhere in this script).

## Testing Checklist

- [ ] Unit test in `app/tests/unit/exercise-coverage.test.js`: pure diff logic (given a list of
      `{name, slug}` usages and a list of library names, returns the correct missing set, grouped
      by name with all referencing slugs, case-insensitive) — no Supabase involved.
- [ ] Integration test in `app/tests/integration/exercise-coverage.test.js`: runs the real
      extraction + diff against live Supabase data (read-only) and asserts the result is
      internally consistent (every reported "missing" name is genuinely absent from a fresh
      `listExercises()` call) rather than asserting a specific hardcoded count, since the exact
      gap will be zero once this feature's backfill has been applied.
