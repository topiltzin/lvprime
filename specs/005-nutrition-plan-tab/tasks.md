# Tasks: Nutrition Plan Tab in Customer UI

**Input**: Design documents from `/specs/005-nutrition-plan-tab/`

**Prerequisites**: plan.md (✅ complete), spec.md (✅ complete), data-model.md (✅ complete), contracts/ (✅ complete), research.md (✅ complete)

**Tests**: Validation scenarios provided in quickstart.md (optional integration/UI tests)

**Organization**: Tasks are grouped by user story (US1, US2, US3, US4) to enable independent implementation and testing of each story.

**Tech Stack**: JavaScript/Node.js, Vite, Vue 3, `marked` (v13.0.3), file-based storage

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and environment setup

- [x] T001 Verify project dependencies installed (`npm install` in app/ directory)
- [x] T002 Verify development server runs (`npm run dev` or `npm run start`)
- [x] T003 Review existing tab architecture in `app/src/components/tab-container.js` (understand TabConfig, renderTabContent pattern)
- [x] T004 Review customer profile loading in `app/src/views/customer-view.js` (understand how data flows to TabContainer)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create API endpoint in `app/server/serve.js` for `GET /api/customer/:slug/nutrition` (per contracts/nutrition-tab-api.md)
  - Must handle customer slug validation ✓
  - Must read `/customers/{slug}/nutrition_plan.md` file ✓
  - Must return JSON: `{ content: "...", isEmpty: boolean, lastModified: "..." }` ✓
  - Must return 404 if customer not found ✓
  - Must return 400 if slug format invalid ✓
  - Must return 413 if file exceeds 100KB (per FR-008) ✓
  - Must return 500 if file read fails ✓
- [x] T006 Verify `marked` library is available in `app/package.json` (v13.0.3 already listed)
- [x] T007 Create placeholder styling for nutrition tab content in `app/src/styles/` (if separate style file needed, create `nutrition-tab.css`)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel ✓

---

## Phase 3: User Story 1 - Coach Views Customer's Nutrition Plan (Priority: P1) 🎯 MVP

**Goal**: Coach can navigate to customer profile, click Nutrition Plan tab, and see nutrition content

**Independent Test**: 
1. Open browser to http://localhost:5173
2. Navigate to a customer with existing nutrition_plan.md
3. Click Nutrition Plan tab
4. Verify content from nutrition_plan.md displays in tab panel

### Implementation for User Story 1

- [x] T008 [P] [US1] Modify `app/src/views/customer-view.js` to load nutrition data from API
  - Add API call to `GET /api/customer/{slug}/nutrition` when customer profile loads ✓
  - Store response in `data.nutrition` object (structure: { content, isEmpty, error }) ✓
  - Pass nutrition data to TabContainer with other tab data (program, feedback, notes) ✓

- [x] T009 [US1] Modify `app/src/components/tab-container.js` to add nutrition tab configuration
  - Add tab config object: `{ id: 'nutrition', label: 'Nutrition Plan', isEnabled: true, contentType: 'nutrition', order: 2 }` ✓
  - Register this config in the tabs array passed to TabContainer ✓
  - Ensure nutrition tab appears in correct position (after Program, before Feedback) ✓

- [x] T010 [US1] Extend `renderTabContent()` method in `app/src/components/tab-container.js` to handle nutrition content type
  - Add case for `tab.contentType === 'nutrition'` ✓
  - Render nutrition content panel with class `tab-content-nutrition` ✓
  - Return rendered content element ✓

- [x] T011 [US1] Implement nutrition tab rendering logic in `app/src/components/tab-container.js`
  - For nutrition content, extract `data.nutrition.content` (markdown string) ✓
  - Use `marked(content)` to convert markdown to HTML (marked library already imported in package.json) ✓
  - Insert rendered HTML into `.nutrition-rendered-html` container ✓
  - Apply CSS class `nutrition-content` to main container ✓
  - Handle lazy rendering (render only when tab is clicked, not on page load) ✓

- [x] T012 [US1] Add basic styling for nutrition tab content in `app/src/styles/` (or update existing styles)
  - `.nutrition-content` - Main container styling ✓
  - `.nutrition-rendered-html` - Container for markdown HTML output ✓
  - Font family, line height, spacing consistent with other tabs (Program, Feedback, Notes) ✓
  - Ensure readability and hierarchy visible ✓

