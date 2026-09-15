# Quickstart: Validating the Premium Studio Redesign

**Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/](./contracts/)

This guide validates the redesign end-to-end against a running local instance. It assumes the
feature has been implemented per `plan.md`/`tasks.md` — it is a verification script, not an
implementation guide.

## Prerequisites

- Node.js ≥22.5.0
- Repo checked out with existing `customers/jaqueline-orellano/` and `customers/topiltzin-flores/`
  fixture data intact (both already exercise real acceptance scenarios below)

## Setup

```bash
cd app
npm install
npm run dev
```

Open the printed local URL (e.g. `http://localhost:5173`) in a browser. For mobile-width
checks, use the browser's responsive/device-toolbar mode set to ~390px wide; for desktop
checks, use ~1280px wide.

## Scenario 1 — Overview triage (User Story 1 / `contracts/overview-triage.md`)

1. Ensure at least one fixture client has feedback logged within the last 7 days
   (`topiltzin-flores` or `jaqueline-orellano`, whichever has a recent entry), and temporarily
   note/create a client folder with no `feedback.md` entries at all to see the "no feedback"
   case (or rely on a client whose feedback.md is empty).
2. Open `#/` (the overview).
3. **Expect**: within 3 seconds of looking at the screen, you can name which client needs
   attention first — that client's card should be positioned first, with a dashed "No
   feedback" or amber "Needs check-in" pill (not green).
4. **Expect**: the section header shows "Clients" with a live count badge, and a search field.
   Type part of a client's name — the list narrows without reordering.
5. Temporarily rename/move all customer folders aside (or point `FITNESS_DASHBOARD_DB_PATH`
   at an empty temp DB) and reload — **expect** a single-sentence empty state with an
   actionable next step, no mention of files/folders. Restore the folders afterward.

## Scenario 2 — Log a session and land in Feedback (User Story 3 / `contracts/feedback-honesty-and-stats.md`)

1. Open a client detail page, go to the **Log Session** tab.
2. Fill in the form (date defaults to today) and submit.
3. **Expect**: a brief success confirmation appears, and the visible tab automatically becomes
   **Feedback**, showing the new entry.
4. **Expect**: the three stat tiles (Completion %, Last session, Average difficulty) reflect
   the client's real logged entries — cross-check the completion % by hand against the visible
   entry list.
5. On mobile width (~390px), repeat step 2 — **expect** the submit button spans full width and
   inputs are comfortably tappable (no need to zoom).

## Scenario 3 — Tab default + keyboard navigation (User Story 4 / `contracts/tab-navigation.md`)

1. Open a client whose program is present but who has zero feedback entries.
2. **Expect**: the **Program** tab is selected automatically on load (first enabled tab).
3. Open a client with zero program but at least one feedback entry.
4. **Expect**: the **Feedback** tab is selected automatically (Program is disabled/absent, so
   the next enabled tab becomes default) — this is the fixed default-tab bug.
5. Click into the tab bar and press the right-arrow key repeatedly. **Expect**: selection
   cycles through every enabled tab and wraps back to the first. Press left-arrow — **expect**
   it cycles backward and wraps to the last.

## Scenario 4 — Single-surface scroll (User Story 4 / `contracts/tab-navigation.md`)

1. Open `jaqueline-orellano` (a 5-day program with multiple exercises per day) and go to the
   **Program** tab.
2. Scroll down using the mouse wheel/trackpad from the top of the page.
3. **Expect**: the whole page scrolls continuously — the hero, tab bar, and program cards all
   move together. There is no point where scrolling "gets stuck" inside an inner box while the
   page around it stays fixed.

## Scenario 5 — Program as workout cards (User Story 2 / `contracts/exercise-row-parsing.md`)

1. Open `jaqueline-orellano`'s **Program** tab (Spanish-authored) and `topiltzin-flores`'s
   **Program** tab (English-authored).
2. **Expect** on both: each day renders as its own card (day name + focus as the title), and
   each exercise appears as a distinct row — name, sets×reps, and rest period all legible at a
   glance, not as a single paragraph of numbered text.
3. **Expect**: exercise form tips are visually smaller/secondary to the exercise name.
4. **Expect**: authored Spanish text (`jaqueline-orellano`) is displayed exactly as written —
   not translated — while the surrounding tab labels/buttons remain in the dashboard's own
   consistent (English) chrome language.
5. If the program has more days than fit on one screen, **expect** a day sub-navigation
   (chips) that jumps to each day's card when clicked.

## Scenario 6 — Notes and stats honesty (User Story 3 / `contracts/feedback-honesty-and-stats.md`)

1. Find or create a client with no `notes.md` content and no feedback entries.
2. Open their **Notes** tab. **Expect**: a dashed empty-state card, not any invented
   "progress" narrative.
3. Open their **Feedback** tab. **Expect**: all three stat tiles and the trend chart show
   explicit empty states, not `0%`/`N/A` silently substituting for real values.
4. Run a repo-wide search to confirm no residual placeholder strings remain:
   ```bash
   grep -rn "showing good progress\|Continue with current program\|Program is progressing well\|Consistent session completion" app/src
   ```
   **Expect**: no matches.

## Automated checks

```bash
cd app
npm test
```

**Expect**: all tests pass, including the new/updated cases in
`app/tests/unit/markdown-parser.test.js` (exercise-row extraction, both languages, and the
no-match fallback) and `app/tests/integration/customer-detail.test.js` (response includes
`exercises[]` per day).

## Viewport check

With the browser at ~390px wide and again at ~1280px wide, revisit the overview and one client
detail page. **Expect**: no horizontal page scrollbar at either width, and all text/buttons
remain legible and tappable.
