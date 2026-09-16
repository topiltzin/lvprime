# Phase 1: Quickstart Validation Guide

**Date**: 2026-09-16  
**Purpose**: Runnable end-to-end validation scenarios for Nutrition Plan Tab feature

---

## Prerequisites

- Project dependencies installed: `cd app && npm install`
- Server running: `npm run start` (or `npm run dev` for development)
- Browser: Any modern browser (Chrome, Firefox, Safari, Edge)
- Test customer: `jaqueline-orellano` (with nutrition_plan.md file, created in earlier session)

---

## Scenario 1: View Nutrition Plan Tab (Happy Path)

**Goal**: Verify that Nutrition Plan tab appears and displays content

**Setup**:
1. Start server: `cd app && npm run dev` (development with hot reload) or `npm run start` (production)
2. Open browser: http://localhost:5173 (or configured dev server port)
3. Navigate to customer: Click "jaqueline-orellano" from customer list

**Test Steps**:

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Load customer profile | Five tabs visible: Program, Nutrition Plan, Feedback, Notes | ✓ Nutrition Plan tab is present |
| 2 | Click Nutrition Plan tab | Tab becomes active (highlighted/underlined) | ✓ Tab switches without page reload |
| 3 | Observe content | Nutrition plan markdown displays formatted | ✓ Headings, lists, tables render correctly |
| 4 | Scroll content | All content is readable and scrollable | ✓ No overflow or layout issues |
| 5 | Click other tabs | Switch to Program, Feedback, Notes and back | ✓ Nutrition tab content persists when returning |

**Success Criteria** (from spec SC-001, SC-002):
- ✓ Nutrition plan accessible within 2 clicks (Program tab exists + Nutrition Plan tab click)
- ✓ Markdown renders with 100% accuracy (all headers, lists, tables, emphasis display correctly)

---

## Scenario 2: Markdown Rendering Validation

**Goal**: Verify all markdown elements render correctly

**Setup**: Same as Scenario 1 (customer profile open, Nutrition Plan tab active)

**Test Steps**:

Inspect the rendered nutrition plan for these markdown elements:

| Element | What to Look For | Verify |
|---------|------------------|--------|
| Headings | `## Resumen Ejecutivo`, `### Macronutrients` → render as `<h2>`, `<h3>` with size difference | ✓ Visual hierarchy present |
| Lists | Bullet points (•) and numbered lists (1., 2., ...) render with bullets/numbers | ✓ Lists display correctly |
| Tables | Nutrient table with rows/columns, proper alignment | ✓ Table structure intact, readable |
| Bold/Italic | Text like **"MUST"**, *"important"* render with weight/style | ✓ Emphasis visible |
| Code | Inline or block code (if present) displays in monospace | ✓ Code formatting distinct |
| Links | Any links render as clickable blue text (if present) | ✓ Links functional |

**Success Criteria** (from spec SC-002):
- ✓ Markdown markdown renders with 100% accuracy across all element types

---

## Scenario 3: PDF Export Regression Test

**Goal**: Verify PDF export for Program tab still works (no regression)

**Setup**: Customer profile open, Program tab active

**Test Steps**:

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Locate export button | Button visible in Program tab | ✓ Export button present |
| 2 | Click export button | File download initiated (browser download dialog or auto-save) | ✓ PDF downloads |
| 3 | Open downloaded PDF | PDF opens in PDF viewer (browser or system) | ✓ PDF is valid file |
| 4 | Verify PDF content | PDF contains program content (exercise names, reps, sets) | ✓ Program content intact |
| 5 | Verify PDF does NOT contain nutrition | PDF does not include nutrition plan content | ✓ Nutrition content excluded (as required) |

**Success Criteria** (from spec SC-003):
- ✓ PDF export for program.md continues to work with 0 regression
- ✓ All existing PDFs remain identical in content and format

---

## Scenario 4: Empty State Handling

**Goal**: Verify that customer without nutrition plan shows appropriate message

**Setup**:
1. Navigate to a different customer that has no nutrition_plan.md file
   - Option A: Create a new customer without running nutrition specialist skill
   - Option B: Use an existing customer without nutrition plan (if available)

**Test Steps**:

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Load customer profile | Nutrition Plan tab is still visible | ✓ Tab always appears |
| 2 | Click Nutrition Plan tab | Tab becomes active | ✓ Tab switches without error |
| 3 | Observe empty state | Message displays: "No nutrition plan available yet. Once your nutrition plan is created, it will appear here." | ✓ Helpful empty message shown |
| 4 | Verify no error | No error message or console errors | ✓ Graceful empty state (not an error) |

**Success Criteria** (from spec FR-004):
- ✓ System displays appropriate message if nutrition_plan.md doesn't exist

---

## Scenario 5: Tab Navigation & Performance

**Goal**: Verify tab switching is fast and responsive

**Setup**: Customer profile open with all tabs visible

