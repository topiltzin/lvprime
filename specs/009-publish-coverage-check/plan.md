# Implementation Plan: Publish-Time Exercise Coverage Check

**Branch**: `009-publish-coverage-check` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-publish-coverage-check/spec.md`

## Summary

Wire specs/008-exercise-coverage-backfill's coverage check into the one place new workout content
actually enters the system: `app/server/scripts/publish.js`. After a successful `program` publish,
the coach sees, in that same command's output, whether the just-published content (or anything else
in the system) has an exercise with no video link — reusing the exact check/report logic from 008,
never blocking or failing the publish. Validated by actually running `publish.js` against a real,
disposable test customer whose program references a novel exercise name, then closing the gap and
confirming it renders — the literal "if no, add the link... tested with a new customer" from the
request.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js >=22.5.0 — unchanged.

**Primary Dependencies**: None new. Reuses `check-exercise-coverage.js` (specs/008),
`customer-data.js` (specs/007), and extends the existing `publish.js` (pre-dates spec numbering,
first documented in specs/004-server-data-sync's sync path).

**Storage**: No schema change — same `exercises`/`customers`/`programs` tables.

**Testing**: Node built-in test runner. One genuinely new testing shape for this project: an
integration test that spawns `publish.js` as a real child process (`node --env-file=.env.local
server/scripts/publish.js <slug> program`) and asserts on its stdout — necessary because this
feature's actual deliverable (spec FR-003) is specifically about what the CLI prints, which nothing
short of actually running it can verify. Every prior script in this codebase (`migrate-data.js`,
`migrate-exercises.js`, `check-exercise-coverage.js`, `backfill-missing-exercises.js`) was instead
tested by importing its exported core logic directly — that pattern still applies here for the
coverage-check/report logic itself; only the "does `publish.js`'s own output actually include it"
question needs a real process spawn.

**Target Platform**: Linux server (Node CLI script) — no browser-facing change.

**Project Type**: Web application — same single `app/` project.

**Performance Goals**: Not a hot path — `publish.js` is a manually-run coach tool, not a page load.
Adding one coverage check (already proven at ~2s against live data in specs/008) to a manual CLI
action has no user-facing latency budget to protect.

**Constraints**:
- The coverage check MUST NOT throw out of `publish.js`'s `main()` in a way that turns a successful
  publish into a failed one (spec FR-004) — wrapped in its own `try/catch`, logged as a warning on
  failure, never rethrown.
- Only `program` publishes trigger the check (spec FR-005) — `notes`/`nutrition_plan` publishes are
  unaffected, zero behavior change for them.
- Reuses specs/008's exact matching/reporting logic (spec FR-002) — `check-exercise-coverage.js` is
  refactored to export its report-building and formatting as reusable functions rather than having
  `publish.js` reimplement or copy them.
- **Test safety** (carried forward from specs/007's incident and specs/008's research.md §4): the
  end-to-end validation test uses a disposable, clearly-namespaced fixture customer and cleans up
  both its local `customers/<fixture-slug>/` directory and its Supabase rows — never a real
  customer, never left behind.

**Scale/Scope**: Same 2-4 customers as specs/008 — this feature adds no new data, only a new place
the existing check's output is surfaced.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Content & Program Quality** — PASS. Doesn't touch `program.md`/`feedback.md`/`notes.md`
  formats or the fitness-coach skill. Reuses the same real-verified-video-link standard as specs/
  007/008 (spec FR-006).
- **II. Verify-Before-Save Testing Standards** — PASS / N/A, same reasoning as specs/007 and 008:
  this doesn't write coaching content (program/feedback/notes) — `publish.js` already writes
  program content via `syncCoachWrite`, unchanged by this feature; the new piece only reads and
  reports.
- **III. User Experience Consistency** — PASS. The report format is the literal same function as
  specs/008's own check output — by construction, not by convention, there's no way for it to drift
  into a different look.
- **IV. Performance & Responsiveness** — PASS. No hot path touched; see Performance Goals.
- **Customer Data Standards** — N/A, same as specs/007/008: the exercise library isn't customer
  data, and this feature doesn't add any new customer-data storage location.
- **Development Workflow & Quality Gates** — N/A: governs per-customer coaching-content workflow
  (feedback → notes → program), not publish tooling.

No violations requiring justification — Complexity Tracking table intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/009-publish-coverage-check/
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
│   └── scripts/
│       ├── check-exercise-coverage.js   # specs/008, refactored: export checkCoverage() (the
│       │                                #   scan+diff, currently inline in main()) and
│       │                                #   formatCoverageReport() (the console text, currently
│       │                                #   inline in main()) so both this script's own main()
│       │                                #   and publish.js can call the identical logic (spec
│       │                                #   FR-002)
│       └── publish.js                   # extended: export reportProgramCoverage() (calls
│                                         #   checkCoverage()+formatCoverageReport(), try/catch
│                                         #   swallows any failure — spec FR-004); main() calls it
│                                         #   after a successful program publish (spec FR-001,
│                                         #   FR-005); main() call at file scope gets the same
│                                         #   "only run when executed directly" guard already used
│                                         #   in migrate-exercises.js/check-exercise-coverage.js/
│                                         #   backfill-missing-exercises.js, since this file now
│                                         #   exports a function a test will import
└── tests/
    ├── unit/
    │   └── exercise-coverage.test.js    # extended: formatCoverageReport() pure-formatting cases
    └── integration/
        ├── publish-coverage.test.js     # NEW: reportProgramCoverage() imported directly — happy
        │                                #   path against live data
        └── publish-cli.test.js          # NEW: spawns publish.js as a real child process against
                                          #   a disposable fixture customer — the FR-008/US2
                                          #   Scenario 2 end-to-end proof
```

**Structure Decision**: No new top-level structure — extends the two existing scripts from specs/
008 and this project's pre-existing `publish.js`. No frontend change, no schema change.

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