**Checkpoint**: User Story 1 complete - coach can view nutrition plan content ✓

---

## Phase 4: User Story 2 - Nutrition Plan Tab Displays Formatted Content (Priority: P1)

**Goal**: Markdown formatting (headers, lists, tables, emphasis) renders correctly with visual hierarchy

**Independent Test**:
1. Create/use test customer with nutrition_plan.md containing markdown formatting
2. Open Nutrition Plan tab
3. Verify: headings (h1-h6) render at different sizes, lists have bullets, tables display rows/columns, bold/italic visible

### Implementation for User Story 2

- [x] T013 [P] [US2] Ensure `marked` is configured correctly for full markdown feature support in `app/src/components/tab-container.js`
  - Verify marked handles: headings, lists (ordered/unordered), tables, code blocks, emphasis (bold/italic), links, blockquotes ✓
  - Call: `marked(content)` with default or minimal options (marked library handles most markdown by default) ✓
  - No custom markdown extensions needed (per research.md) ✓

- [x] T014 [US2] Apply CSS styling to markdown output in `app/src/styles/` for visual hierarchy
  - Style `<h1>`, `<h2>`, `<h3>`, etc. with decreasing sizes (consistent with program.md styling if available) ✓
  - Style `<ul>` and `<ol>` with proper bullets/numbering ✓
  - Style `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` with borders and alignment ✓
  - Style `<strong>`, `<em>`, `<code>` with weight/style distinction ✓
  - Style `<blockquote>` with left border or background ✓
  - Ensure links (`<a>`) are blue and underlined ✓
  - Ensure monospace font for `<code>` and `<pre>` ✓

- [x] T015 [US2] Verify markdown rendering with test nutrition plan (quickstart.md Scenario 2)
  - Test with jaqueline-orellano customer's nutrition_plan.md ✓
  - Verify all markdown elements render correctly ✓
  - Check visual hierarchy is clear and scannable ✓
  - No rendering errors in browser console ✓

**Checkpoint**: User Story 2 complete - markdown formatting displays correctly ✓

---

## Phase 5: User Story 3 - PDF Export Remains Available for Program (Priority: P2)

**Goal**: Verify existing program PDF export is not broken and still works as before

**Independent Test**:
1. Open customer profile on Program tab
2. Click PDF export button
3. Verify: PDF downloads, contains program content, does NOT contain nutrition content

### Implementation for User Story 3

- [x] T016 [US3] Verify PDF export functionality is NOT modified
  - Check `app/src/components/program-pdf.js` - should have no changes ✓
  - Check `app/server/serve.js` - ensure existing PDF export endpoint unchanged ✓
  - Nutrition API endpoint (T005) is separate and does NOT interact with PDF export ✓

- [x] T017 [US3] Test PDF export regression (quickstart.md Scenario 3)
  - Load customer profile ✓
  - Click Program tab ✓
  - Locate export button ✓
  - Download PDF ✓
  - Verify: PDF is valid, contains program content, no nutrition content ✓
  - Verify: PDF rendering matches previous version (if version history available) ✓

**Checkpoint**: User Story 3 complete - PDF export regression = 0 ✓

---

## Phase 6: User Story 4 - Nutrition Plan Tab Appears in Customer Profile (Priority: P2)

**Goal**: Nutrition Plan tab is visible in tab navigation and shows helpful message when no plan exists

**Independent Test**:
1. Open customer profile (any customer)
2. Verify: Nutrition Plan tab visible in tab bar
3. For customer without nutrition_plan.md, click tab and verify empty state message displays

### Implementation for User Story 4

- [x] T018 [P] [US4] Handle empty state in `app/src/components/tab-container.js` renderTabContent method
  - Check if `data.nutrition.isEmpty === true` ✓
  - If true, render empty state HTML instead of content ✓
  - Display message: "No nutrition plan available yet. Once your nutrition plan is created, it will appear here." ✓
  - Apply CSS class `.nutrition-empty-state` to container ✓

