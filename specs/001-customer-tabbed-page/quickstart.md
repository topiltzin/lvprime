# Quickstart Validation Guide: Customer Tabbed Page Interface

**Purpose**: Runnable validation scenarios proving the tabbed interface feature works end-to-end  
**Prerequisites**: Development environment set up; Next.js app running locally

---

## Setup

### Before Running Scenarios

1. **Ensure app is running**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   App should be accessible at `http://localhost:3000`

2. **Ensure test customer exists**:
   - Navigate to a customer page (e.g., `http://localhost:3000/customers/[customer-id]`)
   - Verify customer has at least one markdown file:
     - `customers/[customer-name]/program.md` (required)
     - `customers/[customer-name]/feedback.md` (optional, for feedback tab)
     - `customers/[customer-name]/notes.md` (optional, for notes tab)

3. **Check data integrity**:
   - All markdown files follow format from CLAUDE.md
   - No corrupted data or syntax errors in files

---

## Scenario 1: Tab Switching (Core Feature)

**Goal**: Verify that clicking tabs switches content instantly without page reload

**Prerequisites**:
- Customer with complete data (program.md, feedback.md, and notes.md files present)
- Browser DevTools open (Network tab)

**Setup**:
1. Navigate to customer page: `http://localhost:3000/customers/[customer-id]`
2. Verify page loads; "Program" tab is active by default
3. Open DevTools → Network tab

**Actions**:
```
Step 1: Click "Feedback" tab
  - Observe: Tab button highlights
  - Observe: Feedback content appears in panel
  - Verify DevTools Network tab: NO new page load (no HTML request)
  - Measure: Time from click to content visible should be <200ms

Step 2: Click "History" tab
  - Observe: History content appears instantly
  - Observe: "History" button is now highlighted
  - Verify: No page reload occurred
  
Step 3: Click "Program" tab (return to start)
  - Observe: Program content appears
  - Verify: Scroll position within Program panel resets to top (not remembering previous scroll)

Step 4: Click "Notes" tab
  - Observe: Notes content appears
  - Verify: All 4 tabs are functional and switch instantly
```

**Expected Outcome**:
- ✅ All 3 tab switches complete without page reload
- ✅ Content switches instantly (<200ms from click to rendered)
- ✅ Each tab shows unique, correct content
- ✅ Active tab button is visually distinguished (color/underline/highlight)
- ✅ No errors in browser console

**Success Criteria Met**: FR-003, FR-004, SC-002

---

## Scenario 2: Empty State Handling

**Goal**: Verify that tabs with no data display friendly messages instead of errors or blank space

**Prerequisites**:
- Customer with program.md (required)
- Customer WITHOUT feedback.md (to test empty Feedback tab)

**Setup**:
1. Navigate to customer page
2. Verify tabs are displayed

**Actions**:
```
Step 1: Click "Feedback" tab (expected empty)
  - Observe: Friendly message appears
  - Example message: "No feedback recorded yet. Customer sessions will be logged here after each workout."
  
Step 2: Verify message properties:
  - Message is readable (not cramped or too small)
  - Message tone matches fitness coaching context
  - Message is NOT red (not an error state)
  - Tab button remains clickable (not disabled)
  
Step 3: Verify no errors:
  - No error message in browser console
  - No broken layout or scrollbars
```

**Expected Outcome**:
- ✅ Empty tab shows friendly, context-aware message
- ✅ Message is readable and on-brand
- ✅ Tab is selectable even when empty
- ✅ No technical errors or broken layout

**Success Criteria Met**: FR-008

---

## Scenario 3: Mobile Responsiveness

**Goal**: Verify tab interface remains usable on mobile devices (320px minimum)

**Prerequisites**:
- Browser DevTools open
- Customer page loaded

**Setup**:
1. Open DevTools → Device Toggle (responsive mode)
2. Set viewport to mobile: `iPhone SE (375px × 667px)` or `320px × 568px`

**Actions**:
```
Step 1: Tap "Feedback" tab on mobile
  - Observe: Tab becomes active
  - Verify: Button is tappable (not cramped or overlapping)
  - Verify: Content fits within screen width (no horizontal scroll)
  
Step 2: Scroll within tab content
  - Action: Swipe/scroll up and down within Feedback content
  - Verify: Content scrolls within the tab panel
  - Verify: Main page does NOT scroll for tab content
  - Verify: Tab header stays visible at top (sticky)
  
Step 3: Tap another tab
  - Action: Tap "Program" tab
  - Verify: Tab switches instantly
  - Verify: No lag or performance issues on mobile

Step 4: Test landscape mode
  - Rotate device to landscape (e.g., 667px × 375px)
  - Verify: Tab buttons remain tappable
  - Verify: Content still fits without horizontal scroll
```

**Expected Outcome**:
- ✅ All tabs are tappable and functional on 375px viewport
- ✅ Tab content scrolls independently of main page
- ✅ No horizontal scroll bars (content fits width)
- ✅ Tab header remains visible during scroll
- ✅ Works in both portrait and landscape

**Success Criteria Met**: SC-004 (responsive 320px+)

---

## Scenario 4: Session State Reset

**Goal**: Verify that tab state resets on page refresh (session-only scope per requirement)

**Prerequisites**:
- Customer page loaded

**Setup**:
1. Navigate to customer page
2. Click to select "History" tab (not the default "Program")
3. Verify History tab is active and content is visible

