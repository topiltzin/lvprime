# Feature Specification: Premium Studio Visual Redesign

**Feature Branch**: `002-premium-studio-redesign`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Design goals — feel like a premium training studio, not an admin spreadsheet. Scan in under 3 seconds. One accent, strong hierarchy, athletic motion. Locks a full visual system (color, type, space, icons) and an 8-step build plan covering: brand shell/header, customers overview as a triage command center, customer detail hero, product-grade tabs, program tab as workout cards, feedback + log-session flow with real stats, an honesty pass on coach notes (no placeholder content), and finishing micro-interactions/dark mode."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Triage Clients at a Glance (Priority: P1)

A coach opens the dashboard between sessions and needs to immediately see which clients need attention. The overview screen shows all clients as cards, sorted so the ones with no feedback or the oldest check-ins surface first, each card carrying a clear status signal (on track / needs check-in / no feedback) and a relative "last check-in" date.

**Why this priority**: This is the coach's entry point every single time they open the tool. If triage isn't obvious in seconds, the whole "premium studio" value proposition fails and the tool reverts to feeling like a spreadsheet.

**Independent Test**: Load the overview with a mix of clients (one with recent feedback, one overdue >7 days, one with none) and confirm the overdue/no-feedback clients render first with visually distinct status pills, with no manual sorting or filtering required.

**Acceptance Scenarios**:

1. **Given** clients with feedback logged at different recency, **When** the coach opens the overview, **Then** clients are ordered with "no feedback" first, then oldest-feedback-first, then on-track clients.
2. **Given** a client's most recent feedback entry is more than 7 days old, **When** the coach views that client's card, **Then** the card shows a "Needs check-in" status pill in the amber treatment.
3. **Given** a client has zero feedback entries, **When** the coach views that client's card, **Then** the card shows a "No feedback" status pill using the dashed/muted treatment, distinct from the amber and green pills.
4. **Given** a client has feedback logged within the last 7 days, **When** the coach views that client's card, **Then** the card shows an "On track" status pill in the green tint.
5. **Given** there are zero clients, **When** the coach opens the overview, **Then** an empty state appears with a single actionable sentence — no filesystem or folder terminology.

---

### User Story 2 - Read a Client's Program Like a Workout Poster (Priority: P1)

A coach opens a client's Program tab to review or present today's plan. Each training day renders as a distinct card (day name, focus, exercise rows with sets/reps and rest called out clearly) instead of a block of markdown text, so the coach can scan a day's plan in seconds — including for clients whose programs are authored in Spanish or English.

**Why this priority**: The program is the "wow" screen and the artifact coaches reference most during a live session; if it still reads like a wall of markdown, the redesign hasn't delivered its core promise.

**Independent Test**: Open a client with a multi-day, multi-exercise program and confirm each day appears as its own card with scannable exercise rows (name, sets×reps, rest, optional form tip) rather than continuous prose, with the authored language of the content unchanged.

**Acceptance Scenarios**:

1. **Given** a client's program has multiple training days, **When** the coach opens the Program tab, **Then** each day renders as a separate card with the day name and focus as its title.
2. **Given** a training day lists several exercises, **When** the coach views that day's card, **Then** each exercise appears as its own row showing name, set×rep target, and rest period, not as numbered prose.
3. **Given** an exercise has a form tip, **When** the coach views that exercise row, **Then** the tip is visually secondary (smaller/muted text or a disclosed toggle) and does not compete with the exercise name.
4. **Given** a program was authored in Spanish, **When** the coach views the Program tab, **Then** all authored exercise/day content displays exactly as written, while surrounding chrome (labels, buttons) stays in the dashboard's own consistent language.
5. **Given** a program has enough days to exceed one screen, **When** the coach scrolls, **Then** a day sub-navigation (e.g., day-name chips) is available to jump directly to a given day.

---

### User Story 3 - Log a Session and See It Land in Feedback (Priority: P1)

After a session, the coach logs how it went using a fast, full-width form, gets a clear confirmation that it saved, and is taken straight to the Feedback tab to see the entry alongside real completion/difficulty stats — with no placeholder or fabricated commentary anywhere in the flow.

**Why this priority**: Logging is the highest-frequency write action in the tool; friction or ambiguity here (did it save? where did it go?) undermines trust every single day, and any fake "good progress" text destroys credibility instantly once noticed.

**Independent Test**: Submit a session log for a client and confirm a success confirmation appears, the view switches to Feedback automatically, the new entry is visible, and the stat tiles reflect only real logged data (no boilerplate text when data is sparse or absent).

