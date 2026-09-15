# Contract: Overview Triage Sort & Status

**Component**: `overview-view.js` + `customer-card.js`
**Requirement Refs**: FR-001, FR-002, FR-003, FR-004, Data Model → Client, Status

---

## Interface

### Input

`GET /api/customers` response — unchanged: `{ customers: [{ slug, displayName, hasProgram,
hasNotes, programGoal, lastFeedbackDate }] }`.

### Output (view behavior)

1. **Status derivation** (pure function of `lastFeedbackDate` and "now"):
   - `null` → `"no-feedback"`
   - `> 7` days old → `"needs-checkin"`
   - otherwise → `"on-track"`
2. **Sort**: primary key = status rank (`no-feedback` = 0, `needs-checkin` = 1, `on-track` = 2);
   secondary key, within `needs-checkin`/`on-track`, = `lastFeedbackDate` ascending (oldest
   first); tertiary key (tiebreaker, and primary key for entries with no date beyond the status
   bucket) = `displayName` ascending.
3. **Card contents**: name, goal (CSS-truncated to 2 lines, not string-truncated), relative
   last-check-in phrase (e.g. "8d ago", "Today", "Never"), and exactly one status pill.
4. **Header row**: section title + live client count badge + a search input that filters the
   already-sorted list by `displayName` substring match (case-insensitive), without re-sorting
   on search.
5. **Empty state** (`customers.length === 0`): one plain-language sentence plus an actionable
   next step; no mention of files, folders, or `customers/`.

## Behavior Notes

- Sorting and status derivation happen entirely client-side from data the API already returns
  — no new endpoint, no new query parameter.
- The 7-day threshold is a named constant in the view, not a magic number, so it is visibly
  tunable.
- Search filters the rendered list; it does not issue a new request.

## Acceptance Criteria

- [ ] A client with no feedback ever appears above a client with 30-day-old feedback, which
      appears above a client with 2-day-old feedback.
- [ ] Two clients both with no feedback are ordered alphabetically by name relative to each
      other.
- [ ] A client whose last feedback is exactly 8 days old shows the amber "Needs check-in" pill;
      exactly 7 days old (or fewer) shows the green "On track" pill.
- [ ] Typing in the search field narrows the visible cards without changing their relative
      order.
- [ ] Zero clients renders the empty-state sentence and CTA, not a blank list or a technical
      error.

## Testing Checklist

- [ ] Manual verification via `quickstart.md` Scenario 1 (mixed-urgency client set)
- [ ] Manual verification via `quickstart.md` Scenario 5 (zero-client empty state)
