# Implementation Plan: Fitness Plan Dashboard

**Branch**: `001-fitness-plan-dashboard` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-fitness-plan-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A local, coach-only dashboard that gives a single view over every customer under
`customers/`: an overview list, a per-customer plan/feedback/notes view with visual
feedback trends, and a form to log new session feedback. The frontend is a Vite-bundled,
vanilla HTML/CSS/JS single-page app. A minimal local Node backend reads the existing
`program.md` / `feedback.md` / `notes.md` files (which remain the sole source of truth,
per constitution Principle I and spec FR-009) and appends new feedback entries to
`feedback.md` in-place. A local SQLite database is used purely as a rebuildable index/cache
— derived from the markdown files and attachment metadata (e.g. `plans/*.pdf` paths, not
the files themselves) — to make the cross-customer overview and feedback-trend views fast
without re-parsing every file on every request, and to satisfy the user's request to track
customer/session metadata in a database rather than the app re-reading disk on every call.

## Technical Context

**Language/Version**: JavaScript (ES2022+) on Node.js 20 LTS; no TypeScript (keeps the
toolchain minimal per the "vanilla JS as much as possible" directive).

**Primary Dependencies**: `vite` (dev server + build, user-specified) and `marked` (small,
dependency-free Markdown→HTML renderer — needed to display the existing free-form Markdown
in `program.md`/`notes.md`, such as tables and nested lists, without hand-rolling a Markdown
parser). SQLite access uses Node's built-in `node:sqlite` (`DatabaseSync`) — **updated during
implementation**: `better-sqlite3` was the original choice (see research.md §2) but its
native addon failed to compile against the Node version actually installed; `node:sqlite`
proved stable there and is dependency-free, so it replaced `better-sqlite3` outright (see
research.md §2's "Implementation note"). No frontend framework, no CSS framework, no ORM:
HTML/CSS/JS are hand-written, and SQL is written directly against `node:sqlite`. This is 2
runtime dependencies total, an improvement on the "minimal number of libraries" instruction.

**Storage**: Local filesystem Markdown files under `customers/*/` remain the source of truth
for program content (`program.md`) and coach notes (`notes.md`); the app never writes to
these two files (constitution Principle I, spec FR-009). `feedback.md` is the source of
truth for feedback history — the app appends new entries to it directly, preserving the
file's existing entry format (spec FR-008). A local SQLite database (`app/data/index.sqlite`,
git-ignored) holds a **derived, rebuildable index**: one row per customer (name, folder
slug, cached program goal, last-feedback date) and one row per feedback entry (parsed
fields, for fast trend queries), plus one row per non-standard attachment found in a
customer folder (path, size, modified time — never the file's bytes, satisfying "images are
not uploaded anywhere"). The index is kept in sync via file-modification-time checks: any
time a customer's files are newer than what's indexed, the affected rows are re-parsed and
upserted before that customer's data is served. The index can be deleted and rebuilt at any
time by rescanning `customers/`, so it never becomes a second, divergent source of truth.

**Testing**: Node's built-in test runner (`node:test` + `node:assert`) — zero additional
dependency, consistent with the minimal-libraries directive. Unit tests cover the
Markdown parsing/formatting logic (feedback entry parse + format round-trip, program.md
section extraction) and the SQLite indexing/query layer. Integration tests start the local
API server against a temporary fixture `customers/` directory and exercise the real HTTP
endpoints end-to-end.

**Target Platform**: Coach's own machine (macOS/Linux/Windows), run locally via `npm run
dev` (Vite dev server + local API) during development and a simple `npm run build && npm
start` for day-to-day use. Single browser tab, single user — no remote hosting, no network
exposure (constitution "Local-only" scope decision, spec FR-011).

**Project Type**: Local web application (Vite frontend + a minimal local Node API/backend
sharing one process in dev via Vite middleware). Not a distributed web service — there is no
multi-user server-side concern.

**Performance Goals**: Overview screen renders all customers in well under the 10-second
budget from spec SC-001 (in practice: near-instant, since the SQLite index turns this into a
single indexed query rather than parsing every customer's files on every load). Customer
detail view and feedback-trend rendering load in under 1 second for the current and
foreseeable data volume.

**Constraints**: Must work fully offline (no network calls at runtime). Must never write to
`program.md` or `notes.md` (spec FR-009). Must degrade gracefully — never error — when a
customer folder is missing one or more of the three standard files (spec FR-010). Must not
introduce customer-facing accounts/auth (constitution "coach only" scope).

**Scale/Scope**: 2 customers today (`jaqueline-orellano`, `topiltzin-flores`), expected to
grow to a few dozen for a solo coach; each customer has a handful of feedback entries per
week. This is a small-scale personal tool, not a high-concurrency system — the SQLite index
is a responsiveness/simplicity choice (and a direct user requirement), not a necessity for
raw scale.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.0.0:

- **I. Content & Program Quality** — PASS. The app never writes `program.md`/`notes.md`
  (FR-009); it only appends to `feedback.md`, and Phase 1's data model fixes the exact entry
  format so appended entries stay byte-for-byte consistent with the existing template in
  `CLAUDE.md`.
- **II. Verify-Before-Save Testing Standards (NON-NEGOTIABLE)** — PASS, with a design
  obligation carried into Phase 1: the feedback-submission contract MUST validate all
  required fields (date, felt, completed, notes, overall impression) before any write, per
  spec FR-007's acceptance scenario, and MUST reject the write instead of saving a partial
  entry.
- **III. User Experience Consistency** — PASS, with a noted pre-existing gap: `CLAUDE.md`
  mandates `YYYY-MM-DD` dates, but existing customer files use free-form date placeholders.
  The app MUST always write new feedback entries with `YYYY-MM-DD` dates going forward
  (bringing new data into compliance) while still being able to *display* older or
  differently-formatted entries without erroring (spec edge case). This is a data-quality
  improvement the app enforces, not a violation.
- **IV. Performance & Responsiveness** — PASS. The SQLite index exists specifically to keep
  session turnaround fast and files lean-to-query, which is this principle's stated intent.
- **Customer Data Standards** — PASS, with a documented interpretation: this section
  requires customer *records* to live under `customers/[customer-name]/` and forbids storing
  data outside that structure. The SQLite index is not a second copy of customer records; it
  is a derived, disposable cache (rebuildable at any time by rescanning `customers/`) that
  stores no fact not already present in the customer's own Markdown files or filesystem
  metadata. See Complexity Tracking below for the explicit justification of keeping this
  index file outside any single customer folder.
- **Development Workflow & Quality Gates** — PASS. The app does not participate in the
  coach's plan-writing/insight workflow (still Claude/CLAUDE.md-driven); it only adds a
  faster way to log feedback and see the results of that existing workflow.

### Post-Design Re-Check (after Phase 1)

Re-evaluated against `data-model.md` and `contracts/api.md`:

- **I**: Confirmed — the API contract exposes no write path for `program.md`/`notes.md`
  (only `GET`s), and `POST /api/customers/:slug/feedback`'s documented side effects touch
  only `feedback.md` plus the SQLite index.
- **II**: Confirmed — `contracts/api.md`'s validation block requires all five fields before
  any write and specifies the `422`/no-partial-write behavior; `data-model.md`'s Feedback
  Entry validation rules restate the same gate at the data layer.
- **III**: Confirmed — `data-model.md` fixes new-entry dates to `YYYY-MM-DD` while leaving
  historical/malformed entries displayable as-is (`rawMatched` flag), matching the decision
  in `research.md` §9.
- **IV**: Confirmed — the SQLite schema (`data-model.md`) and mtime-based reindex strategy
  (`research.md` §5) are what make the overview/trend queries fast without per-request
  file parsing.
- **Customer Data Standards**: Confirmed — the schema stores no field that isn't already
  derivable from a customer's own Markdown files or filesystem metadata; nothing new is
  introduced at the design stage beyond what Complexity Tracking already justified.

No new violations were introduced during Phase 1 design; the Complexity Tracking entry above
remains the only documented deviation.

## Project Structure

### Documentation (this feature)

```text
specs/001-fitness-plan-dashboard/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

The application lives in a new top-level `app/` directory, kept separate from
`customers/` (customer data), `.agents/` / `.claude/` (skills), and `.specify/` (Spec Kit
artifacts). It reads `customers/` via a relative path (`../customers` from `app/`) and never
writes outside `feedback.md` files and its own `app/data/index.sqlite` cache.

```text
app/
├── package.json
├── vite.config.js                 # Vite dev/build config; proxies /api to the local server
├── index.html                     # Single-page app shell
├── src/                           # Vanilla JS/CSS frontend (bundled by Vite)
│   ├── main.js                    # App entry: router + initial render
│   ├── styles/
│   │   └── main.css
│   ├── api-client.js              # fetch() wrapper for the local /api endpoints
│   ├── views/
│   │   ├── overview-view.js       # User Story 1: customer list/status
│   │   ├── customer-view.js       # User Story 2: plan + feedback history + notes
│   │   └── feedback-form-view.js  # User Story 3: log a new feedback entry
│   └── components/
│       ├── customer-card.js
│       ├── trend-chart.js         # Visual feedback trends (FR-006)
│       └── feedback-entry.js
├── server/                        # Minimal local Node API (no framework)
│   ├── index.js                   # HTTP server + route table; mounted into Vite in dev
│   ├── db.js                      # better-sqlite3 connection, schema, indexed queries
│   ├── customers-repo.js          # Scans customers/, tracks file mtimes, triggers reindex
│   ├── markdown-parser.js         # Parses program.md / feedback.md / notes.md structure
│   ├── feedback-writer.js         # Validates + appends a new feedback.md entry (Principle II)
│   └── markdown-render.js         # `marked`-based renderer for program.md / notes.md display
└── tests/
    ├── unit/                      # node:test — parsers, formatters, db queries
    └── integration/               # node:test — real HTTP endpoints against fixture customers
```

**Structure Decision**: Single `app/` project containing both the Vite-built frontend
(`src/`) and the minimal local Node API (`server/`) it talks to — there is no separate
deployable backend, so the "web application" split is collapsed into one project rather than
sibling `frontend/`/`backend/` directories. `app/data/index.sqlite` is git-ignored (it is a
disposable cache); `customers/` at the repository root is read (and, for `feedback.md` only,
appended to) but never becomes part of the `app/` tree.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| SQLite index file (`app/data/index.sqlite`) lives outside any single `customers/[name]/` folder, in tension with the Customer Data Standards section's "customer records live under `customers/[customer-name]/`" | User explicitly directed that session/customer metadata be tracked in a local SQLite database rather than re-parsed from disk on every request, and it backs the cross-customer overview (FR-001/002) and feedback-trend view (FR-006), which by nature span multiple customer folders and can't live inside any single one | Storing a separate `.sqlite` file inside every `customers/[name]/` folder was rejected: it would fragment a single cross-customer index into N files, complicate the "rescan to rebuild" story, and gain nothing — the index still stores no fact absent from the Markdown files, so the *location* of the cache, not its existence, is the only deviation, and it is fully disposable/rebuildable |
