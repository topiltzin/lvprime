# Quickstart: Independent Weekly Routines with History Tracking

Manual validation scenarios proving this feature end-to-end. Run from `app/` with
`.env.local` pointing at a Supabase project (see `app/.env.example`); use a disposable test
customer slug, never a real one (matches existing test conventions in
`app/tests/integration/*.test.js`).

## Prerequisites

```bash
cd app
npm install
npm run dev        # frontend, separate terminal
npm start           # backend server, separate terminal
```

## Scenario 1 — Independent per-week routines (User Story 1)

1. Create a fresh test customer's first week:
   ```bash
   echo "# Test Customer — Week 1..." > customers/quickstart-010-test/program.md
   node --env-file=.env.local server/scripts/publish.js quickstart-010-test program
   ```
   → `contracts/publish-cli.md`: creates week 1 (customer didn't exist yet).
2. Confirm via `GET /api/customers/quickstart-010-test/program/weeks` → one entry,
   `weekNumber: 1`, `isCurrent: true`, `isLocked: false`.
3. Write an entirely different routine (different days/exercises) into `program.md`, then:
   ```bash
   node --env-file=.env.local server/scripts/publish.js quickstart-010-test program --new-week
   ```
4. `GET .../program/weeks` → two entries; week 1 `isLocked: true`, week 2 `isCurrent: true`.
5. `GET .../program/weeks/1` → still returns the original week 1 content, unchanged.
6. `GET .../program/weeks/2` → returns the new, distinctly different content.

**Expected outcome**: weeks 1 and 2 are fully independent; neither's content leaked into the
other (`contracts/weekly-routine-api.md` Acceptance Criteria).

## Scenario 2 — Updating the current week without touching history (User Story 2)

1. With week 2 current (from Scenario 1), edit `program.md` (e.g. swap one exercise), then:
   ```bash
   node --env-file=.env.local server/scripts/publish.js quickstart-010-test program
   ```
   (no flag — targets current week 2, per `contracts/publish-cli.md`)
2. `GET .../program/weeks/2` → reflects the edit, `version` incremented.
3. `GET .../program/weeks/1` → still exactly the original week 1 content, `version` unchanged.

**Expected outcome**: editing the current week never touches past weeks' stored content or
version counters.

## Scenario 3 — Locking enforced (edge case, FR-008/FR-008a)

1. Attempt to target the now-locked week 1 directly:
   ```bash
   node --env-file=.env.local server/scripts/publish.js quickstart-010-test program --week 1
   ```
2. Expect a non-zero exit and the `Publish failed: week 1 is locked (current week is 2)...`
   message (`contracts/publish-cli.md`). Re-check `GET .../program/weeks/1` — content and
   `version` unchanged.
3. Attempt a gap:
   ```bash
   node --env-file=.env.local server/scripts/publish.js quickstart-010-test program --week 5
   ```
   Expect the gap-rejection message; no week 5 row created (`GET .../program/weeks` still shows
   only 2 entries).

**Expected outcome**: no write path can silently rewrite or skip-create weeks.

## Scenario 4 — History browsing in the UI (User Story 3)

1. Open the customer's page in the browser (`npm run dev` URL), navigate to
   `quickstart-010-test`.
2. Confirm the Program tab defaults to week 2 (current), not week 1
   (`contracts/week-tab-navigation-v2.md` — reverses specs/003's "always Week 1" default).
3. Click the week 1 chip. Confirm: a network request fires (browser devtools), week 1's own
   distinct routine renders (not week 2's), and a locked indicator is visible on that chip.
4. Click back to week 2, then week 1 again. Confirm no second network request fires for week 1
   on the repeat visit (session cache, `contracts/week-tab-navigation-v2.md`).
5. Download the PDF while week 1 is active; confirm its content matches week 1's routine, not
   week 2's (`contracts/week-tab-navigation-v2.md` PDF export section).

**Expected outcome**: a coach or customer can browse and trust past weeks' routines as accurate
history, not a relabeled copy of the current week.

## Scenario 5 — Single-week customer unaffected (FR-007, edge case)

1. Using an existing single-week test customer fixture (or a brand-new one with only week 1
   published), open their page.
2. Confirm exactly one chip renders, no lock indicator, and the page behaves identically to
   today (no visible regression for customers who haven't been given a second week yet).

## Cleanup

Delete the test customer (cascades `programs`, `sync_events`, `offline_queue_entries` rows via
FK) the same way existing integration tests clean up fixture customers — see
`app/tests/integration/publish-cli.test.js`'s `t.after()` pattern.
