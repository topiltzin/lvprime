# Contract: Tab Switching Interaction

**Component**: CustomerTabContainer, TabHeader, TabPanel  
**Requirement Refs**: FR-003, FR-004, SC-002

---

## Interface

### Input (User Action)

```
User clicks on a tab button with id="feedback"
```

### Output (Component Behavior)

```
1. Active tab indicator updates:
   - "feedback" tab button becomes highlighted/underlined
   - "program" tab button becomes unhighlighted
   
2. Tab panel content switches:
   - TabPanel component unmounts for "program"
   - TabPanel component mounts for "feedback"
   - Feedback content displays immediately
   
3. Performance:
   - Time from click to content rendered: <200ms (SC-002)
   - No page reload occurs (FR-003)
   - No network requests issued (data already loaded)
   
4. State Management:
   - activeTabId state updates to "feedback"
   - URL does NOT change (session-only, no query params)
   - Browser history is NOT modified
   
5. Scroll Position:
   - Scroll position within "feedback" tab panel resets to top
   - Main page scroll position is unchanged
   - Each tab maintains independent scroll state
```

---

## Acceptance Criteria

- [ ] Clicking tab button changes visual active state immediately (<50ms)
- [ ] Tab content renders and becomes visible within 200ms total
- [ ] Active tab button visually distinct from inactive buttons (color, underline, or background)
- [ ] Tab switching happens without full page reload
- [ ] Browser back/forward buttons do NOT navigate between tabs (no URL changes)
- [ ] Tab content is scrollable if it exceeds container height
- [ ] Switching tabs does not affect main page scroll position
- [ ] Multiple rapid clicks on different tabs do not cause race conditions or flickering

---

## Edge Cases

**Scenario 1: User rapidly clicks multiple tabs**
- Expected: Last clicked tab is displayed; no visual glitching
- Implementation: Use React's setState batching to ensure single render

**Scenario 2: User clicks currently active tab again**
- Expected: No change; tab remains active; no visual flicker
- Implementation: Check if `newTabId === activeTabId` before setState

**Scenario 3: Tab content is very long (>1000 lines)**
- Expected: Content scrolls within tab container; main page does not scroll
- Implementation: TabPanel container has `max-height` and `overflow-y: auto`

**Scenario 4: Screen is very narrow (mobile, 320px)**
- Expected: Tab buttons remain clickable; content scrolls independently
- Implementation: Responsive CSS layout (see responsive.md contract)

---

## Testing Checklist

- [ ] Can click each of the 4 tabs and view their content
- [ ] Tab switching is instant (measure with DevTools, should be <200ms)
- [ ] No JavaScript errors in console
- [ ] Active tab button styling is clearly different from inactive
- [ ] Scrolling within a long tab's content does not scroll the main page
- [ ] Rapidly clicking tabs doesn't cause content flashing or duplication
- [ ] Tab switching works on desktop (1920px) and mobile (375px)
- [ ] Clicking the same tab twice doesn't change anything
