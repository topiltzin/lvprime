---

description: "Task list template for feature implementation"
---

# Tasks: Weekly Program Tabs with PDF Download

**Input**: Design documents from `/specs/003-program-weekly-tabs-pdf/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: This feature's contracts define unit-testable pure logic (weekly progression
parsing, the PDF content-model builder) and an integration check on the API payload —
consistent with the existing project convention (`app/tests/unit/`, `app/tests/integration/`),
these get real `node --test` coverage. Actual rendered PDF output and UI interaction are
verified manually via the `quickstart.md` scenarios, per research.md §4.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: Which user story this task belongs to (US1–US2); Setup/Foundational/Polish tasks carry no story label
- File paths are exact and relative to the repository root

## Path Conventions

Single existing local web app at `app/` (frontend `app/src/`, local API `app/server/`, tests
`app/tests/`) — see plan.md → Project Structure. `customers/*/program.md` files (source of
truth) are not modified by this feature — see spec.md Assumptions.

---

## Phase 1: Setup

**Purpose**: Bring in the one new dependency this feature needs

- [X] T001 Add `jspdf` as a runtime dependency: `cd app && npm install jspdf` (updates
      `app/package.json` and `app/package-lock.json`), per research.md §1's decision to
      generate PDFs client-side with a small text-based PDF library rather than a server-side
      headless browser or DOM-screenshot library

**Checkpoint**: `jspdf` importable from `app/src/**` via ESM.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared data and styling both user stories build on

**⚠️ CRITICAL**: No user story work can be considered complete until this phase is done, since both stories read `weeklyProgression` and both render into the same Program tab area

- [X] T002 Extend `parseProgramDetail()` in `app/server/markdown-parser.js` to also return
      `weeklyProgression: { weekNumber: number, text: string }[]`, per
      contracts/weekly-progression-parsing.md's matching rule: scan the existing
      "Progresión Semanal"/"Weekly Progression" section (the same section `progressionHtml`
      already captures) for bullet lines matching `**Semana N:**` / `**Week N:**`
      (case-insensitive); each becomes `{ weekNumber: N, text: <rest of line, trimmed> }`;
      drop entries where `N` is outside `1..4`; return `[]` (never `null`) when no such
      section exists; on a duplicate `weekNumber`, keep only the first occurrence. Do not
      change or remove the existing `progressionHtml` field or its parsing. No change to
      `app/server/index.js` is needed — its `program = { present: true, ...detail }` spread
      (line ~90) already forwards any new field returned by `parseProgramDetail()`.
- [X] T003 [P] Add `.week-subnav` / `.week-chip` CSS rules to `app/src/styles/main.css`,
      mirroring the existing `.day-subnav` / `.day-chip` rules (same file, ~line 341) per
      research.md §3, plus a `.pdf-download-button` rule (full-width on mobile widths,
      consistent with other Program tab controls) and a small inline error-message style for
      failed PDF generation (FR-009)

**Checkpoint**: Foundation ready — `program.weeklyProgression` is available on every customer
detail API response, and styling exists for both stories' new UI elements.

---

## Phase 3: User Story 1 - Browse the program week by week (Priority: P1) 🎯 MVP

**Goal**: Inside the Program tab, show four week selectors (Week 1–4); switching between them
keeps the same day-by-day schedule visible while swapping in that week's progression note (or
an explicit fallback message when none exists).

**Independent Test**: Open `jaqueline-orellano`'s Program tab, switch between all four week
selectors, and confirm the day-by-day schedule stays identical while the progression note
shown updates per week (quickstart.md Scenario 1); open a customer with no weekly progression
section and confirm all four selectors still appear with the fallback message (quickstart.md
Scenario 2).

### Tests for User Story 1

- [X] T004 [P] [US1] Add cases to `app/tests/unit/markdown-parser.test.js` for
      `weeklyProgression` per contracts/weekly-progression-parsing.md's acceptance criteria:
      (a) a well-formed 4-entry section → exactly 4 entries, `weekNumber` 1–4, `text` matching
      authored content; (b) no weekly progression section at all → `weeklyProgression: []`;
      (c) a section covering only some weeks (e.g. 1 and 3) → exactly those entries, no
      synthetic entries for the missing weeks; (d) an out-of-range week number (e.g.
      `Semana 5:`) → that entry excluded, rest of the file parses unaffected
- [X] T005 [P] [US1] Add a case to `app/tests/integration/customer-detail.test.js` asserting
      the customer detail API response's `program` object includes a `weeklyProgression`
      array (contracts/weekly-progression-parsing.md Testing Checklist)

### Implementation for User Story 1

- [X] T006 [US1] Create `app/src/components/week-subnav.js` exporting
      `renderWeekSubnav(activeWeek, onSelect)`: renders exactly four chips in fixed order
      ("Week 1".."Week 4"), marks the chip matching `activeWeek` as active/selected
      (`aria-selected`/active class), calls `onSelect(weekNumber)` on click, and supports
      `ArrowLeft`/`ArrowRight` keyboard navigation with wrap-around at the ends, per
      contracts/week-tab-navigation.md — mirror the structure of `renderDaySubnav()` in
      `app/src/components/program-day.js` (~line 77) rather than introducing a new pattern
- [X] T007 [US1] In `app/src/components/tab-container.js`, add per-instance state
      `this.activeWeek = 1` (initialized in the constructor, so it resets to Week 1 on every
      fresh `TabContainer` instantiation — i.e. per customer page load, satisfying
      contracts/week-tab-navigation.md's Default Selection rule with no extra reset logic
      needed) and, in `renderProgramContent()`, render `week-subnav.js`'s output above the
      existing day-subnav/`weeklySchedule` rendering, wiring `onSelect` to update
      `this.activeWeek` and re-render only the progression-note area (day cards/exercises
      from `renderProgramDay`/`renderDaySubnav` must not be re-rendered or reordered on week
      switch — FR-003, FR-011)
- [X] T008 [US1] In `tab-container.js`'s `renderProgramContent()`, compute and render the
      active week's progression note by looking up
      `program.weeklyProgression.find(e => e.weekNumber === this.activeWeek)?.text`; when no
      entry matches, render the literal fallback text "No specific guidance for this week."
      instead (FR-005, data-model.md's Program Week `progressionText` derivation) — this
      lookup/fallback logic will be reused by US2's PDF builder (T011), so keep it as a small
      pure helper (e.g. `resolveProgressionText(weekNumber, weeklyProgression)`) rather than
      inlining it only in the DOM-rendering path
- [X] T009 [US1] In `tab-container.js`, gate the week subnav (and, once added in US2, the PDF
      button) behind `program.present` — when `false`, the existing "no program yet" empty
      state must continue to render exactly as it does today, with neither new element shown
      (FR-010)

**Checkpoint**: User Story 1 is fully functional and independently testable — quickstart.md
Scenarios 1, 2, and 4 all pass.

---

## Phase 4: User Story 2 - Download the currently viewed week as a PDF (Priority: P2)

**Goal**: A "Download PDF" button at the end of the Program tab generates and downloads a
self-contained PDF of whichever week is currently selected.

**Independent Test**: With any week selected, click "Download PDF" and confirm a PDF
downloads containing that week's label, schedule, and progression note; switch weeks and
click again, confirming the second PDF reflects the new week (quickstart.md Scenario 3).

### Tests for User Story 2

- [X] T010 [P] [US2] Create `app/tests/unit/program-pdf.test.js` covering
      `buildProgramWeekPdfContent(weekNumber, programDetail)` per
      contracts/pdf-export-download.md's Testing Checklist: (a) a week with a matching
      `weeklyProgression` entry → `progressionText` equals that entry's text; (b) a week with
      no matching entry → `progressionText` equals the FR-005 fallback message; (c) an empty
      `weeklySchedule` → `days: []` in the returned content model (no throw)

### Implementation for User Story 2

- [X] T011 [US2] Create `app/src/components/program-pdf.js` exporting the pure function
      `buildProgramWeekPdfContent(weekNumber, programDetail)` returning
      `{ weekLabel: "Week " + weekNumber, days: programDetail.weeklySchedule,
      progressionText }`, where `progressionText` reuses the lookup/fallback helper from T008
      (data-model.md's Program PDF Document) — no DOM or `jsPDF` dependency in this function,
      so it is testable with plain `node --test` assertions (depends on T008)
- [X] T012 [US2] In `program-pdf.js`, add `downloadProgramWeekPdf(weekNumber, programDetail,
      customerSlug)`: call `buildProgramWeekPdfContent`, render it with `jsPDF` as real
      selectable text — a heading with `weekLabel`, one section per day in `days` (day
      name/focus, then each exercise's name/sets-reps/rest/form tip), and a progression-note
      section with `progressionText` — falling back to an explicit "No schedule available."
      line when `days` is empty (FR-007, spec.md Edge Cases); produce the result as a `Blob`
      and trigger a browser download via a temporary `<a download>` element named
      `<customerSlug>-week-<weekNumber>.pdf`, per contracts/pdf-export-download.md (depends
      on T011, T001)
- [X] T013 [US2] In `tab-container.js`, render a "Download PDF" button once, after the week
      content, inside the Program tab panel (gated by the same `program.present` check as
      T009), wired to call
      `downloadProgramWeekPdf(this.activeWeek, program, this.slug)` — reading `this.activeWeek`
      fresh at click time, so a click after switching weeks reflects the newly active week
      (spec.md User Story 2 Acceptance Scenario 2) (depends on T007, T009, T012)
- [X] T014 [US2] Wrap the click handler from T013 in a try/catch: on any error thrown by
      `downloadProgramWeekPdf`, show an inline error message using the existing
      `app/src/components/toast.js` component and leave the button clickable again — no
      unhandled error, no stuck/disabled state (FR-009)

**Checkpoint**: User Stories 1 and 2 both work independently — all of quickstart.md Scenarios
1–4 pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across both stories

- [X] T015 [P] Run `cd app && npm test`; fix any regressions in
      `app/tests/unit/markdown-parser.test.js`, `app/tests/unit/program-pdf.test.js`, and
      `app/tests/integration/customer-detail.test.js`
- [X] T016 Execute `quickstart.md` Scenarios 1–4 by hand against `npm run dev` (week
      switching/default selection, no-progression-section fallback, PDF download reflecting
      the active week across at least 3 sample customers including the empty-schedule case,
      and empty-state precedence), plus the viewport check at ~390px and ~1280px — this
      satisfies Constitution Principle IV's requirement that an exported deliverable be
      verified to render without errors before being handed to the customer
- [X] T017 [P] Confirm the existing `progressionHtml` field and its rendering (used
      independently of per-week matching, per spec.md Assumptions) are unchanged for both
      fixture customers (`jaqueline-orellano`, `topiltzin-flores`) after T002's parser
      extension

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001, for T012 later) — BLOCKS both user
  stories; T002 and T003 have no dependency on each other and can run in parallel
- **User Story 1 (Phase 3)**: Depends on Foundational (T002 for data, T003 for styling)
- **User Story 2 (Phase 4)**: Depends on Foundational (T001, T003) and on US1's T008 (reuses
  the progression lookup/fallback helper) and T007/T009 (active-week state, visibility gate)
- **Polish (Phase 5)**: Depends on both user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 — fully independently testable on its
  own (quickstart.md Scenarios 1, 2, 4)
- **User Story 2 (P2)**: Builds on US1's active-week state and progression-lookup helper
  (T007, T008, T009) — this is an intentional integration, not a violation of independent
  testability, since US2's own independent test (quickstart.md Scenario 3) only requires US1
  to already be in place, matching spec.md's stated priority order (P2 depends on P1 existing)

### Within Each User Story

- Tests before implementation (write T004/T005 and T010 first; confirm they fail before
  T002/T006–T009 and T011/T012 respectively make them pass)
- Pure logic (parser extension, content-model builder) before DOM/rendering code that
  consumes it
- Story complete and checkpointed before moving to the next priority

### Parallel Opportunities

- T002 and T003 (Foundational) can run in parallel — different files
- T004 and T005 (US1 tests) can run in parallel — different files
- T010 (US2 test) can run in parallel with any US1 task once T008 exists, since it only needs
  `buildProgramWeekPdfContent`'s eventual signature to write against (or can be written first
  and left failing, per TDD)
- T015 and T017 (Polish) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch both foundational tasks together (different files):
Task: "Extend parseProgramDetail() to parse weeklyProgression in app/server/markdown-parser.js"
Task: "Add .week-subnav/.week-chip/.pdf-download-button CSS rules in app/src/styles/main.css"
```

## Parallel Example: User Story 1 Tests

```bash
Task: "Add weeklyProgression parsing cases to app/tests/unit/markdown-parser.test.js"
Task: "Add weeklyProgression API-payload case to app/tests/integration/customer-detail.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003) — CRITICAL, blocks both stories
3. Complete Phase 3: User Story 1 (T004–T009)
4. **STOP and VALIDATE**: Run quickstart.md Scenarios 1, 2, 4 — week browsing works fully
   without the PDF button existing yet
5. Demo if ready — this alone delivers the primary value described in spec.md's Summary

### Incremental Delivery

1. Setup + Foundational → weekly progression data and styling ready
2. Add User Story 1 → validate independently → demo (MVP)
3. Add User Story 2 → validate independently (quickstart.md Scenario 3) → demo
4. Polish (Phase 5) → full regression pass + manual render verification

---

## Notes

- [P] tasks touch different files and have no unfinished-task dependency between them
- [Story] label maps each task to spec.md's US1/US2 for traceability
- No task in this feature writes to `customers/*/program.md`, `feedback.md`, or `notes.md` —
  Constitution Principle II's pre-save verification gate does not apply to this feature
- Commit after each task or logical group; stop at either checkpoint to validate a story
  independently before continuing
