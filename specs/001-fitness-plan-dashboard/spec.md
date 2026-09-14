# Feature Specification: Fitness Plan Dashboard

**Feature Branch**: `001-fitness-plan-dashboard`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Build an application that can help me organize the fitness plan that exist on the folders, like the one form jaqueline-orellano, topiltzin-flores, check the folder contain and the claude.md. the Idea will help to keep update the plan and have some visual help to keep the feedback and notes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See every customer's status at a glance (Priority: P1)

The coach opens the app and immediately sees a list of every customer currently under
`customers/` (e.g. Jaqueline Orellano, Topiltzin Flores), with enough summary information
per customer to know who needs attention without opening any individual file.

**Why this priority**: This is the entry point to the whole tool. Today the coach has to
open three separate Markdown files per customer to know where things stand; a single
overview screen is the minimum viable improvement over that and delivers value even with
nothing else built.

**Independent Test**: Can be fully tested by pointing the app at the `customers/` directory
and confirming it lists both existing customers (Jaqueline Orellano, Topiltzin Flores) with
a readable summary for each, with no other features implemented.

**Acceptance Scenarios**:

1. **Given** the `customers/` directory contains one or more customer folders, **When** the
   coach opens the app, **Then** every customer folder is listed with the customer's name
   and a short status summary (e.g. current program name/goal, last feedback date).
2. **Given** a customer folder is missing one of its expected files, **When** the dashboard
   loads, **Then** that customer still appears in the list with the missing item shown as
   "not yet created" rather than the app failing to load.

---

### User Story 2 - Review one customer's plan, feedback, and notes together (Priority: P2)

The coach selects a customer from the overview and sees that customer's current program
(goal, weekly schedule, exercises, progression), their logged feedback history, and the
coach's own notes, all in one readable view — instead of switching between three raw
Markdown files.

**Why this priority**: This is the core "organize the plan" value the coach asked for. It
depends on Story 1 (needs a customer to select) but delivers the bulk of the day-to-day
usefulness: understanding a customer's current state before deciding what to do next.

**Independent Test**: Can be fully tested by opening an existing customer (e.g.
jaqueline-orellano) and confirming the program's weekly structure, the full feedback
history, and the coach notes all render correctly and match the underlying `.md` files.

**Acceptance Scenarios**:

1. **Given** a customer has a populated `program.md`, **When** the coach opens that
   customer, **Then** the weekly schedule, exercises, sets/reps/rest, and progression
   strategy are displayed in a readable, organized layout.
2. **Given** a customer has one or more entries in `feedback.md`, **When** the coach opens
   that customer, **Then** all entries are displayed in chronological order with their
   recorded fields (how they felt, completed, notes, overall impression).
3. **Given** a customer's `feedback.md` has no logged sessions yet, **When** the coach opens
   that customer, **Then** the feedback section shows an empty state instead of an error.
4. **Given** a customer has entries in `notes.md`, **When** the coach opens that customer,
   **Then** the coach's observations/insights are displayed alongside the plan and feedback.

---

### User Story 3 - Log a new feedback entry from the app (Priority: P3)

After a session, the coach fills in a short structured form (date, how the customer felt,
whether it was completed, notes, overall impression) inside the app, and the entry is saved
into that customer's `feedback.md` in the same format the file already uses.

**Why this priority**: This replaces manual Markdown editing for the most frequent update
action (logging a session), but the tool is already useful for reviewing plans without it —
hence it comes after Stories 1 and 2.

**Independent Test**: Can be fully tested by submitting a feedback entry for a customer
through the app and confirming a correctly formatted new entry appears in that customer's
`feedback.md`, visible on next reload of Story 2's view.

**Acceptance Scenarios**:

1. **Given** the coach is viewing a customer, **When** they submit a completed feedback
   form, **Then** a new dated entry is appended to that customer's `feedback.md` matching
   the file's existing entry format.
2. **Given** the coach submits a feedback form with a required field left blank, **When**
   they try to save, **Then** the app blocks the save and indicates which field is missing.
3. **Given** a new feedback entry was just saved, **When** the coach views that customer's
   feedback history, **Then** the new entry appears without needing to restart the app.

---

### Edge Cases

- What happens when the `customers/` directory contains a folder with no recognizable files
  at all (e.g. empty folder)? The dashboard MUST still list it rather than crash, showing all
  three files as "not yet created."
- What happens when a customer's `program.md`, `feedback.md`, or `notes.md` is edited
  directly (outside the app) — e.g. by the coach through the existing Claude/CLAUDE.md
  workflow — while the app is running? The next time that customer's view is opened or
  refreshed, it MUST reflect the current file contents.
