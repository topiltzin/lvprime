# Implementation Plan: Program Day "Mark done" Quick-Complete

**Branch**: `012-program-day-mark-done` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md) | **Design**: [design.md](./design.md)

**Input**: Feature specification from `/specs/012-program-day-mark-done/spec.md`

## Summary

Add a "Mark done" footer to each training-day card in the current program week. One click calls a new `quick-complete` endpoint. The endpoint writes a completed session entry (date = today, label = "<Day> - <Focus>") into the customer's `feedback.md` blob, with every other template field set to a "Not reported" sentinel that the parser treats as absent. The card switches to a done chip with an "Add details" action, which opens Log Session prefilled. The Log Session POST becomes an upsert on (date, label), so details enrich the quick entry instead of duplicating it. The done state is derived on the client from existing feedback entries (7-day window).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js >= 22.5

**Primary Dependencies**: Vite 8 (dev server + build), `@supabase/supabase-js`, `@phosphor-icons/core`, `marked`, `dompurify`. No new dependencies.

**Storage**: Supabase Postgres, `feedbacks.content` (one Markdown blob per customer). No schema change.

**Testing**: `node --test` (`app/tests/unit`, `app/tests/integration`; Supabase-backed tests skip without credentials)

**Target Platform**: Modern desktop and mobile browsers; Node HTTP server (`server.js`) or the Vite middleware / Vercel function (`api/index.js`)

**Project Type**: Web app (vanilla JS SPA + Node API in `app/`)

**Performance Goals**: Mark done shows the done state within 1 round trip (under 3s end to end, SC-001); no full tab rebuild.

**Constraints**: Coach-only auth; `feedback.md` format fidelity; WCAG AA in both themes; honour reduced motion; no new colors or fonts.

**Scale/Scope**: 10-50 customers, 3-6 training days per week, feedback logs of tens to hundreds of entries.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Content & Program Quality | Quick entries use the customer's own template heading level and every field line, so the `feedback.md` format stays unchanged. | PASS |
| II. Verify-Before-Save (NON-NEGOTIABLE) | Quick-complete validates date and label before any write. All required fields are present (sentinel, not blank). The upsert only rewrites the matched block. Unit and integration tests cover it. | PASS |
| III. UX Consistency | Dates are `YYYY-MM-DD`. The label format matches the existing "Lunes - Piernas A" convention. The UI reuses existing tokens and components. "Not reported" is one consistent sentinel per language. | PASS |
| IV. Performance & Responsiveness | One request per click. In-place card update plus a single-panel re-render; no full-page reload. | PASS |
| Customer Data Standards | No new data locations; completion only, nothing personal. | PASS |

**Post-design re-check (after Phase 1)**: still PASS. The upsert changes Log Session from append-only to replace-on-same-(date, label). This is intended (FR-009) and documented in `contracts/feedback-api.md`. It does not remove history for different sessions.

## Project Structure

### Documentation (this feature)

```text
specs/012-program-day-mark-done/
├── spec.md
├── design.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── feedback-api.md
│   └── program-day-footer-ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code

```text
app/
├── server/
│   ├── markdown-parser.js          # + NOT_REPORTED sentinel in isPlaceholder, notReportedValue(),
│   │                               #   completedYesValue(), upsertFeedbackEntryText(), setEntryCompleted()
│   ├── feedback-writer.js          # + validateQuickCompleteSubmission()
│   ├── lib/customer-data.js        # addFeedbackEntry → upsert (returns { entry, created });
│   │                               #   + quickCompleteFeedbackEntry()
│   └── index.js                    # + POST /feedback/quick-complete route; POST /feedback 200 vs 201
├── src/
│   ├── api-client.js               # + quickCompleteSession(slug, { date, label })
│   ├── lib/day-completion.js       # NEW: sessionLabel(), todayIso(), findDoneEntry()
│   ├── components/program-day.js   # + footer states (idle/saving/done/error)
│   ├── components/tab-container.js # pass options to renderProgramDay; openLogSession(), rerenderPanel(),
│   │                               #   setFeedbackEntries()
│   ├── views/feedback-form-view.js # + wrap.prefill({ date, label })
│   ├── views/customer-view.js      # + onSessionLogged (refresh Feedback panel + sidebar, stay on Program)
│   └── styles/main.css             # + .program-day-footer, .day-done-button, .day-add-details,
│                                   #   .program-day-card--done, @keyframes chip-pop
└── tests/
    ├── unit/markdown-parser.test.js   # extend
    ├── unit/day-completion.test.js    # NEW
    └── integration/quick-complete.test.js  # NEW (Supabase-gated like customer-data.test.js)
```

**Structure Decision**: Everything stays in the existing single `app/` web project: server modules under `app/server`, SPA under `app/src`, tests under `app/tests`. No new packages or directories besides one lib file and two test files.

## Implementation Order (for /speckit-tasks)

1. **Parser + pure functions** (R1, R3, R4): sentinel, `upsertFeedbackEntryText`, `setEntryCompleted`, and their unit tests. This is the foundation for everything else.
2. **Server** (R2-R4): upsert in `addFeedbackEntry`, `quickCompleteFeedbackEntry`, the route, and integration tests. This delivers US1/US3 data behaviour.
3. **Client helper** (R5): `day-completion.js` and its unit tests.
4. **US1 UI**: footer states in `program-day.js`, the TabContainer wiring, `onSessionLogged`, and CSS.
5. **US2**: pass `doneEntry` into cards on every week render (including past weeks, read-only).
6. **US3**: `prefill`, `openLogSession`, and the Add details handler.
7. **Quickstart manual pass** in both themes, at phone width, and with reduced motion.

## Risks

- **Concurrent writes**: read-modify-write of the whole blob can lose an update if two saves race. This existing risk is unchanged. The in-flight guard on the button prevents self-races.
- **Legacy duplicate entries**: writes target the last match only. Older duplicates stay as they are (documented in data-model.md).
- **Label drift**: if the coach edits the program focus text, earlier quick entries no longer match, and the day shows Mark done again. This is acceptable because the 7-day window limits the impact.

## Complexity Tracking

No constitution violations; nothing to justify.
