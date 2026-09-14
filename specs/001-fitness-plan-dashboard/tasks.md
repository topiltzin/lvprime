# Tasks: Fitness Plan Dashboard

**Input**: Design documents from `/specs/001-fitness-plan-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md (all present)

**Tests**: Kept to the minimum per user request — one foundational round-trip unit test for
the feedback parser/formatter (constitution Principle I: never corrupt existing content),
plus one integration test per user story validating that story's contract end-to-end. No
per-entity/per-component unit tests beyond that.

**Organization**: Tasks are grouped by user story (from spec.md, priority order P1 → P2 →
P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3) — omitted for Setup,
  Foundational, and Polish tasks
- File paths are exact and relative to the repository root

## Path Conventions

Single local web app at `app/` (frontend + minimal local Node API in one project — see
plan.md "Structure Decision"). It reads/writes the repository's existing `customers/`
directory via a relative path (`../customers` from `app/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding — no application logic yet

- [X] T001 Create the `app/` project skeleton: `app/package.json`, `app/vite.config.js`,
      `app/index.html`, and empty directories `app/src/`, `app/src/styles/`,
      `app/src/views/`, `app/src/components/`, `app/server/`, `app/tests/unit/`,
      `app/tests/integration/`, `app/data/`, per plan.md's Project Structure
- [X] T002 Initialize `app/package.json` with exactly three dependencies — `vite`,
      `better-sqlite3`, `marked` (per research.md §1–3, "minimal number of libraries") — and
      npm scripts `dev` (Vite dev server), `build` (`vite build`), `start` (serve built
      assets + API for regular use), and `test` (`node --test tests/`)
- [X] T003 [P] Add `app/data/` and `app/node_modules/` to `.gitignore` — the SQLite index at
      `app/data/index.sqlite` is a disposable, rebuildable cache (research.md §5) and must
      never be committed
- [X] T004 [P] Create `app/src/styles/main.css` with a minimal shared layout shell (page
      structure, typography, spacing) — no CSS framework, per the vanilla-CSS directive

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every user story depends on — directory scanning, indexing, and
the base server/frontend shell

**⚠️ CRITICAL**: No user story task may begin until this phase is complete

- [X] T005 Implement `app/server/db.js`: open/create `app/data/index.sqlite` and create the
      `customers`, `feedback_entries`, and `attachments` tables plus the
      `idx_feedback_customer` and `idx_attachments_customer` indexes exactly as defined in
      data-model.md's "SQLite Schema" section. **Deviation from plan.md**: uses Node's
      built-in `node:sqlite` (`DatabaseSync`) instead of `better-sqlite3` — see the
      "Implementation Note" appended to research.md §2: `better-sqlite3`'s native addon
      failed to compile against the Node version actually installed (V8 API removed in
      that version), and `node:sqlite` is stable and dependency-free here, so it's a strict
      improvement on the "minimal number of libraries" goal
- [X] T006 [P] Implement `app/server/markdown-parser.js` with `parseFeedbackEntries`,
      `extractFeedbackTemplate` (learns each customer file's own field labels/heading level
      from its embedded "Formato de Entrada"/"Session Format" example, or real entries when
      present — see research.md §4 addendum), and `formatFeedbackEntry`, plus
      `parseProgramGoal` for the Customer summary. Round-trip verified by T013
- [X] T007 [P] Implement `app/server/markdown-render.js`: `marked`-based wrapper to render
      arbitrary Markdown text to HTML
- [X] T008 Implement `app/server/customers-repo.js`: scan `../customers/` for customer
      folders; for each, compare file mtimes against the `customers` table (T005) and
      re-parse/upsert when stale, never erroring on a missing file. Exports
      `reindexIfStale(db, slug)` and `listCustomers(db)`
- [X] T009 Implement `app/server/index.js`: route table (built-in `http`/`node:url` only)
      exporting `handleApiRequest(req, res)`, with all three story routes registered
      (implemented together with T014/T023/T031 below rather than left as an empty
      skeleton, since the route table, DB layer, and parsers were built as one coherent
      pass) and a JSON 404 fallback
- [X] T010 [P] `app/vite.config.js` mounts `handleApiRequest` into the Vite dev server under
      `/api` via a `configureServer` plugin hook (research.md §6)
