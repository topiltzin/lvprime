---

description: "Task list for Welcome Motivation Popup"
---

# Tasks: Welcome Motivation Popup

**Input**: Design documents from `/specs/018-welcome-motivation-popup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/welcome-api.md, contracts/welcome-ui.md, quickstart.md

**Tests**: Included for pure logic and the API (the repo runs `node --test` from `app/`: `cd app && npm test`, using the in-memory override pattern of `app/tests/integration/messages.test.js`). There is no DOM test harness, so popup behaviour (focus, Esc, effect, reduced motion, 360 px) is verified manually with `quickstart.md`.

**Organization**: Grouped by user story. All paths are relative to the repo root. No new dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 to US3, mapping to spec.md

---

## Phase 1: Setup

- [X] T001 Create `app/server/migrations/019-welcome-messages.sql` creating table `welcome_messages` per `data-model.md`: `customer_slug VARCHAR(255) PRIMARY KEY REFERENCES customers(slug) ON DELETE CASCADE`; `body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 300)`; `delivery_weekday SMALLINT NOT NULL DEFAULT 1 CHECK (delivery_weekday BETWEEN 1 AND 7)` (ISO, 1 = Monday); `repeat_weekly BOOLEAN NOT NULL DEFAULT true`; `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`; `last_seen_week DATE NULL`; `last_seen_at TIMESTAMPTZ NULL`; then `ALTER TABLE welcome_messages ENABLE ROW LEVEL SECURITY;` with no policies. Mirror the style of `app/server/migrations/018-customer-messages.sql`.
- [X] T002 [P] Create `app/server/migrations/019-welcome-messages.js` as a verifier identical in shape to `018-customer-messages.js` (head-count select of `customer_slug, body, delivery_weekday, repeat_weekly, updated_at, last_seen_week, last_seen_at` from `welcome_messages`; on error print "run server/migrations/019-welcome-messages.sql in the Supabase SQL Editor first").
- [X] T003 [P] Add Spanish AND English strings to `app/src/lib/strings.js` (follow the existing `messages.*` placement): `welcome.fromCoach` ("De tu coach" / "From your coach"), `welcome.heading` ("¡Bienvenido de vuelta, {name}!" / "Welcome back, {name}!"), `welcome.cta` ("¡Vamos!" / "Let's go!"), `welcome.close`, `welcome.preview` ("Vista previa" / "Preview"), `tabs.welcome` ("Mensaje de bienvenida" / "Welcome message"), `welcome.label` (field label), `welcome.counter` ("{n}/300"), `welcome.day` (day picker legend), `welcome.repeat` ("Repetir cada semana" / "Repeat every week"), `welcome.statusScheduled` ("Programado para {day}" / "Scheduled for {day}"), `welcome.statusSeen` ("Visto el {date}" / "Seen on {date}"), `welcome.save`, `welcome.remove`, `welcome.saved`, `welcome.required` ("Escribe un mensaje" / "A message is required"), `welcome.tooLong`, `welcome.history` ("Conversación anterior (solo lectura)" / "Earlier conversation (read-only)"). Run `cd app && node --test tests/unit/i18n.test.js` for es/en parity.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: The server module every story uses: validation, week math, due logic, repository.

- [X] T004 Create `app/server/lib/welcome.js` modelled on `app/server/lib/messages.js`, exporting: `MAX_WELCOME_CHARS = 300`; `validateWelcome(input)` returning `{ ok: true, value: { body, deliveryWeekday, repeatWeekly } }` or `{ ok: false, fields }` (body trimmed, non-empty, `[...body].length <= 300` counting characters not UTF-16 units; `deliveryWeekday` integer 1..7, default 1 when omitted; `repeatWeekly` boolean, default true); `weekStart(dateStr)` returning the Monday `YYYY-MM-DD` of a `YYYY-MM-DD` date (pure UTC arithmetic, no `Date.now`); `isoWeekday(dateStr)` 1..7; `validateToday(dateStr, nowMs)` ok only for a real `YYYY-MM-DD` within 1 day of the server's UTC date; `isDue(row, today)` = `isoWeekday(today) >= row.delivery_weekday` AND (`repeat_weekly` ? `row.last_seen_week !== weekStart(today)` : `row.last_seen_week == null`); and repo functions `getWelcome(slug)`, `saveWelcome(slug, value)` (upsert; reset `last_seen_week` and `last_seen_at` to NULL only when `body` differs from the stored body, otherwise keep them), `deleteWelcome(slug)`, `markWelcomeSeen(slug, weekStartStr)` (idempotent update; `{ recorded: false }` when no row). Throw `CustomerNotFoundError` for an unknown slug on save (reuse `customer-data.js` errors), wrap DB failures in `DatabaseError`, and include `setWelcomeForTests(impl)` in-memory override as `messages.js` does. Never log message text.
- [X] T005 [P] Create `app/tests/unit/welcome.test.js` (node:test + assert/strict) covering: `validateWelcome` (empty/whitespace rejected, 300 chars ok, 301 rejected, an emoji counts as 1 char, weekday 0 and 8 rejected, defaults Monday/true); `weekStart` (2026-10-05 Mon → itself, 2026-10-11 Sun → 2026-10-05, 2026-10-12 → 2026-10-12, year boundary 2027-01-01 → 2026-12-28); `isoWeekday`; `validateToday` (malformed, impossible date like 2026-02-30, 2 days off rejected, today ±1 ok); `isDue` (Mon delivery + Wed today + unseen → true; seen same week → false; next week → true; `repeat_weekly=false` seen once → false forever; delivery Thu + today Tue → false). Run `cd app && node --test tests/unit/welcome.test.js`.

**Checkpoint**: Logic and repository exist and are tested; strings and migration are ready.

---

## Phase 3: User Story 1 - Customer welcomed with a motivational popup (Priority: P1) 🎯 MVP

**Goal**: A customer with a due, unseen message sees the celebratory popup after sign-in; closing it records the week.

**Independent Test**: Insert a welcome row for a customer (via SQL or the test override), sign in as that customer and confirm popup, effect, close paths, and no repeat on re-login.

- [X] T006 [P] [US1] Create `app/tests/integration/welcome.test.js` using `startTestServer` and `setWelcomeForTests`, customer-auth fixtures as in `app/tests/integration/messages.test.js`. US1 cases: `GET /api/customers/:slug/welcome/due?today=…` returns `{ due: true, message: { body, coachName }, weekStart }` for the customer's own slug and `{ due: false }` when none exists or already seen; 404 `customer_not_found` for another customer's slug; 401 signed-out; 403 `account_disabled` for archived; 422 `validation_failed` for missing/malformed/off-by-2-days `today`; coach receives `{ due: false }`; `POST …/welcome/seen` with a Monday `weekStart` returns `{ recorded: true }`, is idempotent, makes the next due check `false`; non-Monday `weekStart` → 422; no row → `{ recorded: false }`.
- [X] T007 [US1] Create `app/server/handlers/welcome.js` with `handleGetWelcomeDue` and `handleMarkWelcomeSeen` per `contracts/welcome-api.md` (read `today` from the query string; coach role short-circuits to `{ due: false }`; `coachName` from the existing coach display name, falling back to the localized "Your coach" label sent as `null` so the client can substitute). Register both routes in `app/server/index.js` with `access: 'customer-own'`, next to the existing message routes, patterns `/^\/api\/customers\/([^/]+)\/welcome\/due\/?$/` and `/^\/api\/customers\/([^/]+)\/welcome\/seen\/?$/`. Run T006 tests.
- [X] T008 [P] [US1] Add `getWelcomeDue(slug, today)` and `markWelcomeSeen(slug, weekStart)` to `app/src/api-client.js` (same `request` helper and slug encoding as the existing message calls).
- [X] T009 [P] [US1] Create `app/src/components/fireworks.js` exporting `playBurst(canvas, { bursts, particlesPerBurst, durationMs, colors })` returning a promise that resolves (and clears the canvas) when finished. Implementation: `requestAnimationFrame` loop; each burst picks a random origin in the upper 60% of the viewport and spawns radial particles with velocity, gravity, drag and alpha fade; devicePixelRatio capped at 2; canvas sized to `window.innerWidth/innerHeight` and resized on `resize`; halve particle count when `navigator.hardwareConcurrency <= 2`; abort early if two consecutive frames exceed 50 ms; hard stop at `durationMs`. No sustained flashing: particles fade smoothly, no full-screen flashes. Colors read from CSS variables `--brand-volt`, `--brand-chalk` and a warm accent via `getComputedStyle`. Export `prefersReducedMotion()` using `matchMedia('(prefers-reduced-motion: reduce)')`.
- [X] T010 [P] [US1] Create `app/src/styles/welcome.css` and import it from `app/src/styles/main.css`: `.welcome-dialog` (width `min(520px, calc(100% - 32px))`, `max-height: calc(100dvh - 32px)`, internal scroll, `--surface-raised`, `--radius-hero`, `--shadow-hero`, volt accent top line, transparent/dim `::backdrop`), canvas layer `.welcome-fx` (`position: fixed; inset: 0; pointer-events: none; z-index` above the dialog backdrop, below nothing the user must click), label/heading (display font)/message (1.25rem) styles, primary button and close icon button both `min-height: 44px; min-width: 44px` with visible `:focus-visible` outline, enter/exit keyframes (scale 0.96→1 + fade, ≤ 250 ms in, ≤ 200 ms out) using `--motion-*` tokens, and a `@media (prefers-reduced-motion: reduce)` block removing transforms and leaving a 150 ms opacity fade. Text must sit on the solid card (contrast ≥ 4.5:1 in light and dark).
- [X] T011 [US1] Create `app/src/components/welcome-popup.js` exporting `openWelcomePopup({ name, body, coachName, preview = false, onClosed })` returning a promise resolved after close. Build with DOM APIs and `textContent` only (no `innerHTML`): `<dialog class="welcome-dialog" aria-labelledby aria-describedby>` containing label (`welcome.fromCoach`, or `coachName` when given), heading (`welcome.heading` with `{name}`), message paragraph, primary button (`welcome.cta`), close icon button (`welcome.close`, via `icon('close')` as in `video-dialog.js`), and a "Preview" ribbon when `preview`. `showModal()`; focus the primary button; restore focus to the previously focused element on close. Close on button, Esc (`cancel` event), and backdrop click. If a welcome popup is already open, return without opening another. On open call `playBurst` (3 bursts × 28 particles, ≈1200 ms) unless `prefersReducedMotion()`; on close play one burst (1 × 28, ≈500 ms) while the card fades out, then remove the dialog and canvas; the page must be interactive as soon as the dialog closes (do not await the exit burst before resolving). Add `body.welcome-open { overflow: hidden }` while open.
- [X] T012 [US1] In `app/src/main.js`, after the first route render and only when `isCustomer()`, run a non-blocking due check: compute local `today` as `YYYY-MM-DD` from the browser's local date, call `getWelcomeDue(session.slug, today)`, and when `due` call `openWelcomePopup({ name, body, coachName })` (first name from the session/customer name already available to the header; fall back to no name variant) then `markWelcomeSeen(session.slug, weekStart)` after it closes. Swallow all errors silently (no toast) so sign-in is never affected. Run the check once per sign-in, not on every route change.

**Checkpoint**: With a row inserted by hand, a customer sees the popup once and it does not return. MVP complete.

---

## Phase 4: User Story 2 - Coach writes the message and picks the delivery day (Priority: P2)

**Goal**: The coach authors, schedules, previews and removes the message from the customer page and sees seen/scheduled status.

**Independent Test**: As coach, save a Monday message, see "Scheduled for Monday", preview it without changing status, edit it, and confirm the customer sees the new text.

- [X] T013 [P] [US2] Extend `app/tests/integration/welcome.test.js` with coach cases: `GET /welcome` → `{ message: null }` then the saved shape with `status` `scheduled`/`seen`; `PUT` creates (201/200 per contract) with defaults when only `body` sent; empty/whitespace body, 301 chars, weekday 0/8 → 422 with `fields`; unknown slug → 404; customer calling GET/PUT/DELETE → 403 `forbidden`; `DELETE` removes and is idempotent; `PUT` with changed text resets seen state, `PUT` with same text and a changed weekday keeps it.
- [X] T014 [US2] Add `handleGetWelcome`, `handlePutWelcome`, `handleDeleteWelcome` to `app/server/handlers/welcome.js` and register `GET|PUT|DELETE /api/customers/:slug/welcome` in `app/server/index.js` with the coach-only access tag used by other coach-only routes. `status` is `seen` when `last_seen_week` equals the current week start (server UTC date), else `scheduled`. Run T013 tests.
- [X] T015 [P] [US2] Add `getWelcome(slug)`, `saveWelcome(slug, { body, deliveryWeekday, repeatWeekly })` and `deleteWelcome(slug)` to `app/src/api-client.js`.
- [X] T016 [US2] Create `app/src/components/welcome-editor.js` exporting `renderWelcomeEditor(container, { slug, customerName })` per `contracts/welcome-ui.md`: labelled textarea (visible `<label>`, `maxlength` not enforced so typed text is never lost; live counter `welcome.counter`, warning style at ≥ 270); day picker as a `role="radiogroup"` of 7 buttons (Mon–Sun localized via `Intl.DateTimeFormat(getLocale(), { weekday: 'short' })`, arrow-key navigation, ≥ 44 px, default Monday); "Repeat every week" switch (default on); status line (`welcome.statusScheduled` / `welcome.statusSeen` with `YYYY-MM-DD`); buttons Save, Preview (calls `openWelcomePopup({ preview: true, … })` with the current unsaved text, never calls the seen endpoint), Remove (confirm first). Inline errors from 422 `fields`; `showToast` on save success/failure. Preserve typed text on failures. Render the "Earlier conversation (read-only)" collapsed section when the coach-only `GET …/messages` returns messages (reuse `listMessages` from `api-client.js`; render bubbles with `textContent`, no composer).
- [X] T017 [US2] Wire the editor into the customer page: in `app/src/views/customer-view.js` change the `messages` tab entry (~line 70) to id `welcome`, label `t('tabs.welcome')`, shown to the coach only; in `app/src/components/tab-container.js` replace the `messages` case (~line 195) with a `welcome` case that calls `renderWelcomeEditor`, and remove the tab badge call for it. Add editor styles (fields, day picker, switch, status, counter) to `app/src/styles/welcome.css`.

**Checkpoint**: Coach can run the whole flow end-to-end; US1 and US2 work together.

---

## Phase 5: User Story 3 - Weekly start-of-week delivery (Priority: P3)

**Goal**: Delivery follows the chosen weekday, catches up later in the week, repeats weekly or shows once.

**Independent Test**: With the quickstart scenarios 4–6, advance `today` across days and weeks and observe due/not-due exactly as specified.

- [X] T018 [US3] Extend `app/tests/integration/welcome.test.js` with scheduling cases through the API: delivery Monday + `today` Wednesday → due once, then not due the same week; `today` in the next week → due again for `repeatWeekly: true`; `repeatWeekly: false` → never due again after the first dismissal; delivery day later than `today` in the same week → not due; Sunday delivery (7) only due on Sunday; text edit after being seen makes it due again that same week; two "devices" (two due checks after one seen call) → second is `false`.
- [X] T019 [US3] Fix any gaps the T018 tests reveal in `app/server/lib/welcome.js` / `app/server/handlers/welcome.js` (week boundary on Sunday, `weekStart` returned to the client matches the server's computation for the supplied `today`, once-mode stays seen across weeks). Run `cd app && npm test`.
- [X] T020 [US3] In `app/src/main.js` make the `weekStart` sent to `markWelcomeSeen` the value returned by the due response (not recomputed client-side), so server and client never disagree about the week.

**Checkpoint**: All three stories work; weekly rhythm verified.

---

## Phase 6: Retire customer messaging (016) — spec FR-001, FR-013

**Goal**: Customers can no longer reply or see a conversation; coach keeps read-only history.

- [X] T021 In `app/server/index.js` remove the `POST /messages`, `POST /messages/read` and `DELETE /messages/:id` routes and change `GET /messages` to the coach-only access tag; in `app/server/handlers/messages.js` delete `handlePostMessage`, `handleMarkMessagesRead`, `handleDeleteMessage` and make `handleGetMessages` return `{ messages }` only.
- [X] T022 [P] In `app/server/lib/messages.js` remove the write/unread helpers no longer used (`insert`/send, `markRead`, `countUnread*`, `unreadByCustomer`, `deleteCoachMessage`, `latestCoachMessageRead`, `hasCoachMessage`) keeping `listMessages`, `shapeMessage` and the table access; remove the matching imports and `unreadMessages` fields from `app/server/handlers/customers.js` (~line 151) and `app/server/lib/customer-data.js` (~lines 13, 356–369).
- [X] T023 [P] Trim `app/tests/unit/messages.test.js` and `app/tests/integration/messages.test.js` to the remaining read-only history behaviour (coach can list; customer → 403; POST/read/DELETE → 404); update `customer-view`, `customers-overview` and `customer-auth` tests that referenced `unreadMessages` or the customer Messages tab.
- [X] T024 [P] Remove the customer-facing client pieces: delete `app/src/components/messages-panel.js` and `app/src/styles/messages.css` (and its import in `app/src/styles/main.css`); remove the unread badge from `app/src/components/customer-card.js` (`renderSignals` ~lines 26–32, ~103) and the tab-badge code (`setTabBadge`, `tabs.messages` references, ~lines 114, 571–600) from `app/src/components/tab-container.js`; remove `sendMessage`, `markMessagesRead`, `deleteMessage` from `app/src/api-client.js`; delete now-unused `messages.*` strings in `app/src/lib/strings.js` (keep any used by the read-only history). Run `cd app && node --test tests/unit/i18n.test.js`.

---

## Phase 7: Polish & Cross-Cutting

- [X] T025 [P] Run `cd app && npm test` and fix failures; run `cd app && npm run build` and confirm no errors and the CSP test (`app/tests/unit/security-headers.test.js`) still passes (no CSP change is expected: canvas needs none).
- [ ] T026 Manually walk through every scenario in `specs/018-welcome-motivation-popup/quickstart.md` (light and dark, 360 px, reduced motion, keyboard-only, Esc/backdrop/button close, second browser) and record any deviation as a fix.
- [ ] T027 [P] Add a 018 note to `specs/018-welcome-motivation-popup/checklists/` as `ux-alignment.md` listing the FR-014 to FR-020 checks and their results from T026; mark completed items `[X]` in this file.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5) → Phase 6 → Phase 7.
- US1 only needs Phase 2; a row can be inserted by hand/test override, so it is the MVP. US2 reuses `openWelcomePopup` from US1 for Preview (T016 depends on T011). US3 builds on the server endpoints from US1/US2. Phase 6 depends on US2 (T017 replaces the tab that the old panel occupied).
- Within phases: T006 before T007; T009, T010 before T011; T011 before T012; T013 before T014; T016 before T017.

## Parallel Opportunities

- Phase 1: T002, T003 together after T001.
- Phase 2: T005 alongside T004's finishing touches (tests written against the declared exports).
- US1: T006, T008, T009, T010 in parallel; then T007, T011, T012 in order.
- US2: T013 and T015 in parallel.
- Phase 6: T022, T023, T024 in parallel after T021.

## Implementation Strategy

1. **MVP**: Phases 1–3 (T001–T012): hand-inserted message → celebratory popup for the customer, once per week.
2. **Increment 2**: Phase 4: coach authoring, scheduling UI, preview, status.
3. **Increment 3**: Phase 5: verified weekly rhythm; then Phase 6 removes customer replies; Phase 7 validates.
