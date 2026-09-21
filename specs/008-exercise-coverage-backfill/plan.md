# Implementation Plan: Exercise Library Coverage Backfill

**Branch**: `008-exercise-coverage-backfill` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-exercise-coverage-backfill/spec.md`

## Summary

Close the gap between the exercise library (specs/007-exercise-library-migration's `exercises`
table, 39 rows today) and what customers' real programs actually reference (60 distinct exercise
names, 54 with no library match). Two pieces: a reusable, repeatable **coverage-check** script that
diffs every program's extracted exercise names against the library (User Story 2 — this doesn't go
stale the next time a program introduces a new exercise), and a **backfill** of the 54 currently-
missing names, each researched for a real demonstration video and added via the existing
`upsertExercise()` (specs/007 contracts/exercise-data-api.md — unchanged). No schema change, no
frontend change: the video-linking render path already works for any name present in the table
(specs/007 contracts/exercise-video-linking.md) — this feature is purely about making more names
present.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js >=22.5.0 — unchanged from specs/007

**Primary Dependencies**: `@supabase/supabase-js` (existing) — no new runtime dependency. Sourcing
real video links for the 54 missing exercises is a one-time research/curation step performed during
implementation (the same way the original 39 links were sourced), not an automated video-search
integration added to the app.

**Storage**: The existing Supabase `exercises` table (specs/007-exercise-library-migration/
contracts/database-schema.md) — unchanged schema, ~54 additional rows.

**Testing**: Node built-in test runner (`node --test`), same convention as specs/007 — unit tests
for the pure name-diffing logic, integration tests against real Supabase using disposable fixture
data only (see Constraints — a real production row was accidentally corrupted by an unsafe test
during specs/007's implementation; this plan is explicit about avoiding that class of mistake again).

**Target Platform**: Linux server (Node script), no browser-facing change — the render path
(`program-day.js`, `index.js`) is already correct for any exercise name present in the table.

**Project Type**: Web application — same single `app/` project, no new service.

**Performance Goals**: Not a hot path. The coverage check scans all customers' programs (currently
3 customers, ~60 exercise names) — this is a manually-triggered report, not part of any page load,
so there's no latency budget to protect (unlike specs/006 SC-004's <500ms customer-profile-load
target, which this feature never touches).

**Constraints**:
- MUST NOT modify or duplicate any exercise name already in the library (spec FR-006) — the check
  and backfill are additive only.
- MUST NOT modify any customer's program content (spec FR-007) — read-only against `programs`.
- Name comparison MUST be case-insensitive exact match only, reusing specs/007 FR-007's rule — no
  fuzzy/semantic matching to merge near-duplicates (spec Edge Cases).
- A combined/compound exercise-name line MUST be added as one atomic name, never split (spec
  FR-008).
- **Test safety**: any test that calls `upsertExercise()` MUST use a disposable, clearly-namespaced
  fixture name with cleanup (`t.after`) — never a real exercise name from the library or from any
  customer's program. specs/007's implementation had exactly this bug (a unit test upserted the
  real "Deadlift" row with no cleanup and wiped its video link) — this plan calls it out explicitly
  so it isn't repeated.

**Scale/Scope**: 3 customers today (2 with authored program content), 60 distinct exercise names in
current use, 39 already in the library, 54 to add — the concrete numbers behind spec SC-001,
gathered by querying live data before writing the spec.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Content & Program Quality** — PASS. Doesn't touch `program.md`/`feedback.md`/`notes.md`
  formats or the fitness-coach skill. The one content-quality concern that applies — video links
  must be real and accurate — is spec FR-004/SC-004, carried over verbatim from specs/007's own
  standard.
- **II. Verify-Before-Save Testing Standards** — PASS / N/A, same reasoning as specs/007's
  Constitution Check: this principle governs coaching-content writes (program/feedback/notes); this
  feature only adds reference-library rows and never writes customer content.
- **III. User Experience Consistency** — PASS. No new rendering behavior — every newly added
  exercise renders through the exact same link/no-link logic specs/007 already shipped and tested.
- **IV. Performance & Responsiveness** — PASS. No hot-path change; see Performance Goals.
- **Customer Data Standards** — N/A, same as specs/007: the exercise library isn't customer data.
- **Development Workflow & Quality Gates** — N/A: governs per-customer coaching sessions, not
  library-content maintenance.

No violations requiring justification — Complexity Tracking table intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/008-exercise-coverage-backfill/
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
│   ├── scripts/
│   │   ├── publish.js                          # existing — pattern reference (CLI script, not
│   │   │                                        #   a one-time migration)
│   │   ├── check-exercise-coverage.js           # NEW: read-only, repeatable (US2) — lists every
│   │   │                                        #   exercise name referenced in any customer's
│   │   │                                        #   program with no library match
│   │   ├── backfill-missing-exercises.js        # NEW: reads missing-exercises-data.js, upserts
│   │   │                                        #   each via customer-data.js's upsertExercise()
│   │   └── missing-exercises-data.js            # NEW: curated {name, category, videoUrl}[] for
│   │                                             #   the 54 exercises identified as missing —
│   │                                             #   researched during implementation, not
│   │                                             #   generated at runtime
│   └── lib/
│       └── customer-data.js                     # unchanged — upsertExercise/listExercises/
│                                                 #   getExerciseVideoLinkMap already exist
└── tests/
    ├── unit/
    │   └── exercise-coverage.test.js            # NEW: pure name-diffing logic (no Supabase)
    └── integration/
        └── exercise-coverage.test.js            # NEW: coverage check against real Supabase data,
                                                   #   read-only

specs/008-exercise-coverage-backfill/contracts/
├── coverage-check.md                # check-exercise-coverage.js's behavior contract (US2)
└── exercise-backfill-data.md        # shape/validation of missing-exercises-data.js entries (US1)
```

**Structure Decision**: Extends the existing single `app/` project with two small CLI scripts
alongside `publish.js` (not `migrations/`, since — unlike `migrate-data.js`/`migrate-exercises.js`
— the coverage check is meant to be re-run repeatedly, per spec User Story 2, not a one-time
migration). No changes to `app/src/` or `app/server/index.js`: the render path specs/007 already
built is correct as-is for any exercise name that has a library row.

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
