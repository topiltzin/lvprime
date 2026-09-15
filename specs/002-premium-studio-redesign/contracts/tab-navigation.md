# Contract: Client Detail Tab Navigation

**Component**: `TabContainer` (`app/src/components/tab-container.js`)
**Requirement Refs**: FR-005, FR-006, FR-007, FR-008

---

## Interface

### Tab set

Exactly four tabs, in this fixed order: `Program`, `Feedback`, `Log Session`, `Notes`. There is
no separate `History` tab (its stats move into the Feedback tab's top strip — see
`overview-triage.md`'s sibling contract `feedback-honesty-and-stats.md`). A tab is enabled per
today's rule (`isEnabled` based on data presence), except `Log Session`, which is always
enabled.

### Default selection

On mount, the active tab is the **first tab in order whose `isEnabled` is `true`** — not a
hardcoded tab id. If, hypothetically, zero tabs are enabled, the existing "No data available for
this customer" empty state (already present in `customer-view.js`) is shown instead of an
unselected tab bar.

### Keyboard behavior

With focus anywhere in the `role="tablist"` header:

- `ArrowRight` → moves selection + focus to the next *enabled* tab (wrapping from the last
  enabled tab to the first).
- `ArrowLeft` → moves selection + focus to the previous *enabled* tab (wrapping symmetrically).
- Disabled tabs are not rendered at all (unchanged from today), so arrow navigation only ever
  lands on visible, enabled tabs.

### Scroll behavior

The client detail page (hero + tabs + active panel) scrolls as a single document-level surface.
No element inside the tab area has a fixed `max-height` with `overflow-y: auto`.

## Behavior Notes

- Exactly one tab has `aria-selected="true"` at all times (once at least one tab is enabled).
- Switching tabs never triggers a network request — panel content is already loaded.
- The Program tab's day sub-navigation (chips) scrolls the page to a day's card via anchor
  jump; it does not open a nested scroll region.

## Acceptance Criteria

- [ ] Opening a client whose Program tab is disabled (no program yet) but who has feedback
      lands on the Feedback tab selected and visible, not on a blank/unselected state.
- [ ] Pressing `ArrowRight` on the last enabled tab moves selection to the first enabled tab.
- [ ] Pressing `ArrowLeft` on the first enabled tab moves selection to the last enabled tab.
- [ ] Scrolling down on a long Program or Feedback tab scrolls the whole page; no inner panel
      stops absorbing scroll before the page does.
- [ ] Exactly one `role="tab"` button carries `aria-selected="true"` after every interaction.

## Testing Checklist

- [ ] Manual verification via `quickstart.md` Scenario 3 (tab default + keyboard nav)
- [ ] Manual verification via `quickstart.md` Scenario 4 (single-surface scroll on a long
      program)
