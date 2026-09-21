# Feature Specification: Publish-Time Exercise Coverage Check

**Feature Branch**: `[009-publish-coverage-check]`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "check the migration scripts for the new workout for new customer and validate and if no, add the link for the video once we migrate it on db and tested with a new customer."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coverage gaps are surfaced the moment a program is published (Priority: P1)

As the coach, when I publish a new customer's workout program into the system — or update an
existing customer's program — I'm immediately told whether any exercise in it is missing a video
link, without having to remember to separately run a coverage check afterward.

**Why this priority**: specs/008-exercise-coverage-backfill built a coverage check, but nothing
runs it automatically at the one moment it matters most — right when new workout content actually
enters the system. Without this, the same 54-exercise-style gap this project already hit once can
silently reopen every time a new customer (or a new season of a program) is onboarded, and nobody
finds out until someone happens to run the check by hand. This is the entire point of the
request — closing the loop so a coverage gap can't quietly reappear the next time someone is
onboarded.

**Independent Test**: Publish any customer's program (new or existing) and confirm the coverage
result — gaps found, or none — is reported as part of that same publish action, without running any
separate command.

**Acceptance Scenarios**:

1. **Given** a customer's program being published references an exercise name with no library
   match, **When** the publish completes, **Then** that exercise name is reported to the coach in
   the same action, exactly as specs/008's coverage check already reports it (name + which
   customer(s) reference it).
2. **Given** every exercise in a published program already has a library match, **When** the
   publish completes, **Then** the coach sees a clear "no gaps" result, not silence or an error.
3. **Given** the coach is publishing a `notes` or `nutrition_plan` file (not a `program`), **When**
   the publish completes, **Then** no exercise-coverage check runs for it — there's nothing
   exercise-related in that content to check.
4. **Given** a program has coverage gaps, **When** it's published, **Then** the publish itself still
   succeeds — the gap report never blocks or fails the publish.

---

### User Story 2 - A surfaced gap gets closed and proven end-to-end (Priority: P2)

As the coach, once I'm told an exercise is missing its video link, I can add a real one to the
library, and see it show up for the customer whose program introduced it — and this whole path has
actually been proven with a real new customer, not just described.

**Why this priority**: Detection alone (User Story 1) doesn't help if closing the gap is unclear or
unproven. This is the "and if no, add the link... tested with a new customer" half of the request —
it validates the feature actually works by exercising it for real, not just building the alarm bell.

**Independent Test**: Publish a genuinely new test customer's program containing one exercise name
that has no library entry; confirm it's reported (User Story 1); add a real video link for it;
confirm that same customer's program now renders it as a link with no re-publish needed.

**Acceptance Scenarios**:

1. **Given** a newly reported gap, **When** a real, verified video link is added to the library for
   that exact exercise name, **Then** every customer's program referencing that name — including the
   one that surfaced the gap — renders it as a link the next time it's viewed, with no changes to
   the program content itself.
2. **Given** this feature is being validated, **When** a new test customer is published through the
   real publish path with a deliberately novel exercise name, **Then** the gap is detected (User
   Story 1, Scenario 1), closed (this story, Scenario 1), and confirmed rendering — proving the
   whole loop, not just its individual pieces in isolation.

---

### Edge Cases

- A program with no extractable exercise lines at all (e.g. a rest-day-only or pure-prose program)
  reports zero gaps for that publish, without erroring — matches specs/008's existing check
  behavior for a customer with no exercises.
- The coverage report reused here checks every customer's programs, not only the one just
  published (reusing specs/008's existing check as-is) — at this project's current scale (a
  handful of customers) that's a feature, not a problem: the coach sees the full picture on every
  publish, not an artificially narrowed one.
- Publishing the same program content twice in a row (no actual change) still runs and reports the
  check both times — this feature doesn't add change-detection to skip a redundant check.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a coach publishes a customer's `program` content, the system MUST run an
  exercise-coverage check against the exercise library immediately as part of that same action.
- **FR-002**: The check MUST reuse the exact matching and reporting behavior already established in
  specs/008-exercise-coverage-backfill (case-insensitive, exact match; per-name list of referencing
  customers) — not a new or different comparison rule.
- **FR-003**: The coverage result MUST be shown to the coach as part of the publish action's own
  output — no separate command required to learn whether the just-published content introduced a
  gap.
- **FR-004**: The coverage check MUST NOT block, delay meaningfully, or fail the publish — a program
  with missing video coverage still publishes successfully every time.
- **FR-005**: Publishing a `notes` or `nutrition_plan` file MUST NOT trigger an exercise-coverage
  check — only `program` publishes are relevant.
- **FR-006**: The coach MUST be able to close a reported gap by adding one real, individually
  verified video link for that exact exercise name to the library — fabricated or guessed links are
  never acceptable, consistent with every prior feature in this project's exercise-library work.
- **FR-007**: Once a gap is closed, every customer's program referencing that exercise name —
  including whichever one originally surfaced the gap — MUST render it as a video link the next
  time it's viewed, without needing to be re-published or otherwise re-touched.
- **FR-008**: This feature MUST be validated by actually publishing a new test customer's program,
  through the real publish path, containing at least one exercise name absent from the library —
  confirming detection, closing the gap, and confirming it then renders — not merely asserted to
  work.

### Key Entities

- **Exercise** *(existing, specs/007)*: unchanged structure; this feature's gap-closing step adds
  rows to it the same way specs/008's backfill did.
- **Program** *(existing)*: read at publish time to extract exercise names for the check; never
  modified by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every program publish tells the coach, within that same action, whether it introduced
  any exercise with no video link — zero cases where a coach has to separately remember to check.
- **SC-002**: A newly onboarded customer whose program references an exercise not yet in the library
  has that gap surfaced automatically, with no prior knowledge required that the exercise was new.
- **SC-003**: Closing a reported gap requires editing only the shared exercise library — zero edits
  to any customer's program content.
- **SC-004**: Publishing a program with coverage gaps takes the same path and succeeds the same way
  as publishing one without gaps — the check adds a report, never a failure.
- **SC-005**: The complete loop — publish a new customer with a novel exercise, see it flagged,
  add its real video link, see it render for that customer — is demonstrated with one actual new
  test customer, end-to-end, not simulated piecewise.

## Assumptions

- "The migration scripts for the new workout for new customer" refers to this project's actual
  new-customer-onboarding data path, `app/server/scripts/publish.js` — which creates a new customer
  in Supabase (if one doesn't exist yet) and pushes their program content — not
  `migrate-data.js`/`migrate-exercises.js` (specs/006/007's one-time bulk migrations of
  already-existing data, which have already run and aren't part of onboarding a new customer).
- The coverage check triggered here is the same one already built in
  specs/008-exercise-coverage-backfill, reused as-is — this feature doesn't introduce new matching
  or diffing logic.
- Reported gaps are closed exactly the way specs/008's backfill closed them: one real, verified
  video link per missing exercise name added to the shared library — never a fabricated URL, never
  a required/blocking step before the coach's publish can succeed.
- "Tested with a new customer" means an actual disposable/test customer published through the real
  `publish.js` path for validation purposes, not a permanent addition to the real customer roster —
  mirroring the test-safety convention already established in specs/008-exercise-coverage-backfill's
  research.md (never leaving fixture data behind).
- The check reused here scans every customer's programs (as specs/008 already built it), not only
  the one just published — narrowing it to a single customer is out of scope for this feature.