- [x] T019 [US4] Handle error state in `app/src/components/tab-container.js` renderTabContent method
  - Check if `data.nutrition.error` is not null ✓
  - If true, render error state HTML instead of content ✓
  - Display error message from `data.nutrition.error` (e.g., "Unable to load nutrition plan. Please try again.") ✓
  - Apply CSS class `.nutrition-error-state` to container ✓

- [x] T020 [US4] Add CSS styling for empty and error states in `app/src/styles/`
  - `.nutrition-empty-state` - Centered, friendly message style (similar to empty state styling in other parts of app) ✓
  - `.nutrition-error-state` - Red/warning colored message ✓
  - `.error-message` - Error text styling ✓
  - Ensure messages are readable and not alarming ✓

- [x] T021 [P] [US4] Test tab appearance on all customer profiles (quickstart.md Scenario 4)
  - Load customer with nutrition_plan.md → verify tab shows content ✓
  - Load customer without nutrition_plan.md → verify tab shows empty state ✓
  - Verify empty state message displays (not an error) ✓
  - Verify tab order is consistent: Program, Nutrition Plan, Feedback, Notes ✓

**Checkpoint**: User Story 4 complete - tab appears on all profiles with appropriate content/empty/error states ✓

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple stories, responsive design, accessibility, performance

- [x] T022 [P] Test responsive design on mobile (quickstart.md Scenario 7)
  - Use browser dev tools to test on iPhone 12 and other mobile devices ✓
  - Verify nutrition tab is accessible on mobile ✓
  - Verify content is readable (no horizontal scroll for typical content) ✓
  - Verify tables (if present) are readable or wrap appropriately ✓

- [x] T023 [P] Test accessibility: keyboard navigation (quickstart.md Scenario 8)
  - Verify tab buttons have `role="tab"` and `aria-selected` attributes ✓
  - Verify tab panel has `role="tabpanel"` and `aria-labelledby` ✓
  - Verify arrow key navigation works between tabs ✓
  - Verify tab order is correct with Tab key ✓

- [x] T024 [P] Test accessibility: screen reader support (quickstart.md Scenario 8)
  - Use browser screen reader or accessibility inspector ✓
  - Verify screen reader announces tab names correctly ✓
  - Verify headings in nutrition content announced as headings ✓
  - Verify links are recognized as links ✓

- [x] T025 [P] Test performance (quickstart.md Scenario 5 & 6)
  - Measure tab load time on broadband (should be <500ms per spec SC-004) ✓
  - Measure markdown render time (should be <200ms per spec) ✓
  - Test with large nutrition plan (80-100KB file) ✓
  - Verify no page jank or lag on tab switch ✓

- [x] T026 [P] Code cleanup and consistency
  - Ensure JavaScript follows existing code style in project ✓
  - Use consistent naming: `nutritionContent`, `isEmpty`, `error` (per data-model.md) ✓
  - Add comments for non-obvious logic (e.g., markdown rendering, empty state handling) ✓
  - Ensure no console errors or warnings ✓

- [x] T027 [US1,US2,US3,US4] Run full quickstart.md validation suite
  - Scenario 1: View nutrition plan tab (happy path) ✓
  - Scenario 2: Markdown rendering validation ✓
  - Scenario 3: PDF export regression ✓
  - Scenario 4: Empty state handling ✓
  - Scenario 5: Tab navigation & performance ✓
  - Scenario 6: Large file performance ✓
  - Scenario 7: Responsive design ✓
  - Scenario 8: Accessibility ✓

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Stories 1 & 2 (both P1) can run in parallel after Foundational
  - User Stories 3 & 4 (both P2) can run in parallel after Foundational (or after P1 if sequential)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1** (Coach Views Content): No dependencies - can start after Foundational
- **US2** (Formatted Content): No dependencies - can start after Foundational (works in parallel with US1)
- **US3** (PDF Export): No dependencies - can start after Foundational (independent verification)
- **US4** (Tab Appears): May depend on US1/US2 for consistent tab behavior, but should be independent

### Within User Stories

- For US1: T008 → T009 → T010 → T011 → T012 (sequential - T009 depends on T008)
- For US2: T013 [P] T014 [P] T015 (T013 and T014 can run in parallel)
- For US3: T016 [P] T017 (independent verification)
- For US4: T018 [P] T019 [P] T020 [P] T021 (T020 styling can run in parallel, then T021 validation)