**Acceptance Scenarios**:

1. **Given** a coach fills out the log-session form and submits, **When** the save succeeds, **Then** a brief success confirmation appears and the coach is automatically returned to the Feedback tab.
2. **Given** the coach is now on the Feedback tab after saving, **When** the tab renders, **Then** the newly logged entry appears among the feedback entries.
3. **Given** a client has logged sessions, **When** the coach views the Feedback tab's summary stats, **Then** completion percentage, last-session date, and average difficulty are computed from actual logged entries only.
4. **Given** a client has no logged sessions yet, **When** the coach views Feedback or Notes, **Then** the tool shows an honest empty state (e.g., a dashed placeholder card) rather than invented example text.
5. **Given** the coach is on a small screen, **When** they view the log-session form, **Then** the primary save action is a full-width button and inputs are large enough to tap easily.

---

### User Story 4 - Navigate a Client's Tabs Without Getting Lost (Priority: P2)

A coach moves between a client's Program, Feedback, Log Session, and Notes using a small, clearly-labeled set of tabs that behave predictably: a sensible tab is selected by default, the active tab is unambiguous, keyboard arrow keys move between tabs, and the whole page scrolls as one surface instead of trapping scroll inside nested panels.

**Why this priority**: This is the connective tissue between the other three journeys; broken tab defaults or scroll traps make the rest of the redesign feel unfinished even if each individual tab looks good.

**Independent Test**: Open a client detail page fresh, confirm a tab is selected automatically without a blank state, switch tabs with the arrow keys, and confirm scrolling the page never gets stuck inside a fixed-height inner panel.

**Acceptance Scenarios**:

1. **Given** a coach opens a client detail page for the first time in a session, **When** the page loads, **Then** the first available tab is selected automatically (never a blank/no-tab state).
2. **Given** a tab is focused, **When** the coach presses the left or right arrow key, **Then** focus and selection move to the adjacent tab.
3. **Given** a client detail page with a long Program or Feedback tab open, **When** the coach scrolls down, **Then** the entire page scrolls as a single surface rather than stopping at an inner panel boundary.
4. **Given** the coach is viewing any tab, **When** they look at the tab bar, **Then** exactly one tab is visually marked active and distinguishable from the inactive tabs.

---

### Edge Cases

- What happens when a client has a program, feedback, and notes but one of those files is missing or empty? → That tab shows an honest empty state specific to what's missing, never fabricated content.
- What happens when a client's "last check-in" date cannot be determined (no feedback ever logged)? → The card shows the "No feedback" status, not a broken or blank date.
- What happens when two clients have identical urgency (e.g., both have no feedback)? → A stable, consistent secondary ordering (e.g., alphabetical by name) is applied so card order doesn't jump between visits.
- What happens on a narrow mobile screen (~390px wide)? → The overview grid, client hero, tabs, and log-session form all remain usable and readable without horizontal scrolling.
- What happens when a client's program contains an unusually large number of days or exercises? → The day sub-navigation and exercise rows remain scannable rather than overwhelming the screen, and the page still scrolls as one surface.
- What happens when the coach's system is set to a dark color scheme? → The accent and surface colors adapt so the accent stays legible rather than reading muddy against a dark background.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The overview screen MUST sort client cards by urgency: no-feedback clients first, then oldest-feedback-first among clients with feedback, then on-track clients, with a stable secondary sort (alphabetical) for ties.
- **FR-002**: Each client card MUST display the client's name, a truncated goal (max two lines), a relative "last check-in" date, and exactly one status pill reflecting one of three states: on track, needs check-in (feedback older than 7 days), or no feedback.
- **FR-003**: The overview MUST show a client count alongside the section title and MUST support the coach searching/filtering clients by name.
- **FR-004**: The overview's empty state (zero clients) MUST use a single plain-language sentence and an actionable next step, without referencing files, folders, or other implementation terminology.
- **FR-005**: The client detail page MUST present a hero section (client name, one-line summary of goal/level/session length) above the tab navigation.
- **FR-006**: The client detail page MUST expose exactly four tabs — Program, Feedback, Log Session, Notes — with no separate "History" tab; historical stats MUST surface inside the Feedback tab instead.
- **FR-007**: Tab navigation MUST support left/right arrow key switching between tabs and MUST always have exactly one tab active, defaulting to the first available tab on initial load.
- **FR-008**: The client detail page MUST NOT rely on fixed-height inner-scrolling panels; the page MUST scroll as a single surface.
- **FR-009**: The Program tab MUST render each training day as a distinct card containing the day name/focus and a list of exercise rows (name, set×rep target, rest period), rather than continuous markdown prose.
- **FR-010**: Exercise form-tip content, when present, MUST be visually subordinate to the exercise name (smaller/muted text or a disclosed toggle).
- **FR-011**: Programs authored in Spanish or English MUST render their authored content unmodified; surrounding interface labels MUST remain in one consistent language regardless of the program's authored language.
- **FR-012**: Programs spanning multiple days MUST offer a day sub-navigation that jumps to each day's card.
- **FR-013**: The Feedback tab MUST display completion percentage, last-session date, and average difficulty computed only from actual logged data, with no placeholder or example values shown in their place.
- **FR-014**: The Feedback tab's trend visualization MUST visually distinguish completed sessions from missed sessions and MUST include a legend.
- **FR-015**: The Log Session form MUST be full-width within its tab, MUST use large (comfortably tappable) inputs, and MUST present its save action as a full-width button on narrow screens.
- **FR-016**: Upon a successful session save, the system MUST show a brief success confirmation and MUST automatically switch the coach's view to the Feedback tab.
- **FR-017**: The Notes tab MUST render the coach's actual authored notes content and MUST NOT display hardcoded placeholder commentary (e.g., generic "showing good progress" text) under any circumstance.
- **FR-018**: When a client has no notes yet, the Notes tab MUST show a distinct empty state rather than any placeholder narrative content.
- **FR-019**: The interface MUST use a single accent color for status/progress signaling, avoiding multiple competing accent colors within the chrome.
- **FR-020**: The interface MUST remain fully usable and legible at a narrow mobile width (~390px) and at a standard desktop width (~1280px) without introducing horizontal page scrolling.
- **FR-021**: The interface MUST adapt its accent color for legibility when the coach's system is in a dark color scheme, rather than reusing the light-mode accent unchanged.

