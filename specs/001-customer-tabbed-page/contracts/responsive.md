# Contract: Responsive Tab Layout

**Component**: CustomerTabContainer, TabHeader, TabPanel  
**Requirement Refs**: SC-004 (responsive 320px+), edge case handling

---

## Responsive Breakpoints

### Desktop (≥1024px)

```
Layout:
  [Tab Header - Horizontal buttons]
  [─────────────────────────────────]
  [Tab Panel Content Area - Scrollable]

Tab Buttons:
  - Arranged horizontally, side-by-side
  - Each button shows full label text ("Program", "Customer Feedback", "Workout History", "Coach Notes")
  - All 4 buttons visible simultaneously
  - Minimum button height: 44px
  - Padding: 16px horizontal, 12px vertical per button

Tab Panel:
  - Full width of container
  - Min-height: 400px (or viewport height - header)
  - If content exceeds height: vertical scrollbar appears
  - No horizontal scrollbar (content fits width)

Example:
  ┌─ [Program] [Feedback] [History] [Notes] ──────────────┐
  ├──────────────────────────────────────────────────────┤
  │ Program Content Here                                 │
  │ - Exercise 1: Dumbbell Squats                        │
  │ - Exercise 2: Bench Press                           │
  │ (scroll if content exceeds height)                  │
  └──────────────────────────────────────────────────────┘
```

### Tablet (600px–1023px)

```
Layout: Same as desktop

Adjustments:
  - Tab button labels may be shortened if needed (e.g., "Feedback" instead of "Customer Feedback")
  - Button padding: 12px horizontal, 12px vertical (reduced)
  - All 4 buttons still visible

Example:
  ┌─ [Program] [Feedback] [History] [Notes] ────────────┐
  ├────────────────────────────────────────────────────┤
  │ Feedback content...                                │
  │ (scroll)                                           │
  └────────────────────────────────────────────────────┘
```

### Mobile (320px–599px)

```
Layout:
  [Tab Header - Horizontal scroll or stack]
  [─────────────────────────────────────]
  [Tab Panel Content Area - Scrollable]

Tab Buttons:
  - All 4 buttons must fit or scroll horizontally
  - Button height: 44px (tappable size)
  - Button width: equal (e.g., 25% each if 4 tabs fit)
  - If all don't fit: horizontal scroll enabled on tab button bar
  - Labels: short version ("Program", "Feedback", "History", "Notes")
  - No margin between buttons (packed tightly)

Tab Panel:
  - Full width of container
  - Max height: viewport height - tab header height
  - Content scrolls vertically
  - No horizontal scroll (content does not exceed width)

Text Sizing:
  - Tab button text: 12–14px
  - Heading text: 16–18px
  - Body text: 14–16px
  - Line height: 1.5 (readable)

Example (portrait):
  ┌─ [Prog] [Feed] [Hist] [Note] ──┐  ← buttons wrap/scroll if needed
  │ ├────────────────────────────── │
  │ │ Content scrolls here           │
  │ │ (text fits within container)   │
  │ └────────────────────────────── │
  └────────────────────────────────┘

Example (landscape, 812px wide):
  ┌─ [Program] [Feedback] [History] [Notes] ──┐
  ├────────────────────────────────────────────┤
  │ Content here (vertical scroll if needed)   │
  └────────────────────────────────────────────┘
```

---

## Accessibility & Touch Targets

- **Minimum tap target**: 44×44px (iOS/Android standard)
- All tab buttons meet this size on mobile
- No hover-only functionality (mobile has no hover)
- Tab buttons have visible active/focus state (keyboard accessible)
- Focus indicator: 2–3px border/outline on focused button

---

## Scrolling Behavior

### Tab Header (Tab Buttons)

**Desktop/Tablet (≥600px)**:
  - Never scrolls (all buttons fit)
  - Static position at top of container

**Mobile (<600px)**:
  - May scroll horizontally if buttons don't fit
  - Sticky/fixed at top (header doesn't scroll away)
  - User can swipe left/right to see more buttons

### Tab Panel (Content)

**All Sizes**:
  - Content scrolls vertically if it exceeds container height
  - Main page does NOT scroll for tab content
  - Each tab maintains independent scroll position

---

## CSS Patterns (Guidance, Not Implementation)

```css
/* Tab Container */
.tab-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Tab Header (buttons) */
.tab-header {
  display: flex;
  overflow-x: auto;  /* Enable horizontal scroll on mobile */
  overflow-y: hidden;
  position: sticky;
  top: 0;
  background: white;
  border-bottom: 1px solid #ddd;
  flex-shrink: 0;
}

.tab-button {
  flex: 1;
  min-height: 44px;
  padding: 12px 16px;
  cursor: pointer;
  border: none;
  white-space: nowrap;
}

/* Tab Panel (content) */
.tab-panel {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
}

/* Mobile adjustments */
@media (max-width: 599px) {
  .tab-header {
    flex-wrap: nowrap;
  }
  
  .tab-button {
    flex: 0 0 25%;  /* Equal width for 4 buttons */
    padding: 12px 8px;
    font-size: 12px;
  }
  
  .tab-panel {
    padding: 12px;
  }
}
```

---

## Acceptance Criteria

- [ ] Tab interface displays correctly on 320px width (mobile minimum)
- [ ] Tab interface displays correctly on 1920px width (desktop maximum)
- [ ] All 4 tab buttons are tappable (min 44px tall on mobile)
- [ ] Tab content does not overflow horizontally on any screen size
- [ ] Tab content scrolls vertically if it exceeds available height
- [ ] Tab header remains visible while scrolling tab content (sticky/fixed)
- [ ] Text is readable on all screen sizes (no cramping or tiny fonts)
- [ ] No horizontal scroll bar appears on main page for tab content
- [ ] On mobile, tab buttons either fit side-by-side or scroll horizontally (no word wrap)

---

## Testing Checklist

- [ ] **Mobile (375px, portrait)**: Tap each tab, scroll content if needed
- [ ] **Mobile (667px, landscape)**: Tab layout remains usable
- [ ] **Tablet (768px)**: Tab buttons and content render correctly
- [ ] **Desktop (1920px)**: Tab buttons are well-spaced, content is wide
- [ ] **Content scrolling**: Long feedback/history content scrolls independently of main page
- [ ] **Tab switching on mobile**: Tap performance is smooth, no lag
- [ ] **Focus states**: Using keyboard (Tab key), can focus and activate tab buttons
- [ ] **No overflow**: Verify with DevTools that no horizontal scrollbar appears

---

## Notes

- Responsive design follows mobile-first approach: base styles for mobile, media queries for larger screens
- Touch/tap targets prioritized for mobile usability (Principle IV: Performance & Responsiveness)
- Layout should adapt gracefully; no "not optimized for this screen" messages
