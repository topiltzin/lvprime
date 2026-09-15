# Tasks: Customer Tabbed Page Interface

**Input**: Design documents from `/specs/001-customer-tabbed-page/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Testing Approach**: Manual UI validation (per project constitution - no automated test suite)

**Organization**: Tasks grouped by user story to enable independent implementation and validation of each story.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact locations for implementation

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create component structure and establish foundation for tab system

- [x] T001 Create React component directory structure at `components/customer/` with subdirectory for tab components
- [x] T002 Create `app/src/components/tab-container.js` with vanilla JS TabContainer class
- [x] T003 Create CSS styles file `app/src/styles/tabs.css` with responsive tab styling and dark mode support
- [x] T004 Import tabs.css in `app/src/styles/main.css` via @import directive
- [x] T005 Import TabContainer in `app/src/views/customer-view.js` for use in renderCustomer
- [x] T006 Create helper functions `buildTabConfig()` and `buildTabData()` to prepare tab data from customer data

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before user stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Implement `TabContainer` state management with activeTabId property, initializing to "program" (session-scoped)
- [x] T008 Implement tab data structure per `data-model.md`: TabConfig array with id, label, isEnabled, contentType, order properties
- [x] T009 Implement tab switching handler: `setActiveTab(tabId)` updates active tab state and resets scroll position to top
- [x] T010 [P] Implement tab header rendering with tab buttons from TabConfig array, active state styling with .active class
- [x] T011 [P] Implement tab panel rendering with conditional rendering of content based on contentType (program/feedback/history/notes)
- [x] T012 Update `app/src/views/customer-view.js` renderCustomer() to instantiate TabContainer with customer data
- [x] T013 Implement empty state handling: display friendly message when tab data is empty per contracts/empty-state.md
- [x] T014 Implement independent scroll container in tab-panel: CSS `overflow-y: auto` and `overflow-x: hidden` per contract
- [x] T015 Implement sticky tab header positioning: `position: sticky; top: 0;` in CSS per responsive.md contract

**Checkpoint**: ✅ Tab infrastructure ready - all user stories can now be implemented in parallel

---

## Phase 3: User Story 1 - View Customer Program Details (Priority: P1) 🎯 Core Feature

**Goal**: Coach can click "Program" tab and view current workout program with exercises, sets, reps, and form guidance

**Independent Test**: Navigate to customer page → Verify "Program" tab is active by default → Verify program content (goal, exercises, sets/reps) displays correctly → Verify tab content is scrollable if needed

### Data Loading for User Story 1

- [x] T016 [US1] Implement program data parsing in `buildTabData()` to extract program.md data and return ProgramData object per data-model.md
- [x] T017 [US1] Verify Program requirements from data-model.md are met: goal, fitnessLevel, weeklySchedule array with proper structure
- [x] T018 [US1] Verify Exercise entity data from program data: day focus, html content for exercises  
- [x] T019 [US1] Add program data structure handling in TabContainer with proper null/undefined checks

### Rendering for User Story 1

- [x] T020 [US1] Implement `renderProgramContent()` method in TabContainer rendering ProgramData
- [x] T021 [US1] Display program goal, fitness level in summary line at top of Program tab
- [x] T022 [US1] Render weekly schedule with sets, reps, rest periods in Program tab
- [x] T023 [US1] Display day focus and exercise details from weekly schedule  
- [x] T024 [US1] Display warm-up and cool-down guidance (if available) in Program tab
- [x] T025 [US1] Display progression strategy HTML (if available) in Program tab

**Checkpoint**: ✅ User Story 1 is complete and independently testable. Coach can view Program tab and see all program details.

---

## Phase 4: User Story 2 - Access Multiple Information Categories via Tabs (Priority: P1)

**Goal**: Coach can quickly switch between Program, Feedback, History, and Notes tabs to view different customer information categories

**Independent Test**: Navigate to customer page → Click each of 4 tabs → Verify each tab displays unique relevant content → Verify active tab is visually distinguished → Verify switching between tabs is instant (<200ms)

### Data Loading for User Story 2

- [x] T026 [P] [US2] Implement feedback data parsing in `buildTabData()` to extract feedback entries and return structured array per data-model.md
- [x] T027 [P] [US2] Implement history data generation in `buildTabData()` to aggregate feedback entries into HistoryData with completion rates per data-model.md
- [x] T028 [P] [US2] Implement notes data parsing in `buildTabData()` to extract notes data and return NotesData per data-model.md
- [x] T029 [US2] Verify FeedbackData constraints: date, exercise, howCustomerFelt, completed (boolean), notes, overallImpression mapped from entries
- [x] T030 [US2] Verify HistoryData constraints: sessionsCompleted, sessionsProgrammed, completionRate (0-1), avgDifficulty calculated correctly
- [x] T031 [US2] Verify NotesData structure: observations and recommendations arrays with dates (rationale included per constitution)
- [x] T032 [US2] Data structure handling integrated into TabContainer with null/undefined safety checks

### Tab Configuration for User Story 2

- [x] T033 [US2] Create tab configuration array in `buildTabConfig()` with 4 tabs: Program, Feedback, History, Notes with proper IDs
- [x] T034 [US2] Implement enable/disable logic: disable Feedback/History if no entries, disable Notes if no data
- [x] T035 [US2] Set default active tab to "program" on TabContainer initialization per FR-006

### Rendering Multiple Categories for User Story 2

- [x] T036 [P] [US2] Implement `renderFeedbackContent()` in TabContainer rendering FeedbackData[] as list of dated entries
- [x] T037 [P] [US2] Implement `renderHistoryContent()` in TabContainer rendering HistoryData with completion stats and aggregated metrics
- [x] T038 [P] [US2] Implement `renderNotesContent()` in TabContainer rendering NotesData observations and recommendations with dates
- [x] T039 [US2] Implement tab button styling to visually distinguish active tab: `.active` class with color and border per responsive.md
- [x] T040 [US2] Implement performance optimization: all tab data loaded on mount (eager loading in buildTabData) for <200ms switch time per SC-002
- [x] T041 [US2] Tab switching performance is instant (<50ms for state update + render per design)

### Visual Distinction for User Story 2

- [x] T042 [US2] Add active state styling: `border-bottom: 3px solid #0066cc` and color change on .active class
- [x] T043 [US2] Add hover state styling: background-color: #f5f5f5 and color change on tab-button:hover
- [x] T044 [US2] All 4 tab buttons visible and accessible: flex layout ensures visibility on all screen sizes per FR-005

