# Contract: Program Week PDF Export

**Component**: `program-pdf.js` (new, `app/src/components/`)
**Requirement Refs**: FR-006, FR-007, FR-008, FR-009, FR-010

---

## Interface

### `buildProgramWeekPdfContent(weekNumber, programDetail)` (pure function)

**Input**:
- `weekNumber`: number, 1–4 — the currently selected week.
- `programDetail`: the program object described in data-model.md (`weeklySchedule`,
  `weeklyProgression`).

**Output**: a `Program PDF Document` object (data-model.md) —
`{ weekLabel, days, progressionText }` — with no side effects and no dependency on the DOM or
`jsPDF`, so it is testable with plain `node --test` assertions.

**Rules**:
- `days` is exactly `programDetail.weeklySchedule` (same array shown on screen for the active
  week) — `[]` when the program has no schedule content.
- `progressionText` is the matching `weeklyProgression` entry's `text` for `weekNumber`, or
  the fallback message defined in data-model.md/FR-005 when none matches.

### `downloadProgramWeekPdf(weekNumber, programDetail, customerName)` (side-effecting)

Called on "Download PDF" click. Builds the content model via
`buildProgramWeekPdfContent`, renders it with `jsPDF` into a `Blob`, and triggers a browser
download via a temporary `<a download>` element — no server request, no page navigation.

**Filename pattern**: `<customer-slug>-week-<weekNumber>.pdf` (kebab-case, consistent with
existing customer slug formatting elsewhere in the app).

**Failure handling (FR-009)**: Any error thrown during content-building or PDF rendering is
caught by the caller (the button's click handler in `tab-container.js`), which shows an inline
error message (reusing the existing `toast.js` component) and leaves the Program tab otherwise
usable — it does not throw an unhandled error or leave the button in a stuck/loading state.

### "Download PDF" button placement

Rendered once, after the week content (schedule + progression note), inside the Program tab's
panel — not per-week-selector, since it always acts on whichever week is currently active
(FR-006, FR-007). Hidden under the same visibility rule as the week selectors
(`week-tab-navigation.md`) when the customer has no program (FR-010).

## Behavior Notes

- Re-clicking "Download PDF" after switching weeks produces a new PDF reflecting the newly
  active week — the button always reads current view state at click time, never a cached
  result from a previous click (spec.md User Story 2, Acceptance Scenario 2).
- The generated PDF is a standalone file usable without the app running (FR-008) — it embeds
  all text directly rather than linking back to the app.
- Concurrent/rapid clicks each independently build and download their own file; one click's
  generation does not block or corrupt another's (spec.md Edge Cases).

## Acceptance Criteria

- [ ] Clicking "Download PDF" while Week 2 is active downloads a file whose content
      (label, schedule, progression text) matches Week 2.
- [ ] Switching to Week 4 and clicking again downloads a *different* file reflecting Week 4.
- [ ] A program with an empty `weeklySchedule` still produces a PDF, showing the week label
      and an explicit "no schedule available" message rather than an error or blank file.
- [ ] A simulated PDF-generation failure surfaces a visible inline error and leaves the
      button clickable again (no stuck state).

## Testing Checklist

- [ ] `tests/unit/program-pdf.test.js` — `buildProgramWeekPdfContent` covered for: a normal
      week with a matching progression entry, a week with no matching entry (fallback
      message), and an empty schedule.
- [ ] Manual verification via `quickstart.md` Scenario 3 — download a PDF for at least 3
      sample customer programs and open each in a PDF viewer to confirm legibility and
      completeness (SC-004), per Constitution Principle IV's render-before-handoff
      requirement.
