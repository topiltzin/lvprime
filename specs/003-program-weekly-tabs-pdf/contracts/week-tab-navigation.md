# Contract: Program Week Selector

> **Superseded** by `specs/010-weekly-routine-versioning/contracts/week-tab-navigation-v2.md`
> (2026-09-23). Weeks are now independent routines; do not implement against this contract.

**Component**: `week-subnav.js` (new) + `tab-container.js`'s `renderProgramContent`
(`app/src/components/`)
**Requirement Refs**: FR-001, FR-002, FR-003, FR-010, FR-011

---

## Interface

### Selector set

Exactly four week selectors, in fixed order: `Week 1`, `Week 2`, `Week 3`, `Week 4` — always
all four, regardless of a customer's `planDuration` or how many entries `weeklyProgression`
actually contains (spec.md Assumptions: the 4-week structure is fixed).

### Default selection

`Week 1` is selected on first render of the Program tab for a given customer. Switching
customers (navigating to a different customer page) resets the selection back to `Week 1` —
it is view state, not a persisted preference.

### Visibility rule

The week selector row and the "Download PDF" button (see
`pdf-export-download.md`) are only rendered when the Program tab itself would already show
content — i.e. `program.present` is `true`. When a customer has no program at all, the
existing "no program yet" empty state continues to take priority and neither the selectors
nor the PDF button appear (FR-010).

### Switching behavior

Selecting a week is a pure client-side re-render:
- The day-by-day schedule (`weeklySchedule`, rendered via the existing `renderProgramDay` /
  `renderDaySubnav`) is unchanged — same days, same exercises, same order — regardless of
  which week is active (FR-003, FR-011).
- Only the progression-note area updates, to the `Program Week.progressionText` for the newly
  selected week (data-model.md).
- No network request is triggered by switching weeks (mirrors the existing tab-switch
  behavior documented in `specs/002-premium-studio-redesign/contracts/tab-navigation.md`).

### Keyboard behavior

Same pattern as the existing tab header: with focus on the week-selector row, `ArrowRight` /
`ArrowLeft` move selection between the four week chips, wrapping at the ends.

## Behavior Notes

- Exactly one week selector carries the active/selected visual state at all times.
- The existing day-subnav (chip-per-day, jump-scroll) inside the schedule area is unaffected
  by week switching — it continues to operate on the one shared `weeklySchedule`.

## Acceptance Criteria

- [ ] Opening any customer with a program shows all four week selectors, Week 1 active by
      default.
- [ ] Selecting Week 3 updates only the progression note shown; the day cards and exercises
      underneath are identical to what was shown under Week 1.
- [ ] A customer whose `weeklyProgression` is `[]` still shows all four week selectors; each
      one displays the FR-005 fallback message.
- [ ] A customer with no program at all shows neither the week selectors nor the PDF button —
      only the existing empty state.
- [ ] `ArrowRight` on Week 4 moves selection to Week 1; `ArrowLeft` on Week 1 moves selection
      to Week 4.

## Testing Checklist

- [ ] Manual verification via `quickstart.md` Scenario 1 (week switch, default selection).
- [ ] Manual verification via `quickstart.md` Scenario 2 (no-progression-section customer).
