# Feature Specification: Program Day "Mark done" Quick-Complete

**Feature Branch**: `012-program-day-mark-done`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Design a Complete / Done button on the Program daily routine. Once they click it, add a new default Log Session marked as complete. Keep the default simple. If they add a Log Session, that is extra info for the same session." Full design brief: see [design.md](./design.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mark a training day as done in one click (Priority: P1)

The coach has the client's Program tab open and the client says they did today's workout. The coach clicks **Mark done** on that day's card. A completed session is logged right away with no form. The card changes to a "Done today" state, and the coach stays on the Program tab.

**Why this priority**: This is the core of the feature. Today, logging a finished workout means switching to Log Session and filling in every template field, even when all the coach knows is "they did it". Without this story the feature has no value.

**Independent Test**: Open the current week of a client with structured training days, click Mark done on one day, and confirm that (a) the card shows Done today, (b) the Feedback tab has one new completed entry labelled with that day, and (c) completion % went up.

**Acceptance Scenarios**:

1. **Given** the current week's Program tab with a training-day card "Lunes - Piernas A" not yet done, **When** the coach clicks Mark done, **Then** one feedback entry is saved with today's date, label "Lunes - Piernas A", Completed = Yes, and "not reported" for every other field.
2. **Given** the save succeeded, **When** the card re-renders, **Then** the button is replaced by a "Done today" completion chip and an "Add details" action, the card shows a subtle accent border, a confirmation toast appears, and the coach is still on the Program tab.
3. **Given** the save succeeded, **When** the coach opens the Feedback tab, **Then** the new entry appears as Completed, completion % includes it, and no felt or difficulty value is shown or counted for it.
4. **Given** a save is in progress, **When** the coach clicks the button again, **Then** no second entry is created (the button is disabled and reads "Saving...").
5. **Given** the save fails (e.g. server unreachable), **When** the error returns, **Then** an inline message "Could not save. Try again." appears under the button, the button is usable again, and no entry exists.

---

### User Story 2 - Done state persists across reloads (Priority: P2)

When the coach comes back to the Program tab later, days that were already marked done still show as done. The coach can see which workouts in the week are finished and doesn't mark the same one twice.

**Why this priority**: Without this, the done state disappears on reload and coaches will create duplicate entries. It depends on Story 1 having created entries.

**Independent Test**: Mark a day done, reload the page, and confirm the card still shows the done state with the right date.

**Acceptance Scenarios**:

1. **Given** a completed entry labelled "Lunes - Piernas A" dated today, **When** the Program tab loads, **Then** that card shows "Done today".
2. **Given** a completed entry with that label dated 3 days ago, **When** the Program tab loads, **Then** the card shows "Done" with that date (e.g. "Done Mon, Sep 22").
3. **Given** the only matching entry is dated more than 7 days ago, or is marked Completed = No, **When** the Program tab loads, **Then** the card shows the Mark done button.

---

### User Story 3 - Add details to a quick-logged session (Priority: P2)

After a quick Mark done, the client later shares how the session felt. The coach clicks **Add details** on the done card. The Log Session tab opens with that session's date and label already filled in. The coach fills in felt, difficulty and notes and saves. The quick entry is **enriched in place** (it is not duplicated), so the workout still counts once.

**Why this priority**: The quick default only records completion. This story lets the coach add real feedback later without inflating the session count. It also covers fixing a mistaken tap (save the same session with Completed = No).

**Independent Test**: Quick-mark a day, click Add details, fill in the fields and save. Confirm the Feedback tab shows exactly one entry for that date and label, now with the new values.

**Acceptance Scenarios**:

1. **Given** a done card, **When** the coach clicks Add details, **Then** the Log Session tab opens with Date and Session label prefilled from that entry.
2. **Given** a quick entry exists for date D and label L, **When** the coach saves a Log Session with the same D and L, **Then** that entry's field values are replaced by the submitted ones and no new entry is added.
3. **Given** the coach saved that Log Session with Completed = No, **When** the Program tab shows again, **Then** the card is back to the Mark done state and completion % no longer counts the session.
4. **Given** no entry exists for the submitted date and label, **When** the coach saves a Log Session, **Then** a new entry is appended exactly as it is today.

---

### Edge Cases

