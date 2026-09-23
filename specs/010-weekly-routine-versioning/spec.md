# Feature Specification: Independent Weekly Routines with History Tracking

**Feature Branch**: `010-weekly-routine-versioning`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Permite que un cliente tenga rutinas semanas, independientes, y permite la update de entrenamiento semansl pero permite el tracking de las rutinas pasadas." (Allow a customer to have independent weekly routines, allow updating the weekly training, and allow tracking of past routines.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Give a customer a genuinely different routine for a new week (Priority: P1)

A coach is viewing a customer's program and decides the customer needs a different day-by-day
routine starting this week — not just a revised note about reps or weight, but a different set
of exercises entirely (e.g. switching from a machine-based split to a calisthenics-and-weights
hybrid). The coach records this new routine as the routine for the current/upcoming week. When
the coach or customer views that week, they see the new routine. When they look at any earlier
week, they still see exactly what was assigned back then, unchanged.

**Why this priority**: This is the core capability the feature exists to deliver. Today the
system can only show one repeating schedule under every week — a coach cannot actually change
what exercises a customer does from one week to the next, only tweak a short progression note.
Without this, none of the other stories have anything to build on.

**Independent Test**: Can be fully tested by assigning a new, distinctly different routine to a
customer's current week, then confirming the previous week's routine is still shown, unchanged,
when that earlier week is selected.

**Acceptance Scenarios**:

1. **Given** a customer with an existing routine for week 1, **When** the coach defines a new,
   different routine for week 2, **Then** viewing week 2 shows the new routine and viewing week 1
   still shows the original routine, unchanged.
2. **Given** a customer with routines defined for weeks 1 and 2, **When** the coach views week 1,
   **Then** the exercises, sets, reps, and form guidance shown match exactly what was originally
   recorded for week 1, not week 2's content.

---

### User Story 2 - Update the current week's training as the customer progresses (Priority: P2)

A coach needs to adjust the routine the customer is actively following right now — for example,
swapping an exercise that's aggravating an injury, or increasing volume based on how the
customer is responding. The coach updates the current week's routine in place. Past weeks are
not affected by this update.

**Why this priority**: Depends on User Story 1 existing (independent per-week routines), and
extends it with the ability to revise a week's routine after it was first created, which is the
normal day-to-day coaching action (this is exactly the situation that surfaced the need for this
feature: a coach revising a customer's plan mid-program).

**Independent Test**: Can be fully tested by editing an already-defined week's routine (e.g.
swapping one exercise for another) and confirming the change is reflected immediately, while
every other week's routine remains untouched.

**Acceptance Scenarios**:

1. **Given** a customer's current week already has a defined routine, **When** the coach edits
   that routine (adds, removes, or changes an exercise), **Then** the updated routine is what's
   shown for that week going forward.
2. **Given** a customer's current week is edited, **When** the coach views a different, unedited
   week, **Then** that week's routine is exactly as it was before the edit.

---

### User Story 3 - Look back at what a customer was training in a past week (Priority: P3)

A coach (or the customer) wants to review what routine was assigned in a specific past week —
for example, to check progression, answer "what was I doing three weeks ago," or diagnose a
pattern in feedback against what was actually prescribed at the time. They select a past week
and see that week's routine exactly as it was originally recorded.

**Why this priority**: This is the "tracking" half of the request. It depends on Stories 1 and 2
already being in place (there must be more than one distinct, preserved weekly routine before
there's anything to look back at), and it delivers standalone value once they are: a real,
browsable history instead of routines silently being lost when overwritten.

**Independent Test**: Can be fully tested by creating routines across several weeks (with at
least one later update, per Story 2), then navigating back to an earlier week and confirming its
routine is still intact and viewable in full.

**Acceptance Scenarios**:

1. **Given** a customer has been coached across multiple weeks with different routines each week,
   **When** a past week is selected, **Then** the full routine assigned that week (all days,
   exercises, sets/reps, and form guidance) is shown, exactly as originally recorded.
2. **Given** a routine for a past week, **When** it is viewed, **Then** it is visually clear that
   this is a past week's routine rather than the customer's current one.

---

### Edge Cases

- What happens when a customer only has a routine for week 1 and no later weeks have been
  defined yet? The system must still show week 1 normally and make clear that later weeks have
  no routine assigned yet, without erroring.
- What happens if a coach tries to reuse the same day-of-week structure (e.g. "Monday") across
  two different weeks' routines? Each week's routine must stay fully independent — no exercises
  from one week must appear under another week's routine (this is the exact failure this feature
  replaces).
- What happens when a new customer is created with only a single starting routine? They should
  behave as they do today (one active routine) until a second week's routine is ever defined.
- What happens if a coach tries to view or edit a week number that doesn't exist for that
  customer yet? The system must clearly indicate no routine has been assigned for that week,
  rather than showing stale or unrelated content.
