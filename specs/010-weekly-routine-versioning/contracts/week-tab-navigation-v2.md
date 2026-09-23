# Contract: Program Week Selector (v2)

**Component**: `week-subnav.js`, `tab-container.js`'s `renderProgramContent`, `program-day.js`,
`program-pdf.js` (`app/src/components/`)
**Requirement Refs**: FR-001 through FR-010

**Supersedes**: `specs/003-program-weekly-tabs-pdf/contracts/week-tab-navigation.md` in full.
That contract's core guarantees — a fixed set of exactly four week chips, an identical
day-by-day schedule shown under every week, zero network requests on week switch, and defaulting
to Week 1 — are the exact behaviors this feature exists to replace. Every "Acceptance Criteria"
item in the v1 contract that contradicts this document no longer applies.

---

## Selector set

**Dynamic**, not fixed: one chip per week the customer has (from `programWeeks` on the initial
customer fetch, or `GET /api/customers/:slug/program/weeks`). No fixed count of four. A locked
week's chip is visually marked (e.g. a lock indicator) but remains selectable for viewing
(history browsing, User Story 3, FR-010) — locking blocks writes, never reads.

For a long history (edge case: "selector must remain usable... as week count grows well past
today's fixed 4"), the selector must support scrolling/overflow rather than growing unbounded in
the layout — exact visual treatment (scroll vs. collapse vs. grouping) is left to
implementation, not mandated by this contract (`spec.md` Assumptions).

## Default selection

The **current** week (highest `week_number` — always the only unlocked one) is selected on first
render of the Program tab for a given customer, **not** Week 1 (research.md Decision 6, reverses
v1's default). Switching customers resets selection back to that new customer's current week —
still view state, not persisted.

## Switching behavior

Selecting a week now triggers a fetch (research.md Decision 5, reverses v1's "no network request"
guarantee):

1. If that week's full routine has already been fetched this page visit (session-level cache,
   keyed by week number), render it immediately from cache — no request.
2. Otherwise, fetch `GET /api/customers/:slug/program/weeks/:week`, then render:
   - `renderDaySubnav(weekDetail.weeklySchedule)` and each day via `renderProgramDay` are
     rebuilt for the newly selected week's own `weeklySchedule` — **no longer the same shared
     array reused across weeks** (v1's core assumption, now false).
   - A locked-week indicator is shown when `weekDetail.isLocked` is true (e.g. so a coach
     understands why editing controls, if any exist in this view, are disabled).
3. While a fetch is in flight, the previously-shown week's content stays visible with a loading
   indicator (avoid a blank flash) — no acceptance criterion mandates a specific spinner
   treatment, only that switching away from a week during load doesn't leave a broken state.

No progression-note text area exists any more (research.md Decision 4) — a week's own content is
everything shown for it.

## Keyboard behavior

Unchanged from v1: `ArrowRight`/`ArrowLeft` move between chips, wrapping at the ends, now across
however many chips exist rather than a fixed four.

## PDF export (`program-pdf.js`)

`buildProgramWeekPdfContent` now takes the **currently loaded** week's own detail (whatever is
active per the switching behavior above) rather than reusing one shared `weeklySchedule` relabeled
per week — the exported PDF's content genuinely matches the week number in its filename, which
v1 did not guarantee (v1's PDF content was identical across every week number). No new fetch is
triggered at export time; exporting a week requires having viewed it first in the same session
(consistent with the lazy-fetch model above).

## Acceptance Criteria

- [ ] Opening a customer with 5 weeks of history shows 5 chips, the 5th (current) selected by
      default, chips 1-4 marked locked.
- [ ] Selecting week 2 after week 5 was shown on load fetches and displays week 2's own distinct
      routine — different exercises than week 5's, not the same list relabeled.
- [ ] Re-selecting week 5 after having viewed week 2 does not trigger a second fetch for week 5
      (already cached from initial load).
- [ ] A customer with only one week shows exactly one chip, selected by default, with no locked
      indicator (FR-007 — behaves like today for single-week customers).
- [ ] Downloading the PDF for week 2 while it is the active view produces a PDF whose exercise
      list matches week 2's content, not week 5's.
- [ ] `ArrowRight` on the last chip moves to the first chip regardless of how many chips exist.

## Testing Checklist

- [ ] Manual verification via `quickstart.md` (this feature's own quickstart, not specs/003's —
      that quickstart's week-switch scenarios are superseded).