### Key Entities

- **Client**: A coached individual with a name, goal, fitness level, session length, an associated program, a feedback history, and coach notes; derives an urgency/status state from the recency of their feedback.
- **Program**: A client's current training plan, organized into training days; each day has a name/focus and an ordered list of exercises.
- **Exercise**: A single movement within a training day, with a name, a set×rep target, a rest period, and an optional form tip.
- **Feedback Entry**: A single logged session record capturing date, how the client felt, whether the session was completed, difficulty, and free-text notes.
- **Coach Note**: A dated observation or recommendation authored by the coach about a client's progress or program adjustments.
- **Status**: A derived triage state for a client — on track, needs check-in, or no feedback — used to sort and label the overview.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can identify which clients need attention within 3 seconds of the overview screen loading, without scrolling or applying filters.
- **SC-002**: A coach can locate and read a specific training day's full exercise list in under 10 seconds from opening a client's Program tab.
- **SC-003**: Logging a session and confirming it was saved takes a coach under 30 seconds end-to-end, including the automatic hand-off to the Feedback view.
- **SC-004**: Zero instances of fabricated or placeholder coaching commentary appear anywhere in the interface across all clients, including those with sparse or no data.
- **SC-005**: The interface remains fully usable — no horizontal scrolling, no clipped or overlapping content — at both a 390px-wide mobile viewport and a 1280px-wide desktop viewport.
- **SC-006**: Coaches can switch between all tabs on a client's page using only the keyboard, without a mouse.

## Assumptions

- This redesign applies to the existing coach-facing dashboard application that already reads client data from `program.md`, `feedback.md`, and `notes.md`; it changes presentation and interaction, not the underlying customer file formats defined in the project's coaching workflow.
- "The coach" is the single intended user role for this interface; no multi-user permissions or client-facing login is in scope.
- Locale/translation of chrome UI text is out of scope — only the visual/structural redesign and honesty-of-content requirements are being specified here; chrome copy stays in whichever single language it is already written in.
- Dark mode is a system-preference-driven visual adaptation of the same interface, not a separate feature set or user-toggled setting requiring persistence.
- "Real data only" for stats and notes means: if no data exists, show an empty state; the system is not expected to fetch or infer data from any source beyond the client's existing program/feedback/notes records.
- Performance targets (e.g., tab-switch speed) are evaluated qualitatively against the stated scan-time goals rather than requiring instrumented performance monitoring as part of this feature.