**Test Steps**:

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Click Nutrition Plan tab | Content loads visibly | Note load time (should be <500ms) |
| 2 | Click Program tab | Switches instantly | ✓ No delay |
| 3 | Click Nutrition Plan again | Content reappears without re-rendering delay | ✓ Content cached in DOM |
| 4 | Use keyboard (Arrow Right) | Tab switches via keyboard | ✓ Keyboard nav works |
| 5 | Use keyboard (Arrow Left) | Tab switches backward via keyboard | ✓ Keyboard nav wraps around |

**Success Criteria** (from spec SC-004, SC-005):
- ✓ Tab loads in under 500ms on broadband
- ✓ 100% of customer profiles display the Nutrition Plan tab

---

## Scenario 6: Large Nutrition Plan Performance

**Goal**: Verify performance with large nutrition plan file (close to 100KB limit)

**Setup**:
1. Create a test customer with a large nutrition_plan.md (80-100KB)
   - Option: Duplicate existing nutrition plan and add placeholder content to reach size
2. Load customer profile
3. Click Nutrition Plan tab

**Test Steps**:

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Note load time | Content loads within 500ms (per spec) | ✓ Performance acceptable at max size |
| 2 | Observe rendering | All content renders correctly without truncation | ✓ Full content displayed |
| 3 | Scroll performance | Scrolling is smooth, no lag or jank | ✓ Responsive scrolling |
| 4 | Tab switches | Switching to other tabs remains fast | ✓ No performance regression |

**Success Criteria** (from spec SC-004):
- ✓ Nutrition plan tab loads in under 500ms even at 100KB file size

---

## Scenario 7: Responsive Design (Mobile)

**Goal**: Verify Nutrition Plan tab works on mobile/narrow screens

**Setup**:
1. Open browser dev tools (F12)
2. Toggle device emulation (Chrome: Ctrl+Shift+M or View menu)
3. Select mobile device (iPhone 12, Pixel 5, etc.) or resize to 375px width
4. Navigate to customer profile

**Test Steps**:

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Load profile on mobile | All tabs visible and clickable | ✓ Tabs not hidden or overlapped |
| 2 | Click Nutrition Plan tab | Content loads and displays | ✓ Tab works on mobile |
| 3 | Read content | Content is readable on narrow screen (no horizontal scroll needed) | ✓ Text wraps properly |
| 4 | Tables (if present) | Table content is readable or scrolls horizontally if necessary | ✓ No layout break |
| 5 | Scroll and interact | Page is usable on mobile; no UI elements hidden behind keyboard | ✓ Mobile UX functional |

**Success Criteria** (from spec requirement of responsive design):
- ✓ Nutrition plan content is responsive and readable on mobile

---

## Scenario 8: Accessibility Check

**Goal**: Verify tab structure is accessible to assistive technologies

**Setup**:
1. Browser with accessibility inspector open (Chrome DevTools > Elements > Accessibility tree)
2. OR: Use screen reader simulation (NVDA, JAWS, or browser built-in reader)
3. Customer profile loaded

**Test Steps**:

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Inspect tab buttons | Each tab has `role="tab"` and `aria-selected` attributes | ✓ ARIA attributes present |
| 2 | Inspect tab panel | Panel has `role="tabpanel"` and `aria-labelledby` | ✓ Semantics correct |
| 3 | Navigate with keyboard | Tab and Shift+Tab move focus through tabs | ✓ Keyboard navigation works |
| 4 | Use screen reader | Screen reader announces tab names ("Nutrition Plan") | ✓ Tab name announced |
| 5 | Read content | Screen reader reads markdown headings as headings (h2, h3, etc.) | ✓ Semantic HTML structure present |

**Success Criteria** (from spec accessibility requirements):
- ✓ Tab navigation is keyboard accessible
- ✓ ARIA labels and semantic HTML enable assistive technology use

---

## Validation Checklist

After running all scenarios, verify:

- [ ] Scenario 1: Nutrition Plan tab displays with formatted content
- [ ] Scenario 2: All markdown elements (headings, lists, tables, emphasis) render correctly
- [ ] Scenario 3: Program PDF export works and contains only program content
- [ ] Scenario 4: Empty state message displays when no nutrition plan exists
- [ ] Scenario 5: Tab navigation is fast (<500ms) and responsive
- [ ] Scenario 6: Performance is acceptable even with large nutrition plan files
- [ ] Scenario 7: Content is readable and functional on mobile/narrow screens
- [ ] Scenario 8: Keyboard navigation and screen reader support work

---

## Known Limitations & Non-Blockers

- **No PDF Export for Nutrition**: Nutrition plan PDFs not in scope (program PDF only). Can be added in future.
- **No In-UI Editing**: Nutrition plans are created by nutrition specialist skill, not edited in UI. Editing can be added in future.
- **File Size Limit**: 100KB maximum per spec; larger files will return 413 error.
- **No Cache Invalidation**: File changes require page reload to see updates. ETags can be added in future.

---

## Next Steps

After validation passes:
1. Run `/speckit-tasks` to generate implementation task list
2. Proceed to development phase
3. Use these scenarios as basis for automated tests

---

**Last Updated**: 2026-09-16  
**Status**: Ready for implementation
