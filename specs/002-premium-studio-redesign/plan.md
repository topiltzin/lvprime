# Implementation Plan: Premium Studio Visual Redesign

**Branch**: `002-premium-studio-redesign` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-premium-studio-redesign/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Redesign the existing local coach dashboard (`app/`) so it reads as a premium training-studio
tool instead of an admin spreadsheet: a locked visual system (color/type/space/motion tokens),
an urgency-sorted client overview, a client detail hero, a fixed 4-tab IA (Program / Feedback /
Log Session / Notes) with working keyboard navigation and no nested-scroll trap, a Program tab
that renders each training day as structured exercise-row cards instead of raw markdown, a
Feedback tab whose stats and trend chart are computed only from real logged data, a save-session
flow that confirms and jumps to Feedback, and an honesty pass that deletes every hardcoded
placeholder ("showing good progress", fake highlights) in favor of real content or a dashed
empty state. This is a presentation/interaction-layer change on top of the existing vanilla-JS
frontend and local Node API — no new persistence, no new external services, no framework
migration.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js ≥22.5.0 (per `app/package.json` `engines`)

**Primary Dependencies**: Vite 8 (dev server + build), `marked` (Markdown → HTML rendering),
Node's built-in `node:sqlite` (`DatabaseSync`) and `node:test`; no UI framework (vanilla DOM),
no charting/toast/icon library to be added — extends the existing hand-rolled patterns in
`app/src/components/*` and `app/src/styles/*`

**Storage**: `customers/[slug]/{program,feedback,notes}.md` remain the sole source of truth
(unchanged by this feature); `app/data/index.sqlite` remains a derived, disposable read cache
rebuilt from those files (unchanged schema — see `app/server/db.js`)

**Testing**: Node's built-in `node --test` — unit tests for new Markdown parsing logic
(`app/tests/unit/`) and integration tests against the local HTTP API via the existing
`startTestServer` helper (`app/tests/integration/`); this project has no browser/DOM test
harness, so tab-navigation, motion, and visual-token requirements are verified manually via
`quickstart.md` rather than an automated UI test suite

**Target Platform**: A single coach's desktop or mobile browser, pointed at the local Node
process (`npm run dev` / `npm start`) — no server deployment, no multi-user hosting

**Project Type**: Local full-stack web application, single codebase (`app/`) combining a
static vanilla-JS frontend and a same-process local API (see `app/vite.config.js`
`localApiPlugin`) — not a frontend/backend split across separate services

**Performance Goals**: Overview triage scannable in <3s (qualitative, SC-001); tab switches
and route changes feel instant (<200ms perceived, no network round-trip); UI transitions
150–200ms per the locked motion system

**Constraints**: Local-only tool, no auth/network exposure (existing `api-client.js`
constraint, unchanged); must not require customers to re-author existing `program.md`/
`feedback.md` files in a new format (Constitution Principle I); must not introduce a UI
framework or new runtime dependency for what the existing vanilla-DOM + hand-rolled-SVG
approach already covers; must remain usable at ~390px and ~1280px viewport widths with no
horizontal page scroll

**Scale/Scope**: 2 customers today (`jaqueline-orellano`, `topiltzin-flores`), designed to
scale to an arbitrary small number of coach's clients; programs up to ~6 training days with
up to ~10 exercises per day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature only changes how existing customer data is *presented and interacted with* in
`app/`; it does not change the `program.md`/`feedback.md`/`notes.md` file formats, the
customer creation/update workflow, or the write path for feedback. Checked against
`.specify/memory/constitution.md`:

- **I. Content & Program Quality** — PASS. No change to what gets written to `program.md`,
  `feedback.md`, or `notes.md`, or to the fitness-coach skill. The new structured exercise-row
  rendering (User Story 2) is read-only display logic layered on top of the existing renderer;
  research.md documents a fallback to the current whole-day HTML block whenever a day's body
  doesn't match the expected exercise-line pattern, so no authored content is ever hidden or
  altered — only re-presented.
- **II. Verify-Before-Save Testing Standards (NON-NEGOTIABLE)** — PASS. The feedback save path
  (`validateFeedbackSubmission` → `appendFeedbackEntry`) is unchanged; this feature only changes
  what happens in the UI *after* a successful save (toast + tab switch), not the validation or
  write logic itself.
- **III. User Experience Consistency** — PASS. Customer-facing Markdown files keep their
  existing structure/dates/language exactly as authored (spec FR-011); this principle governs
  the coaching *workflow*, which this frontend-only feature does not touch.
- **IV. Performance & Responsiveness** — PASS, and directly reinforced: the redesign's explicit
  goals (3-second scan, single-surface scroll, snappy 150–200ms motion) are this principle's
  UI-facing expression.

No violations identified.

*Post-Phase 1 re-check*: `data-model.md` and `contracts/` (Phase 1 outputs, above) confirm the
same conclusion — every new field (`exercises[]`, derived `status`, derived Feedback Stats) is
either read-only/derived or additive to the existing API response, and the Notes/History
honesty pass only removes fabricated content, so no principle is put at risk by the concrete
design. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-premium-studio-redesign/
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
├── src/
│   ├── main.js                     # hash router (unchanged routes: "/", "/customers/:slug")
│   ├── api-client.js               # fetch wrapper (unchanged: same 3 endpoints)
│   ├── views/
│   │   ├── overview-view.js        # US1: urgency sort + search + empty state
│   │   ├── customer-view.js        # US4: hero block, 4-tab config, drop fake highlights/notes
│   │   └── feedback-form-view.js   # US3: larger inputs, full-width submit
│   ├── components/
│   │   ├── customer-card.js        # US1: status pill + relative date
│   │   ├── tab-container.js        # US4: default-first-enabled tab, arrow-key nav, no inner scroll
│   │   ├── trend-chart.js          # US3: thicker bars, legend, readable date labels
│   │   ├── feedback-entry.js       # US3: date-bold card, 2x2 fact grid
│   │   ├── program-day.js          # NEW — US2: day card with exercise rows (green rail, sticky subnav)
│   │   └── toast.js                # NEW — US3: transient save confirmation
│   └── styles/
│       ├── tokens.css              # NEW — locked color/type/space/radius/shadow/motion custom properties
│       ├── main.css                # header/hero/cards restyle; imports tokens.css; drops Google Fonts import
│       └── tabs.css                # segmented-control tab styling; remove max-height/overflow-y trap
├── server/
│   └── markdown-parser.js          # US2: extend parseProgramDetail() to also emit structured exercises[]
├── fonts/                          # NEW — self-hosted Inter / Inter Tight files served as static assets
└── tests/
    ├── unit/
    │   └── markdown-parser.test.js # extend: exercise-row extraction cases (ES + EN, malformed fallback)
    └── integration/
        └── customer-detail.test.js # extend: response includes exercises[] per day

customers/                          # unchanged — source-of-truth Markdown, not touched by this feature
```

**Structure Decision**: Single existing local web application (`app/`), not a frontend/backend
split — the "backend" is a same-process local API mounted as Vite middleware
(`app/vite.config.js`), so this feature's server-side change (structured exercise parsing)
lives in `app/server/markdown-parser.js` alongside the frontend changes in `app/src/`. No new
top-level directories; `app/fonts/` is the only new directory, added to self-host the type
system instead of depending on a remote font CDN.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.
