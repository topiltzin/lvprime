# Implementation Plan: Nutrition Plan Tab in Customer UI

**Branch**: `005-nutrition-plan-tab` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-nutrition-plan-tab/spec.md`

**Note**: This plan is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a new "Nutrition Plan" tab to the customer profile page that renders nutrition_plan.md content with markdown formatting. The tab integrates into the existing TabContainer architecture alongside Program, Feedback, and Notes tabs. No changes to PDF export (remains program.md only). Nutrition plans are file-based, created separately by the nutrition specialist skill.

## Technical Context

**Language/Version**: JavaScript (ES2022+, Node.js 22.5.0+) with Vite build tooling

**Primary Dependencies**: 
- Frontend: Vue 3 (implicit via Vite), `marked` (v13.0.3) for markdown rendering, `jspdf` (v4.2.1) for PDF export
- Backend: Node.js with express-like server (`app/server/serve.js`)

**Storage**: File-system based
- Customer data: `/customers/[customer-name]/program.md`, `/feedback.md`, `/notes.md`, `/nutrition_plan.md`
- Files are read-only in UI (no in-app editing)

**Testing**: Node.js test runner (`node --test tests/`)

**Target Platform**: Browser (client-side rendering) + Node.js server

**Project Type**: Web service - coach-only dashboard for customer fitness programs

**Performance Goals**: 
- Nutrition tab load: <500ms (per spec SC-004)
- Markdown render: <200ms for typical nutrition plan (100KB max per spec FR-008)

**Constraints**: 
- No authentication system (coach-only, trusted environment)
- File-based storage (no database)
- Markdown must render with 100% accuracy (header, lists, tables, emphasis) per spec SC-002
- Existing PDF export must have zero regression

**Scale/Scope**: Single coach, 10-50 customers, ~5-15 customers active concurrently

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I: Content & Program Quality**
- ✅ PASS: This feature reads/displays nutrition_plan.md (created separately by nutrition specialist skill); no generation/save logic
- ✅ PASS: nutrition_plan.md files must conform to markdown format (enforced at creation by nutrition specialist skill, not here)
- ✅ PASS: No impact on program.md, feedback.md, or notes.md format compliance

**Principle II: Verify-Before-Save Testing Standards (NON-NEGOTIABLE)**
- ✅ PASS: This feature does NOT write to any customer files; only reads nutrition_plan.md
- ✅ PASS: No pre-save verification needed; file already created and validated by nutrition specialist skill

**Principle III: User Experience Consistency**
- ✅ PASS: Nutrition tab uses same tab navigation pattern as Program/Feedback/Notes
- ✅ PASS: Tab structure, order, and accessibility (aria-* attributes) remain consistent
- ✅ PASS: nutrition_plan.md date formats already use YYYY-MM-DD (enforced at nutrition plan creation)

**Principle IV: Performance & Responsiveness**
- ✅ PASS: Markdown rendering via `marked` library is performant; <500ms target for typical files
- ✅ PASS: Single tab load should not block other tabs; implementation uses lazy rendering per tab
- ✅ PASS: No redundant re-reads of files already loaded in session

**Overall**: ✅ **NO VIOLATIONS** — Feature complies with all four core principles. Nutrition tab is read-only display; quality gates apply at nutrition plan creation (nutrition specialist skill scope), not here.

## Project Structure

### Documentation (this feature)

```text
specs/005-nutrition-plan-tab/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── nutrition-tab-content.md
│   └── tab-api-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code - Frontend (Vite + JavaScript/Vue)

```text
app/src/
├── views/
│   └── customer-view.js           # MODIFY: Add nutrition tab config
├── components/
│   ├── tab-container.js           # MODIFY: Add nutrition content renderer
│   ├── program-pdf.js             # NO CHANGE: Program PDF export unchanged
│   └── [other tab components]     # NO CHANGE: Existing tabs untouched
└── lib/
    └── [utilities]

tests/
├── unit/
│   └── nutrition-tab.test.js      # NEW: Unit tests for nutrition rendering
└── [integration tests if added]
```

### Source Code - Backend (Node.js)

```text
app/server/
├── serve.js                       # MODIFY: Add GET /api/nutrition endpoint
└── [other endpoints unchanged]
```

**Structure Decision**: Single full-stack project (Vite frontend + Node.js backend). Feature adds:
- ONE new tab UI component (nutrition content renderer)
- ONE new API endpoint (fetch nutrition_plan.md)
- Modifications to existing TabContainer to register nutrition tab
- No database changes (file-based storage)
- No new dependencies (use existing `marked` for markdown rendering)

## Complexity Tracking

> **No violations detected** — Constitution Check passed without exceptions.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | N/A | N/A |

**Rationale**: Feature respects all four core principles (Content Quality, Verify-Before-Save, UX Consistency, Performance). No architectural exceptions or scope workarounds required.
