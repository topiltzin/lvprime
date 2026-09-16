# Feature Specification: Weekly Program Tabs with PDF Download

**Feature Branch**: `003-program-weekly-tabs-pdf`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "on the customer page, the Program add a new pestana inside for each week, similar to the day for week1 week2 week3 week4, lets keep 4 weeks, and later at hte end lets have a button to generate the PDF in order to download online."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the program week by week (Priority: P1)

A coach opens a customer's page and selects the Program tab. Instead of seeing only a single undifferentiated schedule, they see four week selectors — Week 1, Week 2, Week 3, Week 4 — inside the Program tab, working the same way the existing day selector works. Selecting a week shows that week's day-by-day schedule (the same exercise plan the customer follows every week) along with the specific progression guidance that applies to that week (e.g. "Week 2: increase reps within the given range"), so the coach can see at a glance what should change as the customer advances.

**Why this priority**: This is the core of the request and the piece the customer-facing program view is currently missing — without it there is no way to see week-specific guidance at all, only a generic progression blurb detached from the schedule.

**Independent Test**: Open any customer with a program that includes weekly progression guidance, switch between the four week selectors inside the Program tab, and confirm the day-by-day schedule stays visible while the progression note shown updates to match the selected week.

**Acceptance Scenarios**:

1. **Given** a customer's Program tab is open, **When** the coach views it, **Then** four week selectors labeled Week 1, Week 2, Week 3, and Week 4 are visible inside the Program tab, with Week 1 selected by default.
2. **Given** the Program tab is open with Week 1 selected, **When** the coach selects Week 3, **Then** the displayed content switches to show Week 3's progression note while the underlying day-by-day exercise schedule (days, exercises, sets/reps, rest, form tips) remains the same schedule shown for every week.
3. **Given** a customer's program.md has no week-specific progression text for one or more weeks, **When** the coach selects that week, **Then** the day-by-day schedule still displays normally and an explicit "no specific guidance for this week" message is shown in place of a progression note (never a fabricated or guessed note).
4. **Given** a customer's program.md has no weekly progression section at all, **When** the coach opens the Program tab, **Then** the four week selectors still appear (each showing the same schedule with the no-guidance message) rather than the feature being hidden entirely.

---

### User Story 2 - Download the currently viewed week as a PDF (Priority: P2)

While viewing a specific week's content in the Program tab, the coach clicks a "Download PDF" button placed at the end of the Program tab. A PDF file generates and downloads to their device containing exactly what is currently on screen for that week: the week label, the day-by-day exercise schedule, and that week's progression note. This lets the coach save or print a single week's plan, or share it with the customer outside the app.

**Why this priority**: Valuable but secondary to actually having week-specific content to export — the button is only useful once User Story 1 exists, and the app is otherwise fully usable without it.

**Independent Test**: With any week selected in the Program tab, click "Download PDF" and confirm a PDF file downloads containing that week's label, schedule, and progression note, with no dependency on other tabs (Feedback, Notes) being present.

**Acceptance Scenarios**:

1. **Given** Week 2 is the currently selected week in the Program tab, **When** the coach clicks "Download PDF", **Then** a PDF file downloads whose content matches Week 2 (label, schedule, progression note).
2. **Given** the coach switches from Week 2 to Week 4 and clicks "Download PDF" again, **When** the second download completes, **Then** the resulting PDF reflects Week 4, not Week 2.
3. **Given** the program has no exercises or schedule content at all (empty program), **When** the coach clicks "Download PDF", **Then** the button still produces a PDF showing the week label and an explicit "no schedule available" message rather than failing silently or producing a blank/broken file.

---

### Edge Cases

