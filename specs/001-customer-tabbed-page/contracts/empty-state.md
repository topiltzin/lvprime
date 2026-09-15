# Contract: Empty State Rendering

**Component**: TabPanel  
**Requirement Refs**: FR-008, edge case handling

---

## Interface

### Input (Data State)

```
Tab data exists but is empty:
- Feedback tab for customer who has not yet logged any sessions
- History tab with no workout data
- Notes tab with no coach observations yet
```

### Output (Component Behavior)

```
TabPanel renders a user-friendly message instead of error or blank space

Message should:
1. Clearly communicate that no data exists (not an error state)
2. Match the tone and style of the rest of the customer page
3. Provide context-specific guidance (e.g., "Coach observations will appear here after sessions are logged")
4. Remain clickable (tab is still selectable even when empty)
5. Not show scrollbars (content fits without overflow)
```

---

## Message Examples

For each category, when empty:

### Program Tab (Program Data)
- **Condition**: program.md exists but is empty/placeholder (should rarely happen)
- **Message**: "Program not yet created. [Link to create program]"

### Feedback Tab (Feedback Entries)
- **Condition**: No feedback entries logged in feedback.md
- **Message**: "No feedback recorded yet. Customer sessions will be logged here after each workout."

### History Tab (Workout History)
- **Condition**: No completed sessions
- **Message**: "Workout history will appear here after the first session is completed."

### Notes Tab (Coach Observations)
- **Condition**: No notes in notes.md
- **Message**: "Coach observations will appear here after analyzing customer progress."

---

## Visual Design Guidelines

- Text color: Medium gray (readable but not as strong as normal content)
- Font size: 14-16px (readable but slightly smaller than section headings)
- Padding: 40-60px vertical to center content within tab container
- Icon (optional): A subtle icon (e.g., empty chart icon) above the message
- No spinners or animated "loading" indicators (content is permanently empty, not loading)

---

## Acceptance Criteria

- [ ] Empty state message is displayed when tab data is empty
- [ ] Message is friendly and explains the situation clearly
- [ ] Message tone matches the fitness coaching context and project voice
- [ ] Tab remains clickable when showing empty state
- [ ] No error message or stack trace visible to user
- [ ] Message fits within tab container without scrolling
- [ ] Empty state is distinguishable from error state (no red text, warning icons)

---

## Edge Cases

**Scenario 1: Data loads but becomes empty after user action**
- Example: Coach deletes last feedback entry
- Expected: Empty state message appears
- Implementation: Handle in parent component when data refreshes

**Scenario 2: Tab is disabled vs. empty**
- Decision: For MVP, empty tabs are HIDDEN (isEnabled = false)
- Alternative: Show empty tab with message (can add in v1.1)
- Current behavior: Empty tabs don't appear in tab button list at all

**Scenario 3: Empty state for very long customer**
- Example: Customer with 6 months of feedback, but currently viewing Notes (which is empty)
- Expected: Notes empty state still appears; doesn't affect other tabs' data
- Implementation: Each tab's isEmpty flag is independent

---

## Testing Checklist

- [ ] Customer with no feedback recorded shows friendly message on Feedback tab
- [ ] Message is in English and matches project tone
- [ ] Tab is still selectable when showing empty state (button is not disabled)
- [ ] Message fits within tab container (no scrollbar appears)
- [ ] Empty state is visually distinct from normal content (not just blank gray)
- [ ] Empty state persists on page refresh (not replaced by "loading" indicator)
- [ ] No console errors when rendering empty state
- [ ] Empty state message is different for each tab category (context-aware)
