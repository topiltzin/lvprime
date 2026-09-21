# Phase 0: Research — Publish-Time Exercise Coverage Check

**Date**: 2026-09-21
**Status**: Complete — no NEEDS CLARIFICATION markers.

---

## 1. Which script is "the migration for a new customer's workout"

**Decision**: `app/server/scripts/publish.js`.

**Rationale**: Read directly rather than assumed. Its own header states: "If the customer doesn't
exist in Supabase yet, creates it first (upsertCustomer) instead of failing — covers new customers,
not just updates to existing ones." This is the actual code path a coach runs to get a brand-new
customer's `program.md` into the system. `migrate-data.js`/`migrate-exercises.js` (specs/006/007)
are one-time bulk migrations that already ran against pre-existing data — they have no role in
onboarding a customer going forward.

**Alternatives considered**: None seriously — this was a factual question about the existing
codebase, resolved by reading it rather than guessing (per the project-wide instruction against
guessing at things that can be verified).

---

## 2. Reuse vs. reimplement the coverage check

**Decision**: Refactor `check-exercise-coverage.js` (specs/008) to export `checkCoverage()` (data)
and `formatCoverageReport()` (text) as standalone functions; `publish.js` imports and calls both.

**Rationale**: Spec FR-002 requires the exact same matching/reporting behavior — literally sharing
the functions is the only way to guarantee that by construction rather than by two implementations
happening to agree today and drifting apart tomorrow. `check-exercise-coverage.js`'s own `main()`
already computes this data purely to `console.log` it; pulling that into named, exported functions
is a pure refactor with no behavior change for that script's existing CLI use.

**Alternatives considered**:
- *Have `publish.js` shell out to `check-exercise-coverage.js` as a subprocess* — rejected: more
  complex (parsing subprocess stdout back into structured data for no benefit), and slower than an
  in-process function call for something already running inside the same Node process.
- *Duplicate a smaller, publish.js-specific version of the check* — rejected: directly violates
  spec FR-002, and is exactly the kind of drift risk the "single source of truth" design in specs/
  007/008 was built to avoid.

---

## 3. Never blocking the publish

**Decision**: `reportProgramCoverage()` (new, in `publish.js`) wraps `checkCoverage()` +
`formatCoverageReport()` in its own `try/catch`; a failure is `console.warn`'d, never rethrown, so
`main()`'s existing `syncCoachWrite` success/failure path is completely unaffected by it.

**Rationale**: Spec FR-004 is explicit and this project already hit a real, live example of why it
matters — during specs/008's implementation, a transient Supabase 502 (Cloudflare edge failure, not
a real data problem) briefly broke a coverage-check run. If that kind of transient failure ran
*before* or *inline with* the publish's own write, it could turn a perfectly good publish into a
reported failure for a completely unrelated reason. Running it strictly after, in its own
try/catch, means the worst case is "the report didn't print this time," never "the publish failed."

**Alternatives considered**:
- *Let a coverage-check failure also fail the publish* — rejected outright by spec FR-004, and
  concretely risky given the observed transient-failure precedent above.

---

## 4. Testing a CLI script's actual printed output

**Decision**: One new integration test (`tests/integration/publish-cli.test.js`) spawns `publish.js`
as a real child process via Node's `child_process`, against a disposable fixture customer, and
asserts on its captured stdout.

**Rationale**: Every prior script in this codebase was tested by importing its exported core logic
directly (`parseExerciseMd`, `backfillExercises`, `diffMissingExercises`, etc.) — never by running
the CLI itself. That was sufficient because the "product" of those scripts was their side effect
(rows in a table) or a pure return value, not their console output. Here, the actual deliverable
(spec FR-001/FR-003: "reported ... as part of the publish action's own output") *is* the printed
output of a real CLI invocation — importing `reportProgramCoverage()` directly (still done, for the
happy-path unit-adjacent coverage) proves the function works, but doesn't prove `main()` actually
calls it, in the right place, with the right conditions (only for `program`, only after success).
Only running the real script proves that.

**Alternatives considered**:
- *Only test the imported `reportProgramCoverage()` function* — rejected as insufficient on its
  own: it would leave the actual wiring inside `main()` — the entire point of this feature —
  completely unverified by any automated test.
- *Refactor `publish.js`'s `main()` into a fully unit-testable function taking injected
  dependencies* — rejected as disproportionate: a much larger refactor of pre-existing, working CLI
  glue, for a feature whose scope is "add one call after success," not "make publish.js unit
  testable in general."