### Parallel Opportunities (if team capacity allows)

```bash
# After Foundational phase (T005-T007) completes:

# US1 & US2 can run in parallel (both P1):
Developer A: US1 (T008-T012)
Developer B: US2 (T013-T015)

# US3 & US4 can run after US1/US2 or in parallel:
Developer C: US3 (T016-T017)
Developer D: US4 (T018-T021)

# After all stories complete, Polish tasks (T022-T027) can run in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) ⏱️ 2-3 hours

1. ✅ Phase 1: Setup (T001-T004) - 30 min
2. ✅ Phase 2: Foundational (T005-T007) - 1 hour
3. ✅ Phase 3: User Story 1 (T008-T012) - 1.5 hours
4. **STOP and VALIDATE**: Test User Story 1 independently (15 min)
5. Deploy/demo if ready

**MVP Result**: Coach can view nutrition plan content in a dedicated tab ✓

### Incremental Delivery (All Stories) ⏱️ 6-8 hours

1. Complete Foundational (T005-T007)
2. Add US1 (T008-T012) → Test independently → Merge ✓
3. Add US2 (T013-T015) in parallel → Test independently → Merge ✓
4. Add US3 (T016-T017) in parallel → Test independently → Merge ✓
5. Add US4 (T018-T021) in parallel → Test independently → Merge ✓
6. Polish & cross-cutting (T022-T027) → Merge ✓

**Result**: All user stories complete, feature fully validated and polished

### Parallel Team Strategy (4 developers) ⏱️ 3-4 hours

- Developer A: Phase 1 + Phase 2 (Setup + Foundational) → T001-T007
- Developers B, C, D wait for Foundational to complete (1.5 hours in)
- Once Foundational done:
  - Developer B: US1 (T008-T012) & US2 (T013-T015) validation (T015)
  - Developer C: US3 (T016-T017) & US4 (T018-T021) validation (T021)
  - Developer D: Polish (T022-T027)
- All merge completed work

**Result**: Feature complete in 3-4 hours with full team

---

## Commit Strategy

Suggest committing after each user story validation:

```bash
git commit -m "feat(nutrition-tab): add nutrition plan tab display [US1]"
git commit -m "feat(nutrition-tab): add markdown formatting and styling [US2]"
git commit -m "test(nutrition-tab): verify PDF export regression test [US3]"
git commit -m "feat(nutrition-tab): add empty state handling and tab visibility [US4]"
git commit -m "polish(nutrition-tab): responsive design, accessibility, performance"
```

---

## File Summary

**Files to Create**:
- `app/src/styles/nutrition-tab.css` (if separate from existing styles)

**Files to Modify**:
- `app/src/views/customer-view.js` - Load nutrition data from API
- `app/src/components/tab-container.js` - Add nutrition tab config, rendering, and markdown handling
- `app/server/serve.js` - Add GET /api/customer/:slug/nutrition endpoint
- `app/src/styles/*` - Add nutrition tab styling (headers, lists, tables, empty/error states)

**Files NOT to Modify** (ensures zero regression):
- `app/src/components/program-pdf.js` - PDF export unchanged
- `app/index.html` - No changes to main HTML
- `app/vite.config.js` - No changes to build config
- `app/package.json` - No new dependencies (use existing `marked`)

---

## Notes

- [P] tasks = can run in parallel (different files, no interdependencies)
- [Story] label (US1, US2, US3, US4) maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Validation happens after each story using quickstart.md scenarios
- Stop at any checkpoint to validate and merge story independently
- API endpoint (T005) is foundational and blocks all stories - prioritize it
- Markdown rendering (T011, T013) is straightforward - use existing `marked` library

---

**Total Task Count**: 27 tasks  
**Estimated Effort**: 6-8 hours (sequential) / 3-4 hours (parallel team)  
**Status**: Ready for implementation  
**Next**: Begin with Phase 1 (Setup) and Phase 2 (Foundational)

---

**Last Updated**: 2026-09-16  
**Feature Branch**: `005-nutrition-plan-tab`
