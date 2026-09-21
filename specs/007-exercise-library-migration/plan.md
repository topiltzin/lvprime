# Implementation Plan: Exercise Library Migration & Video Linking

**Branch**: `007-exercise-library-migration` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-exercise-library-migration/spec.md`

## Summary

Move the exercise reference data currently in the repo-root `exercise.md` file into a new
`exercises` table in the same Supabase PostgreSQL database that already holds customer/program/
feedback/notes/nutrition_plan data (specs/006-customer-data-storage). Extend the existing
program-detail read path (`parseProgramDetail()` in `app/server/markdown-parser.js`, already
extracting structured `{name, setsReps, rest, formTip}` rows per spec 002's
exercise-row-parsing.md contract) to resolve each exercise's `name` against the new table and
attach a `videoUrl`, so `app/src/components/program-day.js` can render the exercise name itself
as a link to its demo video. Once migration is verified complete, delete `exercise.md` from the
repository — nothing in the app reads it after this change ships.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js >=22.5.0

**Primary Dependencies**: `@supabase/supabase-js` ^2.116.0 (Postgres client, already used by
`app/server/lib/database-client.js`), `marked` ^13 (Markdown→HTML rendering, unchanged), Vite ^8
(dev/build, unchanged) — no new runtime dependencies required

**Storage**: Supabase PostgreSQL — adds one new `exercises` table alongside the existing
`customers`/`programs`/`feedbacks`/`notes`/`nutrition_plans`/`offline_queue_entries`/`sync_events`
tables (specs/006-customer-data-storage/contracts/database-schema.md)

**Testing**: Node built-in test runner (`node --test tests/`, per `app/package.json`'s `test`
script); unit tests under `app/tests/unit/`, integration tests under `app/tests/integration/`
(existing convention — e.g. `markdown-parser.test.js`, `customer-detail.test.js`)

**Target Platform**: Linux server (Node backend, `app/server/index.js`) + browser (Vite-bundled
vanilla-JS frontend, `app/src/`) — coach-only dashboard, single deployable `app/` project

**Project Type**: Web application — single `app/` directory containing both server and frontend
code (not a separate `frontend/`/`backend/` split)

**Performance Goals**: Exercise-video enrichment must not push customer-profile load past the
existing <500ms budget (specs/006 SC-004). Met by loading the full exercise library (~40 rows) in
one query, in parallel with the 4 existing per-customer queries already run via `Promise.all` in
`getCustomerFullProfile()`, and resolving all of a program's exercise names against one in-memory
lookup — never one DB round trip per exercise line.

**Constraints**: Exercise-name matching is case-insensitive exact match only (spec FR-007, no
fuzzy/partial matching). `programs.content` bytes are never rewritten by this feature — linking is
applied only in the read/render path, preserving exercise-row-parsing.md's existing "no write-back"
rule. `exercise.md` is deleted only after migration completeness is verified (spec FR-009).

**Scale/Scope**: ~40 exercise reference rows (current `exercise.md`), 10-50 customers (existing
scale per specs/006 plan.md), linking applied across every existing customer program at render
time (spec FR-006), not just newly generated ones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Content & Program Quality** — PASS. This feature does not change what a saved
  `program.md`/`programs.content` must contain, and does not touch `.agents/skills/fitness-coach/
  SKILL.md`'s output format. `exercise.md` itself is not one of the three constitution-defined
  customer artifacts (`program.md`/`feedback.md`/`notes.md`); it's shared reference data. Migration
  fidelity (no exercise/link lost) is covered by spec FR-002/SC-001.
- **II. Verify-Before-Save Testing Standards** — PASS / N/A. This feature performs no writes to
  `program.md`, `feedback.md`, or `notes.md` content — it only reads and enriches the render output
  (exercise-row-parsing.md's "no write-back" rule, reused). The one new write path (upserting rows
  into `exercises`) is reference-library maintenance, not customer-program authoring, so the
  save-time verification this principle governs doesn't apply to it the way it applies to
  program/feedback/notes writes.
- **III. User Experience Consistency** — PASS. Video links render with the same treatment for
  every customer's program (spec Success Criteria SC-002), and dates/format elsewhere are
  untouched.
- **IV. Performance & Responsiveness** — PASS, see Performance Goals above: one extra
  parallelized query, no added redundant re-reads.
- **Customer Data Standards** ("no customer data may be stored outside `customers/[name]/`...")
  — N/A, not a violation risk introduced by this feature. This clause is already textually stale
  relative to the shipped specs/006 migration (customer program/feedback/notes data already lives
  in Supabase, not under `customers/[name]/`, per that spec's accepted change). The new `exercises`
  table is not customer data at all — it's a shared reference library — so it doesn't worsen or
  interact with that pre-existing drift. Flagging here for visibility, not proposing a
  constitution amendment as part of this feature.
- **Development Workflow & Quality Gates** — N/A. That section governs the coach's per-customer
  interaction sequence (confirm new/existing → read feedback → log entry → update notes → adjust
  program). This feature is a one-time data migration plus a render-path enhancement; it doesn't
  touch that workflow.

No violations requiring justification — Complexity Tracking table intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/007-exercise-library-migration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
exercise.md                              # Deleted once migration is verified (US3)

app/
├── server/
│   ├── markdown-parser.js               # extractExercises()/parseProgramDetail(): attach
│   │                                     #   videoUrl to each extracted exercise (extends
│   │                                     #   specs/002 exercise-row-parsing.md contract)
│   ├── lib/
│   │   ├── customer-data.js             # add listExercises()/getExerciseVideoLinkMap()/
│   │   │                                 #   upsertExercise(), following the existing
│   │   │                                 #   get*/upsert* patterns in this file
│   │   └── database-client.js           # unchanged — reused as-is
│   ├── migrations/
│   │   ├── migrate-data.js              # existing customer-data migration (pattern reference)
│   │   └── migrate-exercises.js         # NEW: one-time exercise.md -> exercises table migration
│   └── index.js                         # handleGetCustomer: pass exercise link map through to
│                                         #   parseProgramDetail's caller
├── src/
│   └── components/
│       └── program-day.js               # renderExerciseRow(): render exercise.name as an <a>
│                                         #   when exercise.videoUrl is present, plain text
│                                         #   otherwise
└── tests/
    ├── unit/
    │   └── markdown-parser.test.js      # extend with videoUrl-attachment cases
    └── integration/
        └── customer-detail.test.js      # extend: asserts videoUrl present/absent per fixture

specs/007-exercise-library-migration/contracts/
├── database-schema.md                   # exercises table DDL (extends specs/006's schema doc)
├── exercise-data-api.md                 # listExercises/getExerciseVideoLinkMap/upsertExercise
└── exercise-video-linking.md            # render-time name matching & linking behavior
```

**Structure Decision**: Reuses the existing single `app/` project (server + frontend together,
per specs/001/004/006 precedent) — no new top-level project or service. Every touched file already
exists except the new migration script and the three contract docs; this keeps the feature a
targeted extension of the established program-rendering and Supabase data-access layers rather
than a parallel system.

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