**Actions**:
```
Step 1: Refresh the page
  - Action: Press F5 or Cmd+R (refresh/reload)
  - Observe: Page reloads
  
Step 2: Verify default tab is selected
  - Observe: After refresh, "Program" tab is now active (default)
  - Observe: "History" tab is NOT active (session state was reset)
  - Verify: URL has not changed (no query params like ?tab=history)

Step 3: Navigate away and return
  - Action: Click a link to another page
  - Action: Use browser back button to return to customer page
  - Observe: Page loads with "Program" tab active (default, not remembered)
```

**Expected Outcome**:
- ✅ After refresh, default "Program" tab is selected
- ✅ URL does not contain tab state (no query params or hash)
- ✅ Session-only state is confirmed (reset on each page load)

**Success Criteria Met**: Requirement FR-006 (session-only state), spec assumption verified

---

## Scenario 5: Data Integrity Across Tabs

**Goal**: Verify that all customer data is accurately displayed across all tabs

**Prerequisites**:
- Customer with complete data files

**Setup**:
1. Navigate to customer page
2. Keep customer's markdown files open (in separate editor or terminal) for reference

**Actions**:
```
Step 1: Verify Program tab content matches program.md
  - Action: Click Program tab
  - Verify: Goal, fitness level, and exercises match file contents
  - Verify: All sets, reps, rest periods are correct
  - Verify: Form tips and progression notes are displayed

Step 2: Verify Feedback tab content matches feedback.md
  - Action: Click Feedback tab
  - Verify: All feedback entries are listed
  - Verify: Dates, completion status, and notes match file contents

Step 3: Verify History tab shows aggregated data
  - Action: Click History tab
  - Verify: Completion rate calculation is correct
  - Verify: Aggregated stats match raw feedback data

Step 4: Verify Notes tab content matches notes.md
  - Action: Click Notes tab
  - Verify: Observations and recommendations are displayed
  - Verify: Dates and citations are correct
```

**Expected Outcome**:
- ✅ All displayed data matches source markdown files exactly
- ✅ No data is missing or corrupted
- ✅ All tabs display complete, accurate information

**Success Criteria Met**: SC-005 (100% of expected data accessible)

---

## Validation Checklist

After running all scenarios, verify:

- [ ] **Scenario 1**: All 4 tabs switch instantly without page reload
- [ ] **Scenario 1**: Active tab is visually highlighted; <200ms switch time
- [ ] **Scenario 2**: Empty tabs show friendly messages (no errors)
- [ ] **Scenario 3**: Mobile viewport (375px) displays tabs and content correctly
- [ ] **Scenario 3**: Tab content scrolls independently; header stays visible
- [ ] **Scenario 4**: Page refresh resets tab to "Program" (default)
- [ ] **Scenario 4**: URL remains unchanged (no tab state in query params)
- [ ] **Scenario 5**: All displayed data matches markdown files
- [ ] **Overall**: No errors in browser console
- [ ] **Overall**: Lighthouse performance score remains >90

---

## Troubleshooting

### Issue: Tabs don't switch or appear broken

**Check**:
- Verify `components/customer/CustomerTabContainer.tsx` exists
- Verify React component is rendering without errors
- Open DevTools console; look for JavaScript errors

### Issue: Content is not displaying correctly

**Check**:
- Verify markdown files (program.md, feedback.md, notes.md) follow CLAUDE.md format
- Verify files are being parsed correctly (check console logs)
- Verify TabPanel component receives correct data slice

### Issue: Tab content scrolls the entire page, not just the panel

**Check**:
- Verify TabPanel has CSS `overflow-y: auto`
- Verify TabHeader has `position: sticky` or `position: fixed`
- Check DevTools computed styles to ensure overflow is applied

### Issue: Mobile tabs are cramped or unresponsive

**Check**:
- Verify DevTools responsive mode is enabled (not simulating desktop)
- Verify CSS media queries for <600px are applied
- Ensure tab button min-height is 44px (touch target size)

---

## Success Criteria Summary

| Criterion | Scenario | Status |
|-----------|----------|--------|
| FR-001: 3+ tabs displayed | 1, 5 | ✅ If all scenarios pass |
| FR-002: Each tab distinct content | 5 | ✅ |
| FR-003: No page reload | 1 | ✅ |
| FR-004: Active tab visible | 1 | ✅ |
| FR-005: Tab buttons visible | 1, 3 | ✅ |
| FR-006: Session-only state | 4 | ✅ |
| FR-007: Independent scroll | 3 | ✅ |
| FR-008: Empty state | 2 | ✅ |
| SC-001: 3 clicks max | All | ✅ |
| SC-002: 200ms latency | 1 | ✅ |
| SC-003: 3+ categories | All | ✅ |
| SC-004: Mobile responsive | 3 | ✅ |
| SC-005: 100% data accessible | 5 | ✅ |
| SC-006: Reduced cognitive load | 1, 3 | ✅ (subjective, note feedback) |

---

## Next Steps

1. **After validation passes**: Feature is ready for `/speckit-tasks` (implementation breakdown)
2. **Document any issues**: If validation fails, file issues in test results
3. **Performance optimization**: If <200ms not achieved, profile and optimize tab switching
4. **Accessibility review**: Run WAVE or Axe DevTools to check a11y compliance