- [X] T011 [P] Implement `app/src/api-client.js`: `fetch()` wrapper with `getCustomers()`,
      `getCustomer(slug)`, `submitFeedback(slug, data)`
- [X] T012 [P] Implement `app/src/main.js`: hash-based router mounting overview/customer/
      feedback-form views into `app/index.html`
- [X] T013 [P] Unit tests in `app/tests/unit/markdown-parser.test.js`: round-trips a real
      entry from `customers/topiltzin-flores/feedback.md` and a synthetic Spanish-template
      entry byte-for-byte, plus confirms a malformed entry is still returned with
      `raw_matched: false` — all passing (`node --test tests/unit/`)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - See every customer's status at a glance (Priority: P1) 🎯 MVP

**Goal**: A single overview screen listing every customer under `customers/` with a status
summary, per spec.md User Story 1

**Independent Test**: Point the app at `customers/` and confirm both `jaqueline-orellano`
and `topiltzin-flores` appear with a readable summary, with no other feature implemented

- [X] T014 [US1] Implement the `GET /api/customers` route handler in `app/server/index.js`:
      call `customers-repo.js`'s `listCustomers()` (reindexing stale customers first), and
      return `{ customers: [...] }` shaped exactly as contracts/api.md's `GET /api/customers`
      response (`slug`, `displayName`, `hasProgram`, `hasNotes`, `programGoal`,
      `lastFeedbackDate`) — always `200`, including `{ "customers": [] }` when `customers/`
      is empty (depends on T008, T009)
- [X] T015 [P] [US1] Add `getCustomers()` to `app/src/api-client.js`, calling
      `GET /api/customers` (depends on T011)
- [X] T016 [P] [US1] Implement `app/src/components/customer-card.js`: render one customer's
      `displayName` and status summary — `programGoal`/`lastFeedbackDate` when present, or
      "not yet created" for whichever of `hasProgram`/`hasNotes`/feedback is `false`/absent
      (data-model.md Customer entity)
- [X] T017 [US1] Implement `app/src/views/overview-view.js`: fetch via `getCustomers()`,
      render one `customer-card.js` per customer, and handle the empty-list state (depends
      on T015, T016)
- [X] T018 [US1] Wire `overview-view.js` as the default/root route in `app/src/main.js`
      (depends on T012, T017)
- [X] T019 [P] [US1] Integration test in `app/tests/integration/customers-overview.test.js`:
      start the server (T009/T014) against a temporary fixture `customers/` directory
      containing one fully-populated customer and one folder missing all three files, and
      assert `GET /api/customers` returns `200` listing both, with the incomplete one
      showing `hasProgram`/`hasNotes` as `false` (spec FR-010 edge case)

**Checkpoint**: User Story 1 is fully functional and independently testable — this alone is
a deployable MVP

---

## Phase 4: User Story 2 - Review one customer's plan, feedback, and notes together (Priority: P2)

**Goal**: Selecting a customer shows their program, feedback history, coach notes, and
attachments together in one readable view, per spec.md User Story 2

**Independent Test**: Open `jaqueline-orellano` and confirm the weekly schedule, feedback
history (currently empty for this customer), coach notes, and `plans/semana1.pdf`
attachment all render correctly and match the underlying files; repeat for
`topiltzin-flores`'s non-empty feedback history

- [X] T020 [US2] Extend `app/server/markdown-parser.js` with `parseProgramDetail(programMdText)`
      → `{ fitnessLevel, sessionDuration, planDuration, weeklySchedule, progressionHtml }`
      where `weeklySchedule` is an ordered list of `{ day, focus, html }` (one per
      day-of-week heading, `html` rendered via `markdown-render.js`) and `progressionHtml`
      is the rendered "Progresión"/"Progression" section, per data-model.md's Program entity
      (depends on T006, T007)
- [X] T021 [P] [US2] Extend `app/server/customers-repo.js` to also scan each customer folder
      for non-standard files (anything besides `program.md`/`feedback.md`/`notes.md`) and
      upsert `{ relativePath, sizeBytes, modifiedAt }` rows into the `attachments` table —
      file bytes are never read into the index, only filesystem metadata (data-model.md
      Attachment entity; "images are not uploaded anywhere") (depends on T008)