- How does the app handle a customer folder that contains extra files beyond the three
  standard ones (e.g. `jaqueline-orellano/plans/semana1.pdf`)? These MUST be listed as
  attachments the coach can open, without the app needing to render their contents inline.
- What happens when `feedback.md` contains entries that don't fully match the expected
  format (e.g. a manually-edited entry missing a field)? The entry MUST still display with
  the fields it has, rather than being hidden or causing an error.
- What happens when the coach tries to add a feedback entry for a customer whose
  `feedback.md` does not exist yet? The app MUST create the file with the entry in the
  expected format.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST display a list of every customer found under `customers/`,
  derived directly from that directory's subfolders.
- **FR-002**: For each customer in the list, the app MUST show a short summary (at minimum:
  customer name, and — when available — current program goal and the date of the most
  recent feedback entry).
- **FR-003**: The app MUST let the coach select a customer and view that customer's current
  program content (goal, fitness level, weekly schedule, exercises with sets/reps/rest, form
  tips, and progression strategy) in a readable, organized layout, sourced from that
  customer's `program.md`.
- **FR-004**: The app MUST display a customer's full feedback history from `feedback.md`, in
  chronological order, showing each entry's recorded fields.
- **FR-005**: The app MUST display a customer's coach notes from `notes.md`.
- **FR-006**: The app MUST surface feedback patterns visually (e.g. completion rate over
  time, energy/difficulty trend across sessions) so the coach can spot patterns without
  rereading every entry individually.
- **FR-007**: The app MUST allow the coach to submit a new feedback entry for a customer
  through a structured form covering the fields already used in `feedback.md` (date, how
  the customer felt, completed yes/no, notes, overall impression).
- **FR-008**: The app MUST persist a submitted feedback entry into that customer's
  `feedback.md`, formatted consistently with the file's existing entries, creating the file
  if it does not yet exist.
- **FR-009**: The app MUST NOT modify `program.md` or `notes.md` content — creating and
  updating workout programs and coach notes remains part of the existing Claude Code /
  `CLAUDE.md`-driven workflow; the app is a viewer for that content.
- **FR-010**: The app MUST load and display any customer folder without erroring, even when
  one or more of the three standard files is missing, showing missing content as "not yet
  created" instead.
- **FR-011**: The app MUST run entirely locally against the `customers/` directory on the
  coach's own machine, without requiring customer accounts, login, or a network connection.
- **FR-012**: The app MUST reflect the current contents of a customer's files whenever that
  customer's view is opened or refreshed, without requiring a separate manual sync step.

### Key Entities

- **Customer**: A person being coached; identified by their folder name under `customers/`.
  Has an associated program, feedback history, coach notes, and optionally extra attachments
  (e.g. exported plan PDFs).
- **Program**: The customer's current workout plan — goal, fitness level, session duration,
  weekly schedule of exercises, per-exercise sets/reps/rest/form tips, and progression
  strategy — sourced from `program.md`.
- **Feedback Entry**: One logged session record for a customer — date, how the customer
  felt, whether the session was completed, notes, and overall impression — sourced from and
  appended to `feedback.md`.
- **Coach Note**: A dated observation or recommendation written by the coach about a
  customer's progress or needed adjustments, sourced from `notes.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The coach can see every customer's current status from a single screen,
  without opening any individual file, in under 10 seconds after launching the app.
- **SC-002**: The coach can go from the overview screen to a specific customer's full plan,
  feedback, and notes in two selections or fewer.
- **SC-003**: Logging a new feedback entry through the app takes under one minute and the
  entry is correctly readable in the customer's `feedback.md` immediately afterward.
- **SC-004**: 100% of existing customer folders load successfully in the app regardless of
  which of the three files are present or missing.
- **SC-005**: The coach can identify a feedback trend (e.g. rising difficulty, missed
  sessions) for a customer through the visual presentation alone, without manually
  cross-referencing multiple past entries.

## Assumptions

- There is a single coach user; no authentication, accounts, or per-user permissions are
  required, per the confirmed "coach only" scope.
- The app writes only new feedback entries back to disk; creating or editing `program.md`
  and `notes.md` continues through the existing Claude Code / `CLAUDE.md` workflow, per the
  confirmed "read + log feedback" scope.
- The app runs locally on the coach's machine and reads directly from the repository's
  `customers/` directory; it is not deployed for remote or customer access, per the
  confirmed "local-only" scope.
- The customer file formats defined in `CLAUDE.md` (`program.md`, `feedback.md`,
  `notes.md`) remain the source of truth; the app is a presentation and feedback-logging
  layer on top of them, not a replacement data store.
- Non-standard files found in a customer folder (e.g. `plans/semana1.pdf`) are surfaced as
  linkable attachments rather than rendered inline.
- Customer content may be written in Spanish or English depending on the customer; the app
  displays content as-is and does not translate it.