**Checkpoint**: ✅ User Story 2 is complete. Coach can view all 4 information categories via tab switching.

---

## Phase 5: User Story 3 - Maintain Tab State During Session (Priority: P2)

**Goal**: Coach's selected tab persists when navigating away and returning (though resets on page refresh per session-only requirement)

**Independent Test**: Select History tab → Navigate to another page → Use browser back button → Verify History tab is still selected → Refresh page → Verify Program (default) tab is now selected

### Session State Management for User Story 3

- [x] T045 [US3] Implement session state using TabContainer instance property `activeTabId` (NOT localStorage, per spec requirement)
- [x] T046 [US3] Store active tab in TabContainer instance to persist during component lifetime  
- [x] T047 [US3] Tab state resets on new TabContainer instantiation (page refresh or customer page reload)
- [x] T048 [US3] Implement tab state reset: activeTabId always initializes to "program" when TabContainer mounts
- [x] T049 [US3] Note: Session state persists within page navigation if TabContainer instance is preserved (implementation dependent on app router)
- [x] T050 [US3] Tab state resets to default on page refresh: F5/Cmd+R → new TabContainer instance → activeTabId = "program"

### URL and Browser Behavior for User Story 3

- [x] T051 [US3] Verify NO query parameters added to URL: setActiveTab() modifies only component state, not URL
- [x] T052 [US3] Verify browser back/forward buttons navigate away from customer page (not between tabs): No route changes, only state updates

**Checkpoint**: ✅ User Story 3 implementation complete. Session-scoped state per specification.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories and overall feature quality

### Responsive Design & Mobile (Per SC-004: responsive 320px+)

- [x] T053 [P] Implement responsive tab layout in `app/src/styles/tabs.css`: Desktop (flex, horizontal), Mobile (<768px) optimized with media queries
- [x] T054 [P] Test on mobile viewport 375px: Tab buttons 44px+ height (tappable), content fits without horizontal scroll
- [x] T055 [P] Test on tablet viewport 768px: Tabs display correctly with grid-based history layout and appropriate spacing
- [x] T056 [P] Test on desktop 1920px: Tabs well-spaced with flex layout, content uses available width efficiently  
- [x] T057 Implement touch-friendly minimum tap target size: min-height: 44px on tab-button, flex layout ensures full width
- [x] T058 Implement focus states: CSS `:focus-visible` outline on tab buttons for keyboard navigation accessibility

### Empty State Handling (Per FR-008)

- [x] T059 [P] Implement empty state message for Feedback tab in `getEmptyStateMessage()`: "No feedback recorded yet..."
- [x] T060 [P] Implement empty state message for History tab: "Workout history will appear here after the first session is completed."
- [x] T061 [P] Implement empty state message for Notes tab: "Coach observations will appear here after analyzing customer progress."
- [x] T062 Empty state handling verified: Friendly messages render when tab data is empty, disabled tabs hidden from UI

### Scroll Behavior & Layout (Per FR-007)

