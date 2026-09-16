# Research: Weekly Program Tabs with PDF Download

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the two scope-critical
questions (week-tab content model, PDF scope) were already resolved with the user during
`/speckit-specify` and are recorded in spec.md's Assumptions. This file covers the remaining
technical decisions needed to implement the feature.

## 1. PDF generation approach

**Decision**: Generate the PDF entirely client-side, in the browser, using a small
JavaScript PDF library (`jspdf`) invoked from a new `app/src/components/program-pdf.js`
module. The module builds a structured content model (week label, day/exercise text,
progression note) from data already loaded for the active week and writes it directly as
text/layout via jsPDF's API — not a rasterized screenshot of the DOM. The resulting file is
produced as a `Blob` and downloaded via a temporary `<a download>` click, giving a
deterministic, single-click file download.

**Rationale**:
- **No new server dependency.** The app's server (`app/server/index.js`) is a plain Node
  `http` server with no framework; adding a headless-browser dependency (e.g. Puppeteer) to
  render PDFs server-side would introduce a large new dependency, a slower cold start, and a
  new failure surface (browser binary download/sandboxing) that is disproportionate to a
  single-week text document. This conflicts with the project's current minimal-dependency
  footprint (`package.json` has exactly one runtime dependency, `marked`, besides fonts).
- **Deterministic download vs. browser print-to-PDF.** `window.print()` with a print
  stylesheet was considered — it requires zero new dependencies, but the user must manually
  choose "Save as PDF" in the OS print dialog rather than a destination the app controls.
  That's a worse fit for FR-007/FR-008 (a downloaded, self-contained file) and is harder to
  verify automatically or manually per SC-003/SC-004 (a print dialog's exact output isn't
  something a `node --test` unit test — or even a consistent manual check — can assert on).
- **Text-based PDF, not html2canvas screenshot.** Libraries like `html2pdf.js` rasterize the
  DOM into an image before embedding it in a PDF. That produces a heavier file, blurs on
  zoom/print, and isn't selectable/searchable text — a worse match for Constitution
  Principle I ("format fidelity" for an exported deliverable) than writing the same
  structured content jsPDF already has as real PDF text.
- **Client-side data is already sufficient.** The week's schedule and progression note are
  already fetched and rendered on the page before the button is ever clickable (FR-006 is
  positioned after the week content), so no additional network round-trip is needed —
  keeping PDF generation well inside SC-003's 10-second budget.

**Alternatives considered**:
| Option | Rejected because |
|---|---|
| Server-side headless browser (Puppeteer/Playwright PDF) | Large new dependency, slower, mismatched with the project's plain-`http` server and minimal-dependency philosophy; no other feature in this codebase needs a browser runtime on the server |
| `window.print()` + print stylesheet | Not a deterministic single-click download (user must pick "Save as PDF" themselves); fragile to verify against SC-004 |
| `html2pdf.js` / `html2canvas` (DOM screenshot) | Produces a rasterized, non-selectable PDF; heavier output; more fragile to layout changes than direct text placement |
| Third-party PDF-generation web API/service | Requires network access and an external account/API key for a fully local, offline coaching tool — inconsistent with `CLAUDE.md`'s local-file-based design and adds an availability dependency the rest of the app doesn't have |

## 2. Matching weekly progression text to a week number

**Decision**: Extend `parseProgramDetail()` in `app/server/markdown-parser.js` to also parse a
`weeklyProgression: { weekNumber: number, text: string }[]` array, sourced from the program's
existing "Progresión Semanal (4 semanas)" / "Weekly Progression" section (already present in
real customer files, e.g. `customers/jaqueline-orellano/program.md`), using the same
regex-based, section-scanning approach already used for `progressionHtml`. Each bullet line
matching `**Semana N:**` / `**Week N:**` becomes one entry; the API's program payload gains
this new field, following the same "new response field, no schema migration" pattern used by
the 002 feature's `exercises` field (see `specs/002-premium-studio-redesign/data-model.md`).

**Rationale**: This is a pure extension of an existing, proven parsing approach — no new
parsing strategy, no change to how program.md files are authored, and no risk to the existing
`progressionHtml` field (which stays unchanged as the fallback full-text rendering, still shown
independent of the per-week matching, consistent with spec.md's Assumptions).

**Alternatives considered**:
| Option | Rejected because |
|---|---|
| Require a new, separate markdown format for weekly progression | Contradicts the resolved scope decision (spec.md Assumption: "No new authoring requirements are placed on how program.md files are written") |
| Parse progression matching entirely client-side from `progressionHtml` (already-rendered HTML) | Would mean re-parsing rendered HTML with regex on the client instead of the original Markdown on the server — more fragile (HTML structure from `marked` is an implementation detail) and duplicates parsing logic that already exists server-side |

## 3. Week selector UI pattern

**Decision**: Reuse the existing day-subnav visual/interaction pattern (`renderDaySubnav` /
`.day-subnav` / `.day-chip` in `program-day.js` and `main.css`) at a new level: a small
`week-subnav.js` component renders four chips (Week 1–4), and clicking one is a pure
client-side state change (re-render the day-by-day schedule area + swap the progression note),
not a navigation or network request — consistent with `tab-container.js`'s existing
"switching tabs never triggers a network request" behavior documented in
`specs/002-premium-studio-redesign/contracts/tab-navigation.md`.

**Rationale**: Matches Constitution Principle III (UX consistency — one coaching-tool visual
language, not a new idiom per feature) and satisfies SC-001 (under 5s, no reload) essentially
for free, since no data fetch is involved in switching weeks.

## 4. Testing strategy for the PDF feature

**Decision**: Split PDF logic into two layers so the content-selection logic is fully
unit-testable without a browser: (1) a pure function
`buildProgramWeekPdfContent(weekNumber, programDetail)` in `program-pdf.js` that returns a
plain content model (`{ weekLabel, days, progressionText }`, including the FR-005 fallback
message when no progression entry matches), covered by `tests/unit/program-pdf.test.js` under
`node --test`; and (2) a thin rendering layer that hands that content model to `jsPDF` and
triggers the download, which is validated manually via `quickstart.md` (open the resulting PDF
in a viewer) rather than through an automated test, matching how this project already treats
rendered/visual output (no existing test opens a real PDF or takes a screenshot).

**Rationale**: Consistent with the project's existing test boundary — `node --test` covers pure
parsing/derivation logic (see `tests/unit/markdown-parser.test.js`,
`tests/unit/status.test.js`), while actual rendered output is verified by hand via
`quickstart.md`, per Constitution Principle IV's requirement that exported deliverables be
"verified to render without errors before being handed to the customer."