- [X] T022 [P] [US2] Add `getFeedbackTrend(slug)` to `app/server/db.js`: compute
      `{ completionRate, points }` from that customer's indexed `feedback_entries`, mapping
      `difficulty` to a fixed `difficultyScore` (Fácil=1, Moderada=2, Difícil=3 — research.md
      §8) in each point while preserving the original `difficulty` string (depends on T005)
- [X] T023 [US2] Implement the `GET /api/customers/:slug` route handler in
      `app/server/index.js`: reindex-if-stale for that customer (T008), render `program`
      (T020) with `present: hasProgram`, `notes` via `markdown-render.js` (T007) with
      `present: hasNotes`, `feedback.entries` (T006) and `feedback.trend` (T022), and
      `attachments` (T021), matching contracts/api.md's response shape exactly; return `404`
      only when `slug` matches no folder at all — an existing folder missing files still
      returns `200` with `program.present`/`notes.present` as `false` and
      `feedback.entries: []` (depends on T020, T021, T022)
- [X] T024 [P] [US2] Add `getCustomer(slug)` to `app/src/api-client.js`, calling
      `GET /api/customers/:slug`
- [X] T025 [P] [US2] Implement `app/src/components/trend-chart.js`: render
      `completionRate` and `points` as small hand-drawn inline SVG bar/line shapes — no
      charting library, per research.md §8
- [X] T026 [P] [US2] Implement `app/src/components/feedback-entry.js`: render one entry's
      `date`/`label`/`felt`/`completed`/`difficulty`/`notes`, with a visually subtler
      treatment when `rawMatched` is `false` (data-model.md: partial entries are shown, not
      hidden)
- [X] T027 [US2] Implement `app/src/views/customer-view.js`: fetch via `getCustomer(slug)`
      and render the weekly schedule, notes HTML, feedback history (via
      `feedback-entry.js`), trend (via `trend-chart.js`), and attachment links (openable,
      not rendered inline); show "not yet created" when `program.present`/`notes.present`
      is `false` (depends on T024, T025, T026)
- [X] T028 [US2] Wire a customer-detail route (e.g. `#/customers/:slug`) in
      `app/src/main.js` and make each `customer-card.js` (US1) link to it (depends on T016,
      T018, T027)
- [X] T029 [P] [US2] Integration test in `app/tests/integration/customer-detail.test.js`:
      against a fixture customer with a populated `program.md`, several `feedback.md`
      entries, a `notes.md`, and one non-standard attachment file, assert
      `GET /api/customers/:slug` returns all four sections correctly, and a request for an
      unknown slug returns `404`

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Log a new feedback entry from the app (Priority: P3)

**Goal**: The coach logs a session via a structured form; a validated entry is appended to
that customer's `feedback.md`, per spec.md User Story 3

**Independent Test**: Submit a feedback entry for a customer through the app and confirm a
correctly formatted new entry appears in that customer's `feedback.md`, visible in the
Story 2 view without an app restart

- [X] T030 [US3] Implement `app/server/feedback-writer.js`: validate a submitted entry
      against contracts/api.md's rules — `date`, `felt`, `completed`, `difficulty`, and
      `notes` are all required and non-empty (`label` optional), `completed` must be a
      boolean, and `date` must be a valid calendar date, always normalized to `YYYY-MM-DD`
      on write regardless of input format (constitution Principle III) — returning a
      field-keyed error map and performing **no** file or DB write on failure; on success,
      format the entry with `markdown-parser.js`'s `formatFeedbackEntry()` (T006) and append
      it to `customers/:slug/feedback.md`, creating the file with a minimal header first if
      it does not yet exist (spec edge case) (depends on T006)
- [X] T031 [US3] Implement the `POST /api/customers/:slug/feedback` route handler in
      `app/server/index.js`: `404` for an unknown slug; `422` with the field-error map from
      `feedback-writer.js` on validation failure (no partial write); otherwise call
      `feedback-writer.js` (T030), then `customers-repo.js`'s `reindexIfStale` (T008) forced
      for that customer's `feedback_entries` and `customers` row from the updated file, and
      return `201` with the created entry (depends on T030, T008)