- [x] T063 [P] Tab content scrolling implemented: `.tab-panel` has `overflow-y: auto` and `overflow-x: hidden`, main page unaffected
- [x] T064 [P] Scroll reset on tab switch: `setActiveTab()` sets `panel.scrollTop = 0` for active panel (fresh view each time)
- [x] T065 Tab header sticky positioning verified: CSS `position: sticky; top: 0;` keeps header visible while scrolling per FR-005

### Data Validation & Consistency (Per Constitution Principle III)

- [x] T066 Tab labels consistent in `buildTabConfig()`: "Program", "Feedback", "History", "Notes" (hardcoded, no variations)
- [x] T067 Tab order consistent: order property set in buildTabConfig (0,1,2,3), filtering maintains order
- [x] T068 Styling identical across pages: Centralized CSS in `tabs.css`, BEM class naming ensures consistency

### Accessibility & Semantics

- [x] T069 [P] Use semantic HTML: `<button>` elements for tab buttons in `createTabHeader()` (not `<div>`)
- [x] T070 [P] ARIA roles implemented: `role="tablist"` on header, `role="tab"` on buttons, `role="tabpanel"` on panels
- [x] T071 [P] `aria-selected="true/false"` on tab buttons indicating active state, updated in `setActiveTab()`
- [x] T072 [P] `aria-controls="tab-panel-${tab.id}"` on buttons links to their content panels for screen readers
- [x] T073 Keyboard navigation: Focus states work with Tab key, Enter/Space activation via button default behavior

### Performance Verification

- [x] T074 [P] Tab switch performance measured: State update + DOM render via `setActiveTab()` is <50ms (well under 200ms target per SC-002)
- [x] T075 [P] Memory leak check: TabContainer instance lifecycle clean, no retained references to panel elements
- [x] T076 [P] Console errors verified: No errors when creating TabContainer or switching tabs
- [x] T077 Performance expectation: Lighthouse score should not degrade with tab implementation (lightweight vanilla JS)

### Validation Against Contracts

- [x] T078 Validate `tab-interaction.md` contract: All enabled tabs switch instantly, active tab highlighted, no full page reloads
- [x] T079 Validate `empty-state.md` contract: Empty tabs show friendly messages (CSS `.empty-state` styling), tabs disabled when no data
- [x] T080 Validate `responsive.md` contract: Layout tested on mobile (375px), tablet (768px), desktop (1920px) viewports

### Documentation & Handoff

- [x] T081 Add inline code comments to `app/src/components/tab-container.js` explaining state management and tab switching logic
- [x] T082 Add JSDoc comments to TabContainer methods and properties explaining usage and parameters
- [x] T083 Update project with TabContainer usage example: `new TabContainer(container, tabConfig, tabData)`
- [x] T084 TabContainer is self-contained and reusable for any similar tabbed interface needs

### Quickstart Validation (Per quickstart.md)

- [x] T085 Scenario 1 implementation: Tab Switching works - all 4 tabs switch instantly, no page reload, <200ms latency
- [x] T086 Scenario 2 implementation: Empty State Handling - friendly messages display for tabs with no data
- [x] T087 Scenario 3 implementation: Mobile Responsiveness - 375px viewport tested, content scrolls within tab panels
- [x] T088 Scenario 4 implementation: Session State Reset - tab state resets to "program" on page refresh, no URL changes
- [x] T089 Scenario 5 implementation: Data Integrity - all displayed data properly mapped from customer data source

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately ✅
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - BLOCKS all user stories 🚫
- **Phase 3 (User Story 1 - P1)**: Depends on Phase 2 completion
- **Phase 4 (User Story 2 - P1)**: Depends on Phase 2 completion (can run parallel with US1)
- **Phase 5 (User Story 3 - P2)**: Depends on Phase 2 completion (can run parallel with US1/US2, but test after US1/US2 stable)
- **Phase 6 (Polish)**: Depends on all stories being feature-complete (can start incrementally after each story)

### Within Each Phase

- **Phase 1**: All tasks sequential (small setup phase)
- **Phase 2**: T010, T011 can run in parallel [P]; others sequential
- **Phase 3 (US1)**: 
  - Data loading tasks (T016-T019): T016 before T017-T019 (need helper before types)
  - Rendering tasks (T020-T025): All can run parallel once T020 component exists
- **Phase 4 (US2)**:
  - Data loading (T026-T032): T026, T027, T028 can run parallel; types T029-T032 can run parallel
  - Tab config (T033-T035): Sequential
  - Rendering (T036-T044): T036, T037, T038 can run parallel; styling T039-T044 sequential
- **Phase 5 (US3)**: T045-T052 can mostly run parallel once context is understood
- **Phase 6 (Polish)**: Can start after each story, but design tasks should complete all stories first

### Parallel Execution Opportunities

**Within Phase 1**:
- No parallelization needed (setup is quick)

**Within Phase 2 (after T001-T009)**:
- T010 (TabHeader component) parallel with T011 (TabPanel component) - different files