- What happens when a customer's program.md schedule section is completely empty? Each week tab shows the existing empty-state messaging already used elsewhere in the Program tab; the PDF download still functions and reflects that empty state.
- What happens when the customer's plan duration is shorter than 4 weeks (e.g. a 2-week plan) or has no explicit duration at all? All four week selectors still appear per the fixed 4-week structure; weeks beyond the stated plan duration show the schedule with a note that no specific progression guidance exists for that week (same handling as a missing progression note).
- What happens when the PDF download is triggered twice in a row, or while a previous download is still generating? Each click generates and downloads its own PDF for whatever week is currently selected at the time of that click; overlapping requests do not corrupt or block each other.
- What happens if PDF generation fails (e.g. a transient rendering error)? The coach sees a clear inline error message and can retry; the rest of the Program tab remains usable.
- How does the week selector behave for a customer whose Program tab is otherwise empty (no program.md content at all)? The existing "no program yet" empty state continues to take priority — week selectors and the PDF button are not shown when there is no program content to show.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Program tab MUST present exactly four week selectors, labeled Week 1, Week 2, Week 3, and Week 4, navigated the same way the existing day selector is navigated (click/tap to switch, keyboard arrow navigation).
- **FR-002**: The Program tab MUST default to Week 1 selected when first opened.
- **FR-003**: Selecting a week MUST display that week's progression guidance alongside the day-by-day exercise schedule; the same day-by-day exercise schedule (days, exercises, sets/reps, rest periods, form tips) MUST be shown regardless of which week is selected, since the underlying weekly routine does not change — only the progression guidance differs.
- **FR-004**: When a customer's program content includes week-specific progression text (e.g. a "Weekly Progression" section with one entry per week), the system MUST match each entry to its corresponding week selector by week number.
- **FR-005**: When no progression text exists for a given week (either because the program has no weekly progression section, or that week number isn't covered by it), the system MUST show an explicit "no specific guidance for this week" message instead of leaving the area blank or fabricating content.
- **FR-006**: The Program tab MUST include a "Download PDF" button positioned after the week content (at the end of the Program tab).
- **FR-007**: Clicking "Download PDF" MUST generate and download a PDF file reflecting only the currently selected week: the week label, its day-by-day exercise schedule, and its progression note (or the "no specific guidance" message, if applicable).
- **FR-008**: The generated PDF MUST be usable offline once downloaded (a self-contained file, not a link requiring further app access).
- **FR-009**: If PDF generation fails, the system MUST show the coach a clear error message rather than failing silently, and MUST allow retrying without reloading the page.
- **FR-010**: The week selectors and "Download PDF" button MUST NOT be shown when the customer has no program content at all, consistent with the existing empty-state behavior of the Program tab.
- **FR-011**: The existing day-level navigation and exercise presentation within a week (day cards, exercise rows, sets/reps, rest, form tips) MUST continue to work unchanged within each week's view.

### Key Entities

- **Program Week**: A view over the existing weekly exercise schedule, identified by week number (1–4), paired with that week's progression guidance text (if any). Does not introduce a new independently-authored schedule per week — the day-by-day exercises are shared across all four weeks.
- **Weekly Progression Note**: A short piece of guidance text describing what should change in a given week (e.g. increase reps, increase load), associated with a specific week number, sourced from the program's existing progression content.
- **Program PDF**: A generated, downloadable document representing a single selected week's schedule and progression note at the moment of download.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can switch between all four week views inside the Program tab in under 5 seconds total, with no page reload.
- **SC-002**: 100% of customers with an existing 4-entry weekly progression section show the correct progression note matched to each of the four week selectors.
- **SC-003**: A coach can go from opening a customer's Program tab to having a downloaded PDF of the currently viewed week in under 10 seconds.
- **SC-004**: The downloaded PDF is legible and complete (week label, full day-by-day schedule, progression note) when opened in a standard PDF viewer, verified across at least 3 sample customer programs of varying schedule length.
- **SC-005**: 0 customer programs cause the Program tab, week selectors, or PDF button to error out or blank-screen, including programs with missing progression sections or empty schedules.

## Assumptions

- "Pestana" refers to a tab/selector UI element, matching the existing day-selector pattern already used inside the Program tab (renders as clickable labels the coach switches between).
- The 4-week structure is fixed regardless of a customer's actual stated plan duration, per explicit instruction ("let's keep 4 weeks") — shorter or undefined-duration plans still show all 4 week selectors, with unmatched weeks falling back to the "no specific guidance" message.
- Each week tab reuses the single existing day-by-day exercise schedule rather than requiring coaches to author separate schedules per week; only the progression note differs by week. This matches how programs are authored today (one weekly schedule plus a short "Progresión Semanal (4 semanas)" guidance list).
- The PDF download always reflects whichever week is currently selected at the moment the button is clicked, not the full 4-week program.
- This is a single-audience (coach-facing) admin tool with no separate customer login; the week tabs and PDF button are available to whoever can already view the customer's Program tab today.
- No new authoring requirements are placed on how program.md files are written; existing customer files (with or without a weekly progression section) must work without modification.
