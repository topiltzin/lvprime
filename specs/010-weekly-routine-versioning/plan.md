# Implementation Plan: Independent Weekly Routines with History Tracking

**Branch**: `010-weekly-routine-versioning` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-weekly-routine-versioning/spec.md`

## Summary

Today, a customer's Program tab has exactly four fixed "Week" chips that all show the same
day-by-day schedule — switching weeks only swaps a short progression-note string
(`specs/003-program-weekly-tabs-pdf`). This plan replaces that with genuinely independent
per-week routines: the `programs` table gains a `week_number` dimension (one row per
customer-week instead of one row per customer), the highest `week_number` for a customer is
always the sole editable ("current") week — every earlier week becomes read-only the moment a
newer one is created, with no separate lock flag to drift out of sync — and the week count is
open-ended rather than capped at four. The coach's existing `publish.js` CLI and Markdown-editing
workflow are preserved, extended only with a week-targeting flag. The frontend's week selector
becomes dynamic and lazily fetches each week's own content on first view (session-cached
thereafter) instead of assuming one shared, precomputed schedule.

## Technical Context

**Language/Version**: Node.js (ESM modules), `>=22.5.0` (per `app/package.json` `engines`)

**Primary Dependencies**: `@supabase/supabase-js` ^2.116.0 (Postgres client), `marked` ^13.0.3
(Markdown → HTML rendering), `jspdf` ^4.2.1 (client-side PDF export), Vite ^8.3.0 (dev
server/bundler) — no frontend framework, vanilla DOM components under `app/src/components/`

**Storage**: Supabase PostgreSQL — existing tables `customers`, `programs`, `notes`,
`nutrition_plans`, `feedbacks`, `sync_events`, `offline_queue_entries`, `exercises`
(`specs/006-customer-data-storage`, `specs/007-exercise-library-migration`); this feature alters
`programs`, `sync_events`, `offline_queue_entries` only (`data-model.md`)

**Testing**: Node's built-in test runner (`node --test tests/`, via `npm test`), integration
tests against a real (non-production) Supabase project, gated on
`SUPABASE_URL`/`SUPABASE_SECRET_KEY` env vars being set (skip with a message otherwise);
disposable, clearly-namespaced fixture customers/exercises cleaned up via `t.after()`
(established pattern in `app/tests/integration/publish-cli.test.js` et al.)

**Target Platform**: Web — local coach dashboard and customer-facing view, served by
`app/server.js` (Node) + Vite-built static frontend; no mobile/native target

**Project Type**: Web application, single co-located package (`app/` contains both
`server/` (backend) and `src/` (frontend) — not a separate `frontend/`/`backend/` split)

**Performance Goals**: Week-list fetch and per-week detail fetch each comfortably under the
existing `SC-003` target (view a past week's routine in under 10s end-to-end); in practice
sub-second for typical Markdown content sizes given no new heavy computation is introduced
(same `parseProgramDetail` parsing cost as today, just scoped to one week's content instead of a
concatenation of all weeks — actually less work per call than today's duplicate-heading bug case)

**Constraints**: Existing per-row content cap (<500KB, `specs/006` schema) now applies per week
rather than per customer's entire program history — strictly more headroom overall, not less.
Coach-always-wins conflict semantics (`resolveCoachSync`) must remain unchanged for a customer's
current week; only the new locked-week rejection is additive ahead of that existing logic.

**Scale/Scope**: Open-ended weeks per customer (FR-009, no fixed cap); validated in this plan's
`quickstart.md`/tests up to 10+ weeks per customer (`SC-005`, `SC-006`) as the practical scale
target — chosen because it's an order of magnitude past today's fixed 4, enough to prove the
"grows well past 4" edge case without requiring a synthetic multi-year fixture.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| **I. Content & Program Quality** | **PASS.** Each Weekly Routine row independently must still satisfy the full required format (`data-model.md`'s `content` field note) — this feature multiplies the number of "programs" a customer can have, it doesn't relax what any one of them must contain. Enforcement remains behavioral (coach-assistant time-of-write judgment), same as today — this feature introduces no new gap here. |
| **II. Verify-Before-Save Testing Standards** | **PASS.** Before publishing any given week's routine (current or new), the coach must still check it against the customer's goal/limitations from `notes.md`/`feedback.md`, exactly as today — unaffected by which week is being written. |
| **III. User Experience Consistency** | **PASS, with one intentional, documented reversal.** Default active week moves from a hardcoded "Week 1" to "current week" (`research.md` Decision 6) — an explicit, justified improvement (stale week 1 is no longer a useful default once history is long-lived), not an inconsistency introduced carelessly. Dates/structure/terminology conventions are otherwise unchanged. |
| **IV. Performance & Responsiveness** | **CONDITIONAL PASS — logged in Complexity Tracking below.** Switching weeks now costs a network fetch where `specs/003` guaranteed zero; justified because each week is now real, distinct content that cannot be precomputed from a single shared blob, and mitigated with session-level per-week caching so repeat switches are free (`research.md` Decision 5). This is a deliberate, scoped trade-off, not an unbounded performance regression. |

**Result**: All four principles pass; Principle IV's trade-off is documented in Complexity
Tracking per the constitution's own allowance for justified deviations.

## Project Structure

### Documentation (this feature)

```text
specs/010-weekly-routine-versioning/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   ├── database-schema-delta.md
│   ├── weekly-routine-api.md
│   ├── publish-cli.md
│   └── week-tab-navigation-v2.md        # Supersedes specs/003's week-tab-navigation.md
└── tasks.md                             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
app/
├── server/
│   ├── index.js                  # add /api/customers/:slug/program/weeks[/:week] routes;
│   │                              #   extend /api/sync/{upload,download,status} with week_number
│   ├── lib/
│   │   └── customer-data.js      # syncCoachWrite/getSyncState/getCustomerProgram gain a
│   │                              #   week_number param; new lock check ahead of resolveCoachSync
│   ├── sync-engine.js            # resolveCoachSync: unchanged signature, called only after the
│   │                              #   new locked-week check passes
│   ├── markdown-parser.js        # parseProgramDetail: unchanged logic, now always invoked
│   │                              #   against one week's own content (no code change required —
│   │                              #   the duplicate-heading failure mode this feature exists to
│   │                              #   fix goes away structurally, by construction)
│   ├── migrations/               # new migration script: programs.week_number backfill + the
│   │                              #   schema delta from contracts/database-schema-delta.md
│   └── scripts/
│       └── publish.js            # add --week/--new-week flags (contracts/publish-cli.md)
├── src/
│   └── components/
│       ├── week-subnav.js        # dynamic chip list instead of fixed WEEK_NUMBERS=[1,2,3,4];
│       │                          #   locked-indicator rendering
│       ├── tab-container.js      # renderProgramContent: fetch-on-switch + session cache
│       │                          #   (contracts/week-tab-navigation-v2.md)
│       ├── program-day.js        # unchanged (already scoped to one week's weeklySchedule at a
│       │                          #   time; no cross-week DOM-id collision risk once only one
│       │                          #   week's days ever render at once, confirmed in research)
│       └── program-pdf.js        # buildProgramWeekPdfContent takes the active week's own
│                                  #   fetched detail instead of a shared blob
└── tests/
    ├── integration/
    │   ├── weekly-routine-lifecycle.test.js   # NEW — Scenarios 1-3 from quickstart.md
    │   └── week-tab-navigation.test.js        # NEW — Scenario 4/5, if a DOM-level test harness
    │                                            #   exists for src/components; otherwise these
    │                                            #   stay manual (quickstart.md), per existing
    │                                            #   project convention of no frontend test runner
    └── unit/
        └── week-lock-rule.test.js             # NEW — pure `is_locked`/`is_current` derivation
                                                 #   (data-model.md), gap/sequential validation
