---

description: "Task list for Coach–Client Messaging"
---

# Tasks: Coach–Client Messaging

**Input**: Design documents from `/specs/016-coach-client-messaging/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages-api.md, contracts/messages-ui.md, quickstart.md

**Tests**: Included. The repo has a `node --test` suite (`app/tests/`) and the plan lists `tests/unit/messages.test.js` and `tests/integration/messages.test.js`. Supabase is replaced by an in-memory fake (pattern in `app/tests/integration/customer-auth.test.js`, `setAccountsForTests`), so no network is needed.

**Organization**: Grouped by user story. All paths are relative to the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 to US3, mapping to spec.md

---

## Phase 1: Setup

- [X] T001 Create idempotent migration `app/server/migrations/018-customer-messages.sql` in the header style of `017-customer-accounts.sql`: `CREATE TABLE IF NOT EXISTS customer_messages` with columns `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `customer_slug VARCHAR(255) NOT NULL REFERENCES customers (slug) ON DELETE CASCADE`, `sender_role TEXT NOT NULL CHECK (sender_role IN ('coach','customer'))`, `body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000)`, `client_id UUID NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `read_at TIMESTAMPTZ NULL`; plus `UNIQUE (customer_slug, client_id)`, index on `(customer_slug, id)`, partial index on `(customer_slug, sender_role) WHERE read_at IS NULL`, and `ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY` (no policies).
- [X] T002 [P] Create the migration check script `app/server/migrations/018-customer-messages.js`, modeled on `017-customer-accounts.js` (selects the columns from `customer_messages` and reports the row count; points to the SQL file if missing).
- [X] T003 [P] Add all Spanish AND English strings to `app/src/lib/strings.js` under `messages.*` keys: tab label (`Mensajes` / `Messages`), thread header for customer ("Tu coach" / "Your coach"), sender labels (Coach / Tú / customer name), composer label, Send, Sending…, character counter, over-limit error, empty state for coach, empty state for customer ("Tu coach aún no ha escrito" / "Your coach hasn't written yet"), failed + Retry, "Read" / "Not read yet", delete + confirm, new-message announcement, unread badge phrases (singular/plural: "1 mensaje sin leer", "3 mensajes sin leer"), card signal ("N mensajes nuevos"). Keep wording clearly different from `chat.*` (the AI assistant). Run `app/tests/unit/i18n.test.js` to confirm es/en key parity.

---

## Phase 2: Foundational (blocks all user stories)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create `app/server/lib/messages.js` with the validation and repository used by every story:
  - `MAX_MESSAGE_CHARS = 1000`; `validateMessage({ body, clientId })` trims `body`, rejects empty/whitespace-only (field `body`), rejects over 1000 characters counted as characters not bytes (field `body`), requires `clientId` to be a UUID (field `clientId`); returns `{ ok, value }` or `{ ok:false, fields }` in the same shape as `validateChatQuestion` in `server/lib/coach-chat.js`.
  - Supabase repo functions: `listMessages(slug, limit = 100)` (latest 100, returned oldest first), `insertMessage(slug, senderRole, body, clientId)` (on unique violation `23505` on `(customer_slug, client_id)` return the existing row and `created:false`), `hasCoachMessage(slug)`, `markRead(slug, viewerRole)` (sets `read_at = now()` only on rows from the OTHER role where `read_at IS NULL`; returns the number marked), `countUnread(slug, viewerRole)`, `latestCoachMessageRead(slug)` (null when no coach messages), `deleteCoachMessage(slug, id)` (only `sender_role='coach'`; returns false when none).
  - `shapeMessage(row)` → `{ id, senderRole, body, createdAt, readAt }`.
  - Add `setMessagesForTests(impl)` for the in-memory fake, same approach as `setAccountsForTests` in `customer-data.js`. Errors from Supabase become `Error('customer_messages: …')`; log outcomes only, never message bodies.
- [X] T005 [P] Create `app/tests/unit/messages.test.js` covering `validateMessage` (empty, whitespace-only, 1000 chars accepted, 1001 rejected, invalid/missing `clientId`, text is trimmed) and `shapeMessage`. Run it and confirm it passes against T004.
- [X] T006 Create `app/server/handlers/messages.js` exporting `handleGetMessages(req, res, slug)`, `handlePostMessage(req, res, slug)`, `handleMarkMessagesRead(req, res, slug)` and `handleDeleteMessage(req, res, slug, id)`, shaped per `contracts/messages-api.md`. Sender role is ALWAYS `req.actor.role` (never from the body). Use `readJsonBodyOr422` and `sendJson` from `server/http.js`. Leave bodies as stubs that call the T004 repo; the behaviors are completed in the story phases below.
- [X] T007 Register the four routes in `app/server/index.js` (import the handlers) with `access: 'customer-own'`, placed before the generic `/api/customers/:slug` GET route so the longer patterns win: `GET /api/customers/:slug/messages`, `POST /api/customers/:slug/messages`, `POST /api/customers/:slug/messages/read`, `DELETE /api/customers/:slug/messages/:id`. The customer-own gate already returns 404 for another slug and 401 when signed out.
- [X] T008 [P] Add `getMessages(slug)`, `sendMessage(slug, { body, clientId })`, `markMessagesRead(slug)` and `deleteMessage(slug, id)` to `app/src/api-client.js`, matching the existing request helper and error handling there.
- [X] T009 [P] Create `app/src/styles/messages.css` (import it from `app/src/styles/main.css`) with the thread/bubble/composer/badge styles using existing tokens only (`--surface-raised`, `--border`, `--ink`, `--muted`, `--accent-fill`, `--motion-*`, `--radius-*`); no raw hex. Include the AA-contrast bubble pair, 44px minimum targets, `min-width: 0` + `white-space: pre-wrap` + `overflow-wrap: anywhere` on bodies, and no horizontal overflow at 360px.

**Checkpoint**: migration, validation, handlers, routes, API client and styles are in place; stories can start.

---

## Phase 3: User Story 1 - Coach sends a message to a customer (Priority: P1) 🎯 MVP

**Goal**: The coach writes a message on a customer's page; the customer sees it with an unread badge and it clears once opened.

**Independent Test**: As coach send a message to a customer; sign in as that customer, see the badge, open Messages, read it, badge clears; another customer sees nothing.

### Tests for User Story 1

- [X] T010 [P] [US1] Create `app/tests/integration/messages.test.js` (fake from T004 via `setMessagesForTests`, sign-in stubs as in `customer-auth.test.js`) with US1 cases: coach POST creates a message (201) with `senderRole:'coach'`; empty/whitespace and 1001-char bodies get 422 with a `body` field error; GET returns messages oldest first; customer GET of their own slug sees it, with `unread:1`; customer GET of another slug → 404; signed-out → 401; `POST …/messages/read` as the customer marks it and then `unread:0`; coach DELETE of own message → 200 and gone; customer DELETE → 403; DELETE of an unknown id → 404 `message_not_found`.

### Implementation for User Story 1

- [X] T011 [US1] Complete `handleGetMessages` in `app/server/handlers/messages.js`: return `{ messages, canReply, unread, latestCoachMessageRead }` per the contract (`canReply` true for coach, for a customer true only when `hasCoachMessage`; `unread` via `countUnread(slug, actor.role)`).
- [X] T012 [US1] Complete `handlePostMessage` for the coach path: validate with `validateMessage`, 422 `{ error:'validation_failed', fields }` on failure, `insertMessage(slug, actor.role, …)`, 201 `{ message }` on create and 200 with the existing message on a repeated `clientId` (idempotent, FR-010).
- [X] T013 [US1] Complete `handleMarkMessagesRead` (200 `{ marked, unread }`, idempotent, only touches the OTHER role's rows) and `handleDeleteMessage` (coach only; customer → 403 `forbidden`; only coach-authored messages in that conversation; otherwise 404 `message_not_found`; 200 `{ deleted:true }`) in `app/server/handlers/messages.js` (FR-013).
- [X] T014 [US1] Add `unreadMessages` to the customer view in `app/server/handlers/customers.js` (`handleGetCustomer`): `countUnread(slug, req.actor.role)`; on any error return 0 and log the outcome (contract: a counting failure must not break the page).
- [X] T015 [US1] Create `app/src/components/messages-panel.js` exporting `renderMessagesPanel(container, { slug, role, customerName })`: header naming the other party; thread oldest → newest from `getMessages`, scrolled to the newest on open; each bubble shows sender label + time, left/right alignment, body via `textContent` only; loading skeleton with reserved space; coach empty state; composer (visible `<label>`, textarea, `enterkeyhint="send"`, ≥44×44px Send button, Ctrl/Cmd+Enter sends, counter from 900 of 1000 and an inline over-limit message near the field); generate a `crypto.randomUUID()` `clientId` per composed message and keep it for retry; sending state disables Send; failure shows an inline error + Retry with the text preserved; coach can delete own messages through a labelled ≥44px button with confirmation. On open (page visible) call `markMessagesRead` and then clear the tab badge. Use `t('messages.*')` for every string.
- [X] T016 [US1] Wire the tab in `app/src/views/customer-view.js` `buildTabConfig`: add `{ id: 'messages', label: t('tabs.messages'), isEnabled: true, contentType: 'messages', order: 4 }` for BOTH roles (customers still do not get Feedback/Notes), add `'tabs.messages'` to `strings.js` (es `Mensajes`, en `Messages`), and render it in `app/src/components/tab-container.js` by calling `renderMessagesPanel` for `contentType === 'messages'`.
- [X] T017 [US1] Add the tab unread badge in `app/src/components/tab-container.js`: when `data.unreadMessages > 0`, append a pill to the Messages tab button showing the count ("9+" above 9) plus visually hidden text with the plural phrase ("3 mensajes sin leer"); never colour alone; the pill must not wrap or grow the tab; add its styles to `app/src/styles/messages.css`; update the badge to hidden once `markMessagesRead` succeeds.
- [X] T018 [US1] Run `cd app && npm test` and fix failures; then run the quickstart manual steps 1 and 5 (coach sends → customer sees and clears badge; customer A cannot read customer B's thread). *(Done: `npm test` green and the quickstart behaviors covered by integration tests with an in-memory database. Manual quickstart step(s) 1 and 5 against the real Supabase database not run yet.)*

**Checkpoint**: Coach-to-customer messaging works end to end (MVP).

---

## Phase 4: User Story 2 - Customer reads and replies to the coach (Priority: P2)

**Goal**: The customer replies once the coach has written; the coach sees an unread signal on the customer's card and in the thread.

**Independent Test**: As a customer with an unread coach message, reply; sign in as coach, see the card signal, open the thread, see the reply in order, signal clears.

### Tests for User Story 2

- [X] T019 [P] [US2] Extend `app/tests/integration/messages.test.js`: a customer POST before any coach message → 409 `no_coach_message`; after a coach message → 201 with `senderRole:'customer'` and the body, in chronological order; `canReply` false then true for the customer; coach GET shows `unread` for the customer reply and `POST …/messages/read` clears it; the customer cannot send as the coach (a body `senderRole:'coach'` is ignored); a repeated `clientId` creates exactly one row (duplicate-send guard); `GET /api/customers` returns `unreadMessages` per customer for the coach; messages cascade away when the customer fake is deleted.

### Implementation for User Story 2

- [X] T020 [US2] In `handlePostMessage` (`app/server/handlers/messages.js`) enforce FR-004 for the customer role: when `actor.role === 'customer'` and `!(await hasCoachMessage(slug))` respond 409 `{ error:'no_coach_message', message:'Your coach has not written yet.' }`.
- [X] T021 [US2] Add `unreadMessages` per customer to `listAllCustomers` in `app/server/lib/customer-data.js` using ONE grouped query for all slugs (unread customer-authored rows grouped by `customer_slug`, not one query per customer); default 0 and log on failure so the overview still loads. Add the field to the card payload in `handleGetCustomers` unchanged.
- [X] T022 [US2] In `app/src/components/messages-panel.js` hide the composer for the customer until `canReply` (show the calm empty state `messages.emptyCustomer` instead) and show it as soon as the first coach message exists after a refresh.
- [X] T023 [US2] Add the coach card signal in `app/src/components/customer-card.js` `renderSignals`: when `unreadMessages > 0` add `signalBadge('chat', t('messages.cardSignal', { n }), 'is-alert')` FIRST in the row (icon + text, never colour alone; use the existing `chat` icon name or the matching one in `app/src/lib/icons.js`), and make `renderSignals` render the row even when there are no other signals. Confirm the card and overview filters in `app/src/lib/client-filter.js` do not break.
- [X] T024 [US2] Add live refresh in `messages-panel.js`: while the Messages tab is open and `document.visibilityState === 'visible'`, re-fetch every 20 s; stop on tab change, route change, or hidden page (clear the interval); when new incoming messages arrive while open, append them, keep scroll position unless the user is at the bottom, call `markMessagesRead`, and announce once via a polite `role="status"` line ("Nuevo mensaje" / "New message"), not per poll.
- [X] T025 [US2] Run `cd app && npm test`; then manual quickstart steps 2, 3 and 6 (gate state, reply visible to coach with card signal, offline retry produces exactly one row). *(Done: `npm test` green and the quickstart behaviors covered by integration tests with an in-memory database. Manual quickstart step(s) 2, 3 and 6 against the real Supabase database not run yet.)*

**Checkpoint**: Two-way conversation works; coach sees who replied.

---

## Phase 5: User Story 3 - See what is new and what has been read (Priority: P3)

**Goal**: The coach can tell whether the customer has read the latest message, and both sides see consistent unread/read state.

**Independent Test**: Send as coach → shows "Not read yet"; open as the customer → coach sees "Read".

### Tests for User Story 3

- [X] T026 [P] [US3] Extend `app/tests/integration/messages.test.js`: `latestCoachMessageRead` is `null` with no coach messages, `false` right after a coach message, `true` after the customer's mark-read; a later coach message flips it back to `false`; mark-read by the coach never marks the coach's own messages (only the other role's); mark-read twice returns `marked:0` the second time.

### Implementation for User Story 3

- [X] T027 [US3] Ensure `latestCoachMessageRead` in `handleGetMessages` (`app/server/handlers/messages.js`) uses the newest coach message's `read_at` per `data-model.md` ("Coach's latest message read?"); `null` when the coach has sent nothing.
- [X] T028 [US3] In `app/src/components/messages-panel.js`, for the coach only, show a status line on the newest coach message: `messages.read` ("Leído" / "Read") or `messages.notRead` ("Aún sin leer" / "Not read yet") with an icon + text; update it on each refresh from T024. Customers never see this line.
- [X] T029 [US3] Run `cd app && npm test`; then manual quickstart step 4 (Not read yet → Read after the customer opens it). *(Done: `npm test` green and the quickstart behaviors covered by integration tests with an in-memory database. Manual quickstart step(s) 4 against the real Supabase database not run yet.)*

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T030 [P] UI/UX Pro Max pre-delivery pass against `contracts/messages-ui.md` and `checklists/ux-alignment.md`: query the skill (`ux` domain: "chat message thread unread badge", "badge chip label wraps", "live badge count screen reader") and check the built UI at 360px, tablet and desktop: no horizontal scroll, ≥44px targets (tab, Send, Delete), visible focus rings, AA contrast in both bubble colours (and any dark appearance the app has), badge phrase read correctly by a screen reader and "9+" does not wrap, AI assistant launcher unchanged and not overlapped, es and en complete, `prefers-reduced-motion` honoured. Record results as new items in `checklists/ux-alignment.md`. *(Partly done: behavior, 44px targets, no horizontal overflow, labels, badge phrase, es/en and AA colors checked in a mock page; screenshots, screen reader and dark appearance still to check on the built app. See `checklists/ux-alignment.md`.)*
- [X] T031 [P] Security pass on `app/server/handlers/messages.js` and `messages-panel.js`: message text only reaches the DOM through `textContent` (no `innerHTML`), sender role never read from the body, other-slug and signed-out requests answer 404/401, logs contain no message bodies, strict CSP still satisfied.
- [X] T032 [P] Confirm `app/server/lib/customer-data.js` customer delete path (if any) and `ON DELETE CASCADE` remove messages (spec edge case); add a note to `app/README.md` documenting migration `018-customer-messages.sql` and the check script.
- [ ] T033 Run the complete `specs/016-coach-client-messaging/quickstart.md` (automated + all manual steps) on a phone-width viewport and desktop; tick the spec's success criteria SC-001 to SC-006 that can be measured manually; fix any gaps found.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → stories → Polish.** Phase 2 blocks every story.
- **US1 (P1)** has no dependency on other stories and is the MVP.
- **US2 (P2)** builds on US1's panel and handlers (T015, T012) but is independently testable once US1 exists.
- **US3 (P3)** builds on US1's panel and US2's refresh loop (T024).
- Within a story: tests → handlers → client panel → wiring.
- File conflicts to respect: `messages.js` handler (T006 → T011 → T012 → T013 → T020 → T027), `messages-panel.js` (T015 → T022 → T024 → T028), `messages.test.js` (T010 → T019 → T026), `strings.js` (T003 first, T016 adds one key).

## Parallel Opportunities

- Phase 1: T002 and T003 in parallel after T001.
- Phase 2: T005, T008 and T009 in parallel with each other once T004 exists (T005 needs T004; T008/T009 do not).
- US1: T010 (test) in parallel with T014; T011–T013 are sequential (same file).
- US2: T019 in parallel with T021 and T023 (different files).
- Polish: T030, T031 and T032 are independent.

```text
# Example: after Phase 2, one person per track in US1
Track A (server):  T011 → T012 → T013 → T014
Track B (client):  T015 → T016 → T017
Track C (tests):   T010
```

## Implementation Strategy

1. **MVP first**: Phases 1–3 deliver the user's core ask (coach sends messages; customer sees them). Validate with T018 before continuing.
2. **Incremental**: add US2 (replies and the coach signal), then US3 (read status).
3. **Gate with the UI/UX review**: T030 must pass before calling the feature done, as requested for this feature.
4. Out of scope (per spec): attachments, notifications, group chats, customer-first messages.
