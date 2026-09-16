# Quickstart: Validating Weekly Program Tabs with PDF Download

**Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/](./contracts/)

This guide validates the feature end-to-end against a running local instance. It assumes the
feature has been implemented per `plan.md`/`tasks.md` — it is a verification script, not an
implementation guide.

## Prerequisites

- Node.js ≥22.5.0
- Repo checked out with existing `customers/jaqueline-orellano/` (has a 4-entry weekly
  progression section) and `customers/topiltzin-flores/` fixture data intact

## Setup

```bash
cd app
npm install
npm run dev
```

Open the printed local URL (e.g. `http://localhost:5173`) in a browser.

## Scenario 1 — Week switch + default selection (`contracts/week-tab-navigation.md`)

1. Open `jaqueline-orellano`'s customer page and go to the **Program** tab.
2. **Expect**: four week selectors — Week 1, Week 2, Week 3, Week 4 — appear inside the
   Program tab, with Week 1 active by default.
3. **Expect**: the day-by-day schedule (Lunes–Domingo cards) is visible under Week 1, along
   with Week 1's progression note ("Encontrar una carga cómoda y dominar la técnica.").
4. Click Week 3. **Expect**: the day cards stay exactly the same (same days, same exercises,
   same order) — only the progression note changes, to Week 3's text ("Si completa todas las
   repeticiones con buena técnica, aumentar ligeramente la carga.").
5. Click into the week-selector row and press the right-arrow key repeatedly. **Expect**:
   selection cycles through all four weeks and wraps from Week 4 back to Week 1. Press
   left-arrow from Week 1 — **expect** it wraps to Week 4.

## Scenario 2 — No weekly progression section (`contracts/weekly-progression-parsing.md`)

1. Temporarily remove (or use a fixture without) a "Progresión Semanal" / "Weekly Progression"
   section from a customer's `program.md`, or pick a customer that never had one.
2. Open that customer's Program tab. **Expect**: all four week selectors still appear (the
   fixed 4-week structure is unaffected), each showing the FR-005 fallback message ("No
   specific guidance for this week.") instead of a blank area or an invented note.
3. Restore the file afterward if you edited it.

## Scenario 3 — PDF download reflects the active week (`contracts/pdf-export-download.md`)

1. On `jaqueline-orellano`'s Program tab, select Week 2 and click **Download PDF**.
2. **Expect**: a file named like `jaqueline-orellano-week-2.pdf` downloads immediately (well
   under 10 seconds, SC-003).
3. Open the downloaded PDF in a PDF viewer. **Expect**: it shows "Week 2", the full
   day-by-day schedule, and Week 2's progression note — legible, selectable text (not a
   blurry screenshot).
4. Switch to Week 4 on the page and click **Download PDF** again. **Expect**: a second file
   downloads reflecting Week 4, distinct from the first.
5. Repeat steps 1–3 for `topiltzin-flores` and at least one more customer with a different
   schedule length, to confirm the PDF renders correctly across varied program shapes
   (SC-004). This manual check satisfies Constitution Principle IV's requirement that an
   exported deliverable be verified to render without errors before being handed to the
   customer.
6. Pick a customer whose program has an empty schedule (or temporarily empty one out) and
   click **Download PDF**. **Expect**: the PDF still downloads, showing the week label and an
   explicit "no schedule available" message rather than erroring or producing a blank file.

## Scenario 4 — Empty-state precedence (spec.md Edge Cases)

1. Open a customer with no program at all (`program.present === false`).
2. **Expect**: the existing "no program yet" empty state is shown, and neither the week
   selectors nor the "Download PDF" button appear (FR-010).

## Automated checks

```bash
cd app
npm test
```

**Expect**: all tests pass, including the new/updated cases in
`app/tests/unit/markdown-parser.test.js` (weekly progression parsing — full, partial, absent,
out-of-range week numbers), `app/tests/unit/program-pdf.test.js` (PDF content model:
matching entry, fallback message, empty schedule), and
`app/tests/integration/customer-detail.test.js` (API response includes `weeklyProgression`).

## Viewport check

With the browser at ~390px wide and again at ~1280px wide, revisit a client's Program tab.
**Expect**: the week selectors wrap or scroll horizontally without breaking layout, and the
"Download PDF" button remains full-width/tappable on mobile, consistent with the rest of the
Program tab (no new horizontal page scrollbar at either width).