- [X] T032 [P] [US3] Add `submitFeedback(slug, data)` to `app/src/api-client.js`, calling
      `POST /api/customers/:slug/feedback` and surfacing a `422` field-error map to the
      caller distinctly from a network/server error
- [X] T033 [US3] Implement `app/src/views/feedback-form-view.js`: a form covering
      date/felt/completed/difficulty/notes (label optional), blocking submission
      client-side when a required field is empty, calling `submitFeedback()` (T032) and
      displaying any `422` field errors returned by the server (depends on T032)
- [X] T034 [US3] Wire the feedback form into `app/src/views/customer-view.js` (an action to
      open it from the customer detail view) and, on successful submit, refresh that view's
      feedback list and trend chart in place with no app restart required (depends on T027,
      T033)
- [X] T035 [P] [US3] Integration test in `app/tests/integration/feedback-submission.test.js`:
      against a fixture customer, assert `POST` with a required field missing returns `422`
      and leaves `feedback.md` byte-for-byte unchanged; assert `POST` with all fields
      returns `201`, appends a correctly formatted `YYYY-MM-DD` entry to `feedback.md`, and
      that entry is reflected in a subsequent `GET /api/customers/:slug`

**Checkpoint**: All three user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] Manually executed quickstart.md Scenarios 1–5 against the real `customers/`
      directory via the running dev server: overview lists both real customers (Scenario 1),
      jaqueline-orellano's full program/notes/attachment render correctly (Scenario 2), a
      feedback entry was submitted end-to-end for topiltzin-flores and reverted (Scenario 3),
      trend computation confirmed via the same submission (Scenario 4), and an external edit
      to `notes.md` was picked up on next request with no restart (Scenario 5). All customer
      files verified unchanged afterward (`git status --porcelain customers/` clean)
- [X] T037 Fetch-failure handling was built into `overview-view.js` and `customer-view.js`
      from the start (`try`/`catch` around the `api-client.js` call rendering an
      `.error-banner` message) rather than added as an afterthought

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational completion; can then proceed in
  parallel or in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories
- **US2 (P2)**: Independently testable via its own contract; T028 links into US1's UI
  (`customer-card.js`) for navigation, but US2's server-side behavior does not depend on US1
- **US3 (P3)**: T034 wires into US2's `customer-view.js` for the form entry point, but
  US3's server-side behavior (validate → write → reindex) does not depend on US2's read path

### Within Each User Story

- Server-side parsing/route logic before the frontend calls it
- `api-client.js` methods before the view that calls them
- Components before the view that composes them
- Story's integration test can be written alongside its route handler (verifies the
  contract, not implementation order)

### Parallel Opportunities

- T003, T004 (Setup) in parallel
- T006, T007 in parallel once T005 exists; T010, T011, T012, T013 in parallel once T005–T009
  exist
- Within US1: T015, T016 in parallel; then T019 in parallel with T017/T018 once T014 exists
- Within US2: T021, T022 in parallel with T020; T024, T025, T026 in parallel once T023 exists
- Within US3: T032 can start once T030/T031 exist; T035 in parallel with T033/T034
- Once Foundational is complete, US1/US2/US3 server-side route work (T014, T020–T023,
  T030–T031) can be staffed in parallel by different people, since each targets a distinct
  route in `app/server/index.js` and distinct new files

---

## Parallel Example: User Story 1

```bash
# After T014 (route handler) exists:
Task: "Add getCustomers() to app/src/api-client.js"
Task: "Implement app/src/components/customer-card.js"
Task: "Integration test in app/tests/integration/customers-overview.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 against the real `customers/`
   directory
5. This alone is a usable MVP — a fast overview of every customer's status

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate (quickstart Scenario 1) → usable MVP
3. Add User Story 2 → validate (quickstart Scenarios 2, 4, 5) → full read experience
4. Add User Story 3 → validate (quickstart Scenario 3) → feedback logging replaces manual
   Markdown editing
5. Polish (Phase 6) → final quickstart pass, error-state handling

## Notes

- [P] tasks touch different files and have no unfinished-task dependency among themselves
- Tests were deliberately kept minimal per user request: one Foundational round-trip test
  (T013) plus one integration test per story (T019, T029, T035) — four total
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