```

**Structure Decision**: Existing single co-located `app/` package layout, unchanged — this
feature adds routes/columns/flags within the existing `server/`, `src/components/`, and
`tests/` directories rather than introducing new top-level projects or services.

## Complexity Tracking

> Constitution Principle IV flagged a justified deviation; recorded here per that principle's
> own instruction to log rather than silently accept or silently avoid a needed trade-off.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Week switch now costs a network request (`specs/003` guaranteed zero) | Each week now holds genuinely independent content (the feature's core requirement, FR-001/FR-002) — there is no longer one shared, precomputable blob to switch between client-side | Prefetching all weeks' full content up front was considered (`research.md` Decision 5) and rejected: doesn't scale as history grows unbounded (FR-009), and wastes bandwidth on weeks a session never views |

## Post-Design Constitution Re-Check

Phase 1 design (`data-model.md`, `contracts/*`) introduced no new principle concerns beyond the
one already logged above:
- The locked-write check is a pure, stateless comparison (`week_number` vs. `MAX(week_number)`)
  added ahead of existing sync logic — no new async dependency, no meaningful latency added to
  the write path (Principle IV, write side — unaffected).
- No new customer-facing data left the `customers/[slug]/`-mirrored-in-Supabase model; `programs`
  still holds exactly the same kind of content it always did, just more rows of it (Principle I,
  Customer Data Standards — unaffected).

**Result**: Constitution Check still passes post-design; no additional Complexity Tracking
entries required.
