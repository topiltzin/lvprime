# Quickstart: Fitness Plan Dashboard

Validation guide for the feature once implemented. Run from the repository root
(`/home/topiltzinfl/Downloads/projects/lvprime`) unless noted.

## Prerequisites

- Node.js 20 LTS installed.
- Repository checked out with the existing `customers/` directory intact (this feature reads
  it directly — no fixture data needs to be created for a real validation pass).
- From `app/`: `npm install` (installs `vite`, `better-sqlite3`, `marked` — the only three
  runtime/dev dependencies per `research.md`).

## Setup

```bash
cd app
npm install
npm run dev
```

Expected: a local dev server starts (Vite prints a `http://localhost:5173`-style URL) with
the local API mounted on the same origin under `/api`. No database migration step is
needed — `app/data/index.sqlite` is created automatically on first run and populated by
scanning `../customers/`.

## Scenario 1 — Overview shows both existing customers (User Story 1)

1. Open the printed local URL in a browser.
2. **Expected**: within ~10 seconds of the page loading, both `jaqueline-orellano` and
   `topiltzin-flores` appear in the customer list, each with a name and status summary
   (program goal / last feedback date, or "not yet created" where a file is absent) — see
   spec SC-001 and `contracts/api.md`'s `GET /api/customers`.
3. Temporarily rename `customers/topiltzin-flores` to simulate a folder with only some files
   present (or create an empty test folder `customers/test-empty/`), reload the overview.
   **Expected**: the app still loads without error and shows the folder with missing pieces
   marked "not yet created" (spec FR-010, edge case). Revert the rename/delete the test
   folder afterward.

## Scenario 2 — Customer detail view matches the Markdown files (User Story 2)

1. From the overview, select `jaqueline-orellano`.
2. **Expected** (within two selections total from app launch, per spec SC-002):
   - The weekly schedule (Lunes–Viernes) renders with exercises, sets/reps/rest, and form
     tips matching `customers/jaqueline-orellano/program.md`.
   - The feedback section shows an empty state (that file currently has no logged
     sessions yet) rather than an error (spec acceptance scenario: empty feedback history).
   - The coach notes section renders the content of `notes.md` (profile, nutrition
     observations, progression phases, alerts) readably.
   - The `plans/semana1.pdf` attachment is listed as an openable link, not rendered inline.
3. Repeat for `topiltzin-flores` and confirm its (non-empty) feedback history renders in
   chronological order with all recorded fields visible.

## Scenario 3 — Log a new feedback entry (User Story 3)

1. From `topiltzin-flores`'s (or `jaqueline-orellano`'s) detail view, open the feedback form.
2. Submit with one required field (e.g. difficulty) left blank.
   **Expected**: the app blocks the save and indicates the missing field; `feedback.md` is
   unchanged on disk (spec FR-007 acceptance scenario 2 / API contract `422` response).
3. Fill in all required fields and submit.
   **Expected**: within under a minute end-to-end (spec SC-003) —
   - The new entry appears in the on-screen feedback history immediately, without an app
     restart (spec acceptance scenario).
   - `customers/<slug>/feedback.md` on disk now contains a new entry block matching that
     file's existing template, with the date written as `YYYY-MM-DD`.
   - `program.md` and `notes.md` for that customer are byte-for-byte unchanged (spec
     FR-009 — check with `git diff` if the repo is under version control).

## Scenario 4 — Feedback trends are visible without rereading every entry (SC-005)

1. Submit 3–4 feedback entries for the same customer through the form (Scenario 3),
   varying `completed` and `difficulty` across them.
2. **Expected**: the customer detail view shows a visual trend (completion rate,
   difficulty/energy over time) that reflects the pattern just entered, without the coach
   needing to open `feedback.md` to see it.

## Scenario 5 — External edits are picked up automatically (FR-012)

1. With the app running, manually edit `customers/topiltzin-flores/notes.md` in a text
   editor (simulating the existing Claude/`CLAUDE.md`-driven coaching workflow) and save.
2. Reload that customer's detail view in the app (no app restart).
   **Expected**: the updated notes content appears — the SQLite index's mtime check
   triggers a re-parse rather than serving stale cached content.

## Running the automated test suite

```bash
cd app
npm test
```

**Expected**: unit tests (Markdown parsing/formatting round-trips, SQLite query layer) and
integration tests (real HTTP requests against a temporary fixture `customers/` directory)
all pass. Integration tests must not touch the real `customers/` directory — they operate
against a temp-directory fixture created and torn down per test run.
