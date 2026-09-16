# Implementation Plan: Weekly Program Tabs with PDF Download

**Branch**: `003-program-weekly-tabs-pdf` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-program-weekly-tabs-pdf/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Inside the customer page's Program tab, add four week selectors (Week 1–4) that all show the
same existing day-by-day exercise schedule but swap in that week's progression note (parsed
from the program's existing "Progresión Semanal (4 semanas)" section, matched by week number,
falling back to an explicit "no specific guidance" message when a week has none). Add a
"Download PDF" button at the end of the Program tab that generates a structured, offline-usable
PDF of whichever week is currently selected, entirely client-side (no new server dependency),
using a small PDF-generation library invoked with data already loaded on the page.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js >=22.5.0

**Primary Dependencies**: Vite 8 (dev server/build), `marked` 13 (Markdown rendering, existing);
new: a lightweight client-side PDF-generation library (`jspdf`, decided in research.md §1)

**Storage**: N/A for this feature — read-only over the existing `app/data/index.sqlite` cache and
`customers/*/program.md` files; no schema change

**Testing**: Node built-in test runner (`node --test`), existing `tests/unit/` +
`tests/integration/` structure

**Target Platform**: Browser (desktop web), served by the existing local Vite/Node app

**Project Type**: Web application — single `app/` directory combining a local Node API
(`app/server/`) and a vanilla-JS frontend (`app/src/`), not a split frontend/backend repo

**Performance Goals**: Switching between week selectors completes in under 5s with no page
reload or network request (SC-001); PDF download completes in under 10s from button click
(SC-003)

**Constraints**: PDF must be a self-contained, offline-usable file, not a link requiring further
app access (FR-008); no new heavy server-side dependency (e.g. a headless browser) — stays
consistent with the project's current zero-framework, minimal-dependency footprint

**Scale/Scope**: Single coach, small customer roster (tens of customers); one Program tab per
customer page, four week sub-views each reusing the same schedule data already loaded for that
customer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Content & Program Quality** — PASS. The PDF is a structured export of data already
  required to be complete in `program.md` (schedule, progression); no new content is
  fabricated, and the week tabs + PDF never present content beyond what's already validated
  at program-authoring time.
- **II. Verify-Before-Save Testing Standards** — N/A. This feature is read/export-only; it
  never writes `program.md`, `feedback.md`, or `notes.md`, so the pre-save verification gate
  doesn't apply. No customer file is modified by this feature.
- **III. User Experience Consistency** — PASS. Week selectors reuse the existing day-subnav
  chip pattern (visual + interaction) already established in the Program tab, keeping the
  coaching-tool voice consistent rather than introducing a new UI idiom.
- **IV. Performance & Responsiveness** — PASS, with an explicit obligation: per this
  principle, the PDF export "MUST be generated and verified to render without errors before
  being handed to the customer" — satisfied by quickstart.md Scenario 3 (manual PDF-opens
  check across sample customer programs, mirroring SC-004) before this feature is considered
  done. Client-side generation from already-loaded data avoids redundant re-reads/re-fetches.

No violations. Complexity Tracking is not needed.

**Post-Phase 1 re-check**: The Phase 0/1 design (research.md, data-model.md, contracts/)
confirms client-side-only PDF generation from already-parsed data, a pure/testable PDF-content
function, and a UI pattern reused from the existing day-subnav — none of it introduces a new
server dependency, a customer-file write, or a UI idiom inconsistent with the rest of the app.
All four gates still PASS; no new violations were introduced during design.

## Project Structure

### Documentation (this feature)

```text
specs/003-program-weekly-tabs-pdf/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── server/
│   └── markdown-parser.js       # extend parseProgramDetail() to also extract
│                                 # weeklyProgression: {weekNumber, text}[] (research.md §2)
├── src/
│   ├── components/
│   │   ├── tab-container.js     # Program panel gains the week-selector row + PDF button
│   │   ├── program-day.js       # unchanged — still renders each day card within a week
│   │   ├── week-subnav.js       # NEW — renders the 4 week chips, mirrors day-subnav pattern
│   │   └── program-pdf.js       # NEW — builds the PDF content model + triggers the
│   │                             # jsPDF-generated download for the active week
│   └── styles/
│       └── main.css             # NEW .week-subnav / .week-chip rules alongside existing
│                                 # .day-subnav / .day-chip rules
└── tests/
    ├── unit/
    │   ├── markdown-parser.test.js  # add cases for weeklyProgression parsing
    │   └── program-pdf.test.js      # NEW — tests the pure PDF-content-model builder
    └── integration/
        └── customer-detail.test.js  # add case: API payload includes weeklyProgression
```

**Structure Decision**: This is a single Vite-served application (`app/`) combining a local
Node API (`app/server/`) and a vanilla-JS frontend (`app/src/`) in one project — not a split
frontend/backend repo. This feature extends that existing structure in place: one server-side
parser extension, two new small frontend components, and CSS additions alongside the existing
day-subnav rules. No new top-level directories or services are introduced.

## Complexity Tracking

Not applicable — no Constitution Check violations.
