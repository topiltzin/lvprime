# Feature Specification: Exercise Library Coverage Backfill

**Feature Branch**: `[008-exercise-coverage-backfill]`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Check the list of exercises already used and add it the missing ones on the table and the link on the missing ones."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every real customer workout gets video coverage (Priority: P1)

As the coach, every exercise name that actually appears in any current customer's workout program
has a matching entry in the central exercise library, complete with a video link — not just the
generic starter set the library launched with, but the specific exercises real customers are
actually doing.

**Why this priority**: This is the entire point of the request. The exercise-video-linking feature
only pays off where the library's names actually match what's written in real programs; right now
most of what customers are doing has no match at all, so the link-rendering capability is
effectively invisible to them.

**Independent Test**: For a given customer's program, list every exercise name it contains and
confirm each one now resolves to a video link when the program is viewed — independently
verifiable per customer, without needing every other customer's gap closed first.

**Acceptance Scenarios**:

1. **Given** a customer's program references an exercise name not currently in the library (e.g.
   "Barbell Bench Press", "Sentadilla libre / Goblet squat"), **When** the backfill runs, **Then**
   that exact name gets a new library entry with a video link, and the customer's program now
   renders that exercise as a link.
2. **Given** an exercise name that's already in the library (case-insensitively), **When** the
   backfill runs, **Then** that entry is left as-is — the process adds only what's missing, it
   never overwrites or duplicates an existing entry.
3. **Given** two different customers both use an exercise name that's missing from the library,
   **When** the backfill adds it once, **Then** both customers' programs pick up the same new
   entry's link the next time their program is viewed.

---

### User Story 2 - Coverage gaps don't silently reappear (Priority: P2)

As the coach, after this backfill I can re-check exercise-library coverage at any later point (e.g.
after writing a new customer's program with exercises I haven't used before) and get a clear list
of what's still missing, without having to manually compare program content against the library by
eye.

**Why this priority**: The library will keep drifting behind real usage every time a program is
written with a not-yet-catalogued exercise name — this closes today's gap but the same gap reopens
with the very next new program unless checking for it is easy to repeat.

**Independent Test**: Add a new, clearly novel exercise name to a test program, run the coverage
check, and confirm it's reported as missing — without needing to touch any other customer's data.

**Acceptance Scenarios**:

1. **Given** a program contains an exercise name with no library match, **When** the coverage check
   runs, **Then** that name is reported as missing, identified exactly as written in the program
   (no silent renaming or merging with a similarly-named entry).
2. **Given** every exercise name in every current program already has a library match, **When** the
   coverage check runs, **Then** it reports zero gaps rather than erroring or requiring special
   handling for the "nothing missing" case.

---

### Edge Cases

- Two different exercise names that are really the same movement in different words (e.g.
  "Sentadilla libre / Goblet squat" in Spanish vs. the library's existing "Squat", or "Lat Pulldown
  (Machine)" vs. an existing "Lat Pulldown") are **not** merged or treated as a match — matching
  stays exact (case-insensitive only), consistent with the existing library's matching rule,
  established in specs/007-exercise-library-migration FR-007. Each distinct string a program
  actually uses gets its own entry. This is a known, accepted tradeoff, not something this feature
  resolves.
- A single workout line naming more than one exercise together (e.g. "Biceps curl + Triceps
  pushdown") is treated as one atomic name to add, exactly as authored — it is not split into two
  separate library entries.
- A missing exercise name that appears in more than one customer's program (e.g. a generic name
  used by two different customers) is added once; both programs benefit from the same new entry.
- No customer program currently has zero library matches, nor does any program have full coverage
  already — but the check must handle either case without special-casing it (see User Story 2,
  Scenario 2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST identify every distinct exercise name currently referenced across all
  customers' active workout programs.
- **FR-002**: System MUST compare that list against the exercise library's existing entries,
  case-insensitively and otherwise exactly (same matching rule as specs/007's FR-007), to determine
  which referenced names have no library entry.
- **FR-003**: System MUST add one library entry, with a name and a video link, for every exercise
  name identified as missing.
- **FR-004**: Every video link added MUST point to a real, currently-accessible video that actually
  demonstrates that specific exercise — links MUST be verified to exist, never guessed or
  fabricated.
- **FR-005**: Each newly added entry MUST be assigned a category consistent with the groupings
  already used in the library (e.g. Strength — Upper Body, Strength — Lower Body, Core, Cardio,
  Flexibility & Mobility), chosen based on what the exercise actually is.
- **FR-006**: System MUST NOT modify, overwrite, or duplicate any exercise name already present in
  the library — the process only adds entries for names that have no existing match.
- **FR-007**: System MUST NOT modify any customer's program content — this only adds to the
  exercise library; it never rewrites how an exercise is named in a program.
- **FR-008**: A single program line naming more than one exercise together MUST be treated and
  added as one atomic exercise name, exactly as it's written — it MUST NOT be split into multiple
  library entries.
- **FR-009**: The comparison-and-backfill process MUST be repeatable: running it again after new
  exercise names have been introduced (e.g. in a newly written customer program) MUST identify only
  the newly introduced gaps, without re-adding or duplicating anything already covered.

### Key Entities

- **Exercise** *(existing entity, specs/007-exercise-library-migration)*: gains new rows through
  this feature — no structural change, just additional name/category/video-link entries for names
  that real customer programs already use.
- **Program** *(existing entity)*: read-only input to this feature — its content is scanned for
  exercise names but never modified.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the exercise names currently referenced across all customers' active programs
  have a matching library entry with a video link (as of this writing: 60 distinct names in use
  across current programs, 39 already covered, 54 to be added by this feature).
- **SC-002**: Every customer's program view shows a working video link for every exercise it
  contains that has a library match — for the two customers with real authored programs today, that
  means full coverage, not just the handful of generic exercises that happened to overlap before.
- **SC-003**: Re-running the coverage check after this feature ships reports zero missing exercises
  for current program content, and correctly reports only the new gap when a not-yet-catalogued
  exercise name is later introduced in a new or updated program.
- **SC-004**: Every video link added resolves to a real, viewable video demonstrating the specific
  exercise it's attached to — spot-checkable by opening any newly added link.

## Assumptions

- "The list of exercises already used" means every exercise name `extractExercises()`
  (specs/007-exercise-library-migration) already parses out of each customer's current program
  content — the same structured extraction the video-linking feature already relies on, not a
  separate/new way of reading program text.
- Matching stays exact (case-insensitive), per specs/007's established FR-007 — this feature does
  not introduce fuzzy or semantic matching to merge near-duplicate names (e.g. translated or
  reworded versions of the same movement); each distinct name gets its own entry if it doesn't
  match one already there.
- New entries' video links are sourced the same way the original 39-exercise library was populated:
  real, individually verified videos, not a single generic placeholder reused across many entries.
- This is a one-time backfill against today's data, made repeatable (User Story 2) so it can be
  re-run later rather than needing to be re-specified each time — it does not add any new
  automatic/scheduled trigger (e.g. running on every program save) as part of this feature.
- "On the table" refers to the `exercises` table introduced in
  specs/007-exercise-library-migration — this feature extends that same table, it does not
  introduce a new storage location.