- **Rest days / free-form days** (no structured exercises): no Mark done footer is shown.
- **Past (locked) weeks**: no Mark done button. Cards that were done still show the done chip, read-only, with no Add details.
- **Two days with the same label** (e.g. a program repeating "Lunes - Piernas A" in a different week): matching uses date plus label, so a separate day's session is a separate entry.
- **Clicking Mark done on a day already done today** is not possible, because the button is not shown once done. If a stale page submits it anyway, the existing entry for that date and label is reused and no duplicate is created.
- **Custom (per-customer, e.g. Spanish) feedback templates**: the default entry fills every field in that customer's own template. The completed field uses the value that template's language accepts.
- **Manual entries that are not from a quick-mark** but share the date and label are also enriched instead of duplicated. One session per day per label is the rule.
- **Session refresh fails after a successful save**: the card still shows done (based on the save response), and the stats catch up on the next load.
- **Timezone**: "today" is the coach's local calendar date, the same as the Log Session form's default date.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each training-day card (a day with structured exercises) in the current, unlocked week MUST show a footer with a single primary action labelled "Mark done", unless that day is already done (FR-006).
- **FR-002**: Mark done MUST save one feedback entry for the customer without opening a form. The entry has date = today, session label = "<Day> - <Focus>" exactly as the card shows it, completed = yes, and every other template field set to the same "not reported" value.
- **FR-003**: "Not reported" values MUST be excluded from felt/difficulty statistics, the trend, and the entry's displayed facts. They MUST NOT appear as real data anywhere in the Feedback tab.
- **FR-004**: While a Mark done save is in progress, the action MUST be disabled, show a "Saving..." label, and announce a busy state to assistive technology. Repeat activations MUST NOT create additional entries.
- **FR-005**: On failure, the card MUST show an inline error message under the action, re-enable the action, and leave no partial entry.
- **FR-006**: A training-day card MUST display the done state when a completed entry with the same session label exists, dated within the last 7 days (today included). The done state shows a completion chip reading "Done today" when the date is today, or "Done <weekday, month day>" otherwise.
- **FR-007**: On success, the system MUST show a confirmation toast, refresh the Feedback stats and the client's sidebar status, and keep the coach on the Program tab.
- **FR-008**: A done card in the current week MUST offer an "Add details" action. It opens the Log Session tab with Date and Session label prefilled from the matching entry.
- **FR-009**: Saving a Log Session whose date and session label (case-insensitive, trimmed) match an existing entry MUST replace that entry's field values instead of appending a new entry. A Log Session with no match MUST append as it does today.
- **FR-010**: Cards in locked (past) weeks and cards without structured exercises MUST NOT show the Mark done action. Locked-week cards MAY show the done chip read-only.
- **FR-011**: The new footer MUST reuse the existing visual system: the primary pill button style, the existing completed chip, and existing color and type tokens. No new colors or fonts. The action is full-width on phone-width screens, and the touch target is at least 48px tall.
- **FR-012**: The done-state entrance animation MUST be limited to a short scale/opacity change and MUST be disabled when the user prefers reduced motion.
- **FR-013**: Quick-logged entries MUST be stored in the customer's feedback log in the same format as any other entry (all template fields present, YYYY-MM-DD date), so every existing reader of the feedback log keeps working.

### Key Entities

- **Training day**: one day block of the current week's program. It has a day name, a focus, and structured exercises. Its session label is "<Day> - <Focus>".
- **Session entry**: one feedback log entry. It has a date, a session label, template field values, and a completed flag. The pair (date, session label) identifies it for enrichment.
- **"Not reported" value**: a fixed sentinel value for a field that has no recorded information. It is treated as absent by stats and display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can record a completed workout from the Program tab in 1 click and under 3 seconds, compared with filling in 4+ fields today.
- **SC-002**: After marking a day done, 100% of Feedback stats (completion %, last session date) reflect it without a manual page reload.
- **SC-003**: Marking a day done and then adding details for the same date and label always leaves exactly 1 entry for that session (0 duplicates in completion %).
- **SC-004**: Quick-logged entries contribute 0 values to the average-difficulty stat and the difficulty trend.
- **SC-005**: The done state for each day is correct after a page reload in 100% of cases covered by the acceptance scenarios.
- **SC-006**: The action and done chip meet WCAG AA contrast in both light and dark themes, and are fully usable by keyboard.

## Assumptions

- The dashboard is coach-only (existing sign-in). Clients do not click Mark done themselves in this feature.
- The 7-day window is used because program weeks don't store calendar dates. It is a simple and adequate stand-in for "this week".
- "Not reported" is the single sentinel for the English template. Other-language templates use their own equivalent (e.g. "No reportado") and the completed value their language accepts (e.g. "Sí").
- A default quick entry is not specially marked. Enrichment matches by date and label (FR-009), which also removes accidental duplicates from manual logging.
- Undo, deleting entries, marking done on past weeks, done check marks on the day chips, and client-facing access are out of scope.
- Depends on the existing feedback log storage, the Log Session form, the Feedback stats, and the week lock rule from feature 010.