- What happens if a coach attempts to edit a past week's routine once it's locked (FR-008)? The
  system must block the edit and make clear why, rather than silently discarding the attempt or
  applying it anyway.
- What happens as a customer's history grows over many months of coaching (dozens of weeks)?
  The week selector must remain usable (e.g. navigable/scrollable) rather than breaking down or
  becoming unusable as the week count grows well past today's fixed 4.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a coach to define a distinct, independent day-by-day routine
  (exercises, sets, reps, rest, and form guidance) for each week of a customer's program.
- **FR-002**: Viewing one week's routine MUST NOT show exercises or schedule content that belongs
  to a different week.
- **FR-003**: The system MUST allow a coach to update the routine of the customer's current
  (or any) week without altering the recorded routine of any other week.
- **FR-004**: The system MUST retain every previously defined weekly routine so it remains
  viewable later, rather than being discarded when a newer week's routine is created.
- **FR-005**: The system MUST allow a coach or customer to select and view any past week's
  routine exactly as it was recorded, including which exercises, sets/reps, rest, and form tips
  were assigned that week.
- **FR-006**: The system MUST clearly indicate, wherever a routine is shown, which week it
  belongs to and whether that week is the current one or a past one.
- **FR-007**: The system MUST continue to correctly display a customer whose program only has a
  single week's routine defined, without requiring every customer to have multiple weeks.
- **FR-008**: Once a newer week's routine exists for a customer, every earlier week's routine
  MUST become read-only — the system MUST prevent edits to a past week's routine, so recorded
  history can never be silently rewritten. Only the customer's current week (and any future week
  not yet reached) remain editable.
- **FR-008a**: If a coach attempts to edit a locked past week's routine, the system MUST clearly
  indicate that the week is locked and MUST NOT apply the attempted change.
- **FR-009**: The system MUST support an open-ended number of independent weekly routines per
  customer — there is no fixed cap (e.g. not limited to 4 weeks) — so a new week's routine can
  keep being added for as long as the coaching relationship continues.
- **FR-010**: Both the coach and the customer MUST be able to view a customer's past weekly
  routines, through the same per-customer view already used to view the current week.

### Key Entities

- **Weekly Routine**: One week's independent, self-contained day-by-day exercise schedule for a
  customer — the set of days, exercises, sets/reps, rest, and form guidance assigned for that
  specific week. Belongs to exactly one customer and exactly one week. Distinct from every other
  Weekly Routine belonging to the same customer, even when created by editing a prior one.
  Replaces today's single shared schedule reused across all week tabs.
- **Customer Program**: The umbrella record for a customer's overall coaching plan — goal,
  fitness level, session duration, frequency, limitations — that a customer's Weekly Routines
  belong to. Unchanged in shape by this feature, except that it now relates to multiple
  independent Weekly Routines instead of one shared schedule.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can assign a customer a routine for a new week that is entirely different
  from the previous week's routine, and both weeks' routines remain correctly, independently
  viewable afterward, 100% of the time (no cross-week content leakage).
- **SC-002**: When a coach updates the current week's routine, the change is reflected
  immediately and every other week's previously recorded routine is unaffected, verified across
  at least 3 consecutive weekly updates for the same customer.
- **SC-003**: A coach can retrieve and view any past week's routine, exactly as originally
  recorded, in under 10 seconds from the customer's page.
- **SC-004**: Customers whose program has only ever had one week's routine defined continue to
  display correctly, with no change in behavior from today.
- **SC-005**: Attempting to edit a locked, past week's routine never succeeds — verified across
  every past week for a customer with an extended history (10+ weeks), with 0 unintended
  changes to historical content.
- **SC-006**: A customer with an extended coaching history (10+ weeks) can still navigate to and
  correctly view any individual past week's routine from their program view.
- **SC-007**: A customer can view their own past weeks' routines (not just the coach), confirmed
  for at least one customer account across at least 2 past weeks.

## Assumptions

- The customer-facing week selector already in the product is the natural place this feature's
  per-week routines get displayed, but it must change from today's fixed 4-chip selector to one
  that can grow to an open-ended number of weeks (FR-009) — this spec does not mandate a specific
  navigation pattern for a large week count (e.g. scrolling vs. pagination vs. month grouping),
  only that it stays usable as history grows (edge case above, SC-006).
- "Tracking past routines" means preserving and displaying the full previously-recorded routine
  content for a week, not a diff/changelog of individual field-level edits within a week.
- Existing customers who currently have only a single, non-week-scoped schedule will be treated
  as having that schedule as their week 1 routine going forward; no separate one-time data
  migration behavior is specified beyond continuing to display them correctly (FR-007).
- "Current week" is determined by normal calendar progression from when a customer's program
  started (or from an explicit coach action marking a new week as current) — this spec does not
  define the exact rule for when a week automatically transitions from current to locked/past,
  beyond requiring that a newer week's existence is what triggers locking the prior one (FR-008).
