# Contract: Feedback Stats, Log-Session Hand-off, and Notes Honesty

**Component**: `customer-view.js`, `feedback-form-view.js`, `trend-chart.js`, `tab-container.js`
**Requirement Refs**: FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, Data Model → Feedback Stats

---

## Interface

### Feedback tab top strip (FR-013, FR-014)

Three tiles — Completion %, Last session, Average difficulty — each computed only from
`feedback.trend`/`feedback.entries` already returned by `GET /api/customers/:slug` (see
data-model.md → Feedback Stats). Each tile independently shows an explicit empty state (e.g.
"Not enough data yet") when its underlying value is `null`/absent — never a placeholder number
or example string.

The trend chart (existing inline SVG) gets thicker bars, a two-item legend
(Completed/Missed), and larger date-label text; its data source is unchanged (`trend.points`).

### Log-session form (FR-015)

Same fields and submission logic as today (`feedback-form-view.js`); inputs are styled at
≥48px height, and the submit button is full-width at mobile widths. No new required/optional
fields are introduced.

### Save hand-off (FR-016)

On `submitFeedback()` resolving successfully:
1. A transient success confirmation is shown (auto-dismissing, `role="status"`).
2. `TabContainer`'s active tab is set to `feedback` (not re-defaulted to the first-enabled
   tab), so the coach lands where the new entry is visible.

### Notes tab (FR-017, FR-018)

Renders `notes.html` verbatim when `notes.present`. When `!notes.present`, shows a dashed empty
state card. The prior synthetic `{ observations, recommendations }` shape and its hardcoded
strings (`"Customer showing good progress"`, `"Continue with current program"`) are removed
entirely — there is no code path left that can display invented commentary.

## Behavior Notes

- All three stat tiles, the trend chart's empty case, and the Notes empty state share the same
  underlying rule: **absent data → an honest empty state, never fabricated content.**
- The save-confirmation toast and tab hand-off happen client-side after the existing POST
  succeeds; the POST request/response contract itself is unchanged.

## Acceptance Criteria

- [ ] A client with zero feedback entries shows an explicit empty state on all three stat
      tiles and on the trend chart — no `0%`/`N/A` standing in silently, and no invented text.
- [ ] A client with entries shows real computed values on all three tiles, matching what
      `feedback.trend`/`feedback.entries` actually contain.
- [ ] Submitting the log-session form successfully shows a success confirmation and the visible
      tab is `Feedback`, with the new entry present in the list.
- [ ] A client with no notes shows a dashed empty-state card, not any of the previous
      hardcoded observation/recommendation strings.
- [ ] Searching the codebase for the strings "showing good progress", "Continue with current
      program", "Program is progressing well", and "Consistent session completion" returns no
      matches after this feature is implemented.

## Testing Checklist

- [ ] Manual verification via `quickstart.md` Scenario 2 (log a session, confirm hand-off)
- [ ] Manual verification via `quickstart.md` Scenario 6 (zero-data client — honest empty
      states everywhere)