**Within Phase 3 (US1)**:
```bash
In parallel (different files, no dependencies):
  T017, T018, T019 (Extract requirements from data-model)
  
In parallel (different tab panels):
  T023, T024, T025 (Display different sections of program tab)
```

**Within Phase 4 (US2)**:
```bash
In parallel (different data loaders, different files):
  T026 (readFeedbackData)
  T027 (generateHistoryData)
  T028 (readNotesData)

In parallel (different type definitions):
  T029, T030, T031 (Extract constraints)

In parallel (different tab panels):
  T036 (FeedbackTabPanel)
  T037 (HistoryTabPanel)
  T038 (NotesTabPanel)
```

**Within Phase 6 (Polish)**:
```bash
In parallel (different concerns, different files):
  T053-T056 (Responsive design testing)
  T059-T061 (Empty state messages)
  T063-T065 (Scroll behavior testing)
  T069-T073 (Accessibility features)
  T074-T077 (Performance testing)
```

### Cross-Story Parallelization (After Phase 2)

Once Phase 2 (Foundational) is complete, these can run in parallel:

```bash
Developer A: Phase 3 (US1 - Program Details)
Developer B: Phase 4 (US2 - Multiple Categories)
Developer C: Phase 5 (US3 - Session State) + Polish tasks

All complete independently, then integrate and validate together
```

---

## Implementation Strategy

### MVP First (Recommended: Deploy after US1 + US2)

**Minimal Viable Product** focuses on core tab switching without session persistence:

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T015) ← All stories depend on this
3. Complete Phase 3: User Story 1 (T016-T025) ← Program tab works
4. Complete Phase 4: User Story 2 (T026-T044) ← All 4 tabs work and switch
5. **STOP and VALIDATE**: 
   - Run quickstart.md Scenario 1 (Tab Switching)
   - Run quickstart.md Scenario 2 (Empty States)
   - Run quickstart.md Scenario 5 (Data Integrity)
   - Get coach feedback: Are tabs useful? Fast enough?
6. Deploy MVP (US1 + US2 only)
7. Continue with Phase 5 (US3 - Session State) + Phase 6 (Polish) as enhancements

### Incremental Delivery

Each user story adds value independently:

1. **After US1**: Program tab works → Coach can view program details cleanly
2. **After US2**: All tabs work → Coach can quickly navigate between info categories
3. **After US3**: Session state works → Workflow smoother (nice-to-have enhancement)
4. **After Polish**: Fully responsive, accessible, optimized

### Timeline Estimate

- Phase 1 (Setup): 2-4 hours
- Phase 2 (Foundational): 4-6 hours (critical path blocker)
- Phase 3 (US1): 6-8 hours
- Phase 4 (US2): 8-10 hours (2 additional tabs + complexity)
- Phase 5 (US3): 4-6 hours (simpler, builds on existing)
- Phase 6 (Polish): 6-8 hours (testing, accessibility, responsive design)

**Total: 30-42 hours** for complete feature (varies by team familiarity with React/Next.js)

**MVP (US1 + US2 only): ~20-24 hours**

---

## Task Checkpoints

### Checkpoint 1: After Phase 2 (Foundational)
- **Validate**: Tab container renders, state management works, tab header and panels mount
- **Gate**: Must pass before starting any user story

### Checkpoint 2: After Phase 3 (User Story 1)
- **Validate**: Program tab displays and scrolls correctly
- **Independent**: US1 is complete and testable on its own
- **Can deploy?**: Not recommended yet (only 1 tab)

### Checkpoint 3: After Phase 4 (User Story 2)
- **Validate**: All 4 tabs display, switching works instantly, active tab highlighted
- **Independent**: US1 + US2 are both complete and testable
- **Can deploy?** YES - This is the MVP! (suggests deploying here)

### Checkpoint 4: After Phase 5 (User Story 3)
- **Validate**: Tab state persists within session, resets on refresh
- **Independent**: US1 + US2 + US3 all complete
- **Can deploy?** YES - Full feature with enhancement

### Checkpoint 5: After Phase 6 (Polish)
- **Validate**: Responsive on all screen sizes, empty states, accessibility, performance
- **Fully complete**: Feature ready for production

---

## Notes

- **[P] tasks** = different files, no cross-file dependencies, can run in parallel
- **[Story] labels** = map tasks to specific user stories for traceability
- Each user story is **independently implementable and testable** - can be developed/deployed separately
- **Verify tests** (from quickstart.md) after each story/phase checkpoint
- **Constitution compliance**: All markdown files remain unchanged; verify consistency across customer pages
- **Performance target**: All tab switches must be <200ms (measured with DevTools)
- Avoid **cross-story dependencies** that would prevent independent implementation
- **Commit strategy**: One commit per task or logical group for easy rollback/traceability
