---

description: "Task list for the Fitness Coach Chatbot feature"
---

# Tasks: Fitness Coach Chatbot

**Input**: Design documents from `/specs/013-fitness-coach-chatbot/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/chat-api.md](./contracts/chat-api.md), [contracts/chat-panel-ui.md](./contracts/chat-panel-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Included. plan.md and research.md §8 name `app/tests/unit/coach-chat.test.js` and `app/tests/integration/coach-chat.test.js` as deliverables. Write each story's tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1, US2, US3)
- All paths are relative to the repository root. The app lives in `app/` (`app/server/` API, `app/src/` browser SPA, `app/tests/` `node --test` suites).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration and assets that every story needs. No new npm packages.

- [X] T001 [P] Document the new env var in `app/.env.example`: add a commented block after the Supabase/auth vars: `# Fitness coach chatbot (specs/013-fitness-coach-chatbot). Full URL of the upstream /chat endpoint, e.g. https://8000-<id>.cloudspaces.litng.ai/chat. When unset, /api/chat answers 503 chatbot_not_configured.` followed by `CHATBOT_URL=`. Don't put the real URL in this file.
- [X] T002 [P] In `app/vercel.json`, add a top-level `"functions": { "api/index.js": { "maxDuration": 130 } }` next to the existing `rewrites`, so Vercel doesn't kill the function before the 120 s upstream timeout returns its 504 (research.md §3).
- [X] T003 [P] Register four Phosphor icons in `app/src/lib/icons.js`, using the same `?raw` import pattern and `ICONS` map as the existing entries: `chat-circle-dots` (`@phosphor-icons/core/assets/regular/chat-circle-dots.svg?raw`), `paper-plane-right` (`.../regular/paper-plane-right.svg?raw`), `x` (`.../regular/x.svg?raw`), `arrow-clockwise` (`.../regular/arrow-clockwise.svg?raw`). Map keys: `'chat'`, `'send'`, `'close'`, `'retry'`. `warning-circle` is already registered; reuse it for the error state.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The server module, route skeleton and client API function that all three stories build on.

**⚠️ CRITICAL**: No user-story work can start until this phase is done.

- [X] T004 Create `app/server/lib/coach-chat.js` (ES module, no imports needed) exporting these constants exactly (data-model.md "Coaching instruction"):
  - `COACH_INSTRUCTION = 'You are a fitness coach ready to help. Answer in 2-4 short sentences or at most 4 short bullet points. Question: '`
  - `MAX_TOKENS = 200`
  - `UPSTREAM_TIMEOUT_MS = 120000`
  - `MAX_QUESTION_CHARS = 1000`

  Also export `class ChatbotError extends Error` with a `code` property (one of `'chatbot_unavailable'`, `'chatbot_timeout'`, `'chatbot_not_configured'`), and a module-level `let timeoutOverrideMs = null` with `export function setChatTimeoutForTests(ms)` (sets it; pass `null` to reset), matching the `setSignInForTests` pattern in `app/server/auth.js`. Add a header comment pointing to `specs/013-fitness-coach-chatbot/contracts/chat-api.md`.
- [X] T005 In `app/server/lib/coach-chat.js`, add `export function validateChatQuestion(body)`. It returns `{ ok: true, question }` with `question` trimmed, or `{ ok: false, fields: { message: '...' } }`. Rules from contracts/chat-api.md: `message` missing, not a string, or blank after trim → `'Enter a question.'`; trimmed length > `MAX_QUESTION_CHARS` (1000) → `'Keep questions under 1000 characters.'`. Ignore every other field in `body`.
- [X] T006 In `app/server/lib/coach-chat.js`, add `export function buildCoachMessage(question)`, returning `COACH_INSTRUCTION + question` (the question verbatim, no other text added).
- [X] T007 In `app/src/api-client.js`, add `export function askCoach(message, { signal } = {})`, which calls `request('/api/chat', { method: 'POST', body: JSON.stringify({ message }), signal })` and returns `{ answer }`. Add a JSDoc line: `/** POST /api/chat → { answer } (specs/013 contracts/chat-api.md). Throws ApiError on any non-2xx. */`. `request()` already spreads `options` into `fetch`, so `signal` passes through. But its `catch` around `fetch` currently rewrites every failure into the "Cannot reach the local server" `ApiError`. Change it so an `AbortError` / `TimeoutError` (`err.name === 'AbortError' || err.name === 'TimeoutError'`) is rethrown unchanged, letting the panel tell a Clear-chat abort from a failure.

**Checkpoint**: The helpers exist and are importable. There's no route or UI yet.

---

## Phase 3: User Story 1 - Ask the coach assistant a quick question (Priority: P1) 🎯 MVP

**Goal**: A signed-in coach opens a floating panel, sends a question, and sees a short coach-voice answer. The hidden instruction is added on the server and never shown.

**Independent Test**: Sign in, open the chat panel from any screen, send "Beginner diet tips?", and confirm a short, fitness-focused answer appears under the question (quickstart.md manual checks 1–5).

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T008 [P] [US1] Create `app/tests/unit/coach-chat.test.js` (`node:test` + `node:assert/strict`, importing from `../../server/lib/coach-chat.js`). Cases:
  - `buildCoachMessage('Beginner diet tips?')` equals `COACH_INSTRUCTION + 'Beginner diet tips?'` and starts with `'You are a fitness coach ready to help.'`
  - `validateChatQuestion({ message: '  hi  ' })` → `{ ok: true, question: 'hi' }`
  - missing / `''` / `'   '` / `42` → `fields.message === 'Enter a question.'`
  - `'a'.repeat(1000)` ok; `'a'.repeat(1001)` → `fields.message === 'Keep questions under 1000 characters.'`
  - extra fields such as `max_tokens` are ignored (result has only `ok` and `question`)
- [X] T009 [P] [US1] Create `app/tests/integration/coach-chat.test.js`. Use `startTestServer(() => {})` from `./helpers.js` (it leaves the coach gate open). Add a local helper `startStubChatbot(handler)` that starts `http.createServer` on port 0 and records each received JSON body. Set `process.env.CHATBOT_URL = \`http://localhost:${port}/chat\`` before each test and delete it in `t.after`. Success test:
  - stub replies `200 {"response":"  Eat protein at every meal.  "}`
  - `POST /api/chat {"message":"Beginner diet tips?"}` returns `200 { answer: 'Eat protein at every meal.' }` (trimmed)
  - the stub received exactly `{ message: COACH_INSTRUCTION + 'Beginner diet tips?', max_tokens: 200 }` (`deepEqual`)
  - a request body with `max_tokens: 5000` still makes the stub receive `max_tokens: 200`

  Also add a `422` test: `{"message":"   "}` → `422 { error: 'validation_failed', fields: { message: 'Enter a question.' } }`, and the stub got **no** request.

### Implementation for User Story 1

- [X] T010 [US1] In `app/server/lib/coach-chat.js`, add `export async function askCoachChatbot(question)`, the success path:
  - read `process.env.CHATBOT_URL` at call time (not at import); if it's empty, throw `new ChatbotError('chatbot_not_configured')`
  - `fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: buildCoachMessage(question), max_tokens: MAX_TOKENS }), signal: AbortSignal.timeout(timeoutOverrideMs ?? UPSTREAM_TIMEOUT_MS) })`
  - on `res.ok`, parse JSON; if `typeof data.response === 'string' && data.response.trim()`, return `data.response.trim()`
  - for now, any other outcome throws `new ChatbotError('chatbot_unavailable')`; US2 (T017) refines the mapping

  Never `console.log` the question or the answer.
- [X] T011 [US1] In `app/server/index.js`, import `validateChatQuestion`, `askCoachChatbot`, `ChatbotError` from `./lib/coach-chat.js` and add `async function handlePostChat(req, res)`. It parses the body with `readJsonBody`, following `handlePostFeedback`: invalid JSON → `sendJson(res, 422, { error: 'validation_failed', fields: { body: 'invalid JSON' } })`, and `PayloadTooLargeError` is rethrown. Validation failure → `422 { error: 'validation_failed', fields }`. Success → `200 { answer }`. Catch `ChatbotError` and map it with this table (defined as a const object next to the handler):

  | `code` | Response |
  |---|---|
  | `chatbot_unavailable` | `502 { error: 'chatbot_unavailable', message: 'The coach assistant is unavailable right now. Try again.' }` |
  | `chatbot_timeout` | `504 { error: 'chatbot_timeout', message: 'The coach assistant took too long to answer. Try again.' }` |
  | `chatbot_not_configured` | `503 { error: 'chatbot_not_configured', message: 'The coach assistant is not set up yet.' }` |

  Log `console.error('Chatbot error:', err.code, err.cause?.name || '')`, without the question text. Register `{ method: 'POST', pattern: /^\/api\/chat\/?$/, handler: (req, res) => handlePostChat(req, res) }` in `ROUTES` (not `PUBLIC_ROUTES`), so it's behind `isAuthorized()` (FR-012).
- [X] T012 [P] [US1] Create `app/src/styles/chat.css` and add `@import url('/src/styles/chat.css');` to `app/src/styles/main.css` right after the existing `@import url('/src/styles/tabs.css');` line. Style per contracts/chat-panel-ui.md "Visual rules", using only tokens from `app/src/styles/tokens.css`:
  - `.chat-launcher`: fixed bottom-right (24px), pill (`--radius-pill`), `--accent-fill` background with `--accent-contrast` icon/text, min 56×56 px
  - `.chat-panel`: fixed, 380px wide, `max-height: min(600px, 100dvh - 120px)`, `--surface-raised`, `--border`, `--radius-card`, flex column; `[hidden]` hides it
  - `z-index: 900` for both (between header 100 and toast 1000)
  - `.chat-log`: scrollable, flex column, gap 12px
  - `.chat-msg`: `white-space: pre-wrap; overflow-wrap: anywhere`; `.chat-msg--coach` right-aligned with `--accent-tint`; `.chat-msg--assistant` left-aligned with `--surface` + `--border`
  - `.chat-greeting`: `--muted`
  - `.chat-thinking` with an animated dots keyframe, disabled under `@media (prefers-reduced-motion: reduce)`
  - `.chat-form`: textarea (`--radius-input`, 16px body font, 1–4 rows) + icon send button; `.chat-counter`: `--muted`, `--meta-size`
  - all buttons ≥ 44px touch targets
  - `@media (max-width: 480px)`: panel `left: 16px; right: 16px; width: auto; top: calc(var(--header-height) + 8px); bottom: 88px; max-height: none`, with no horizontal overflow
- [X] T013 [US1] Create `app/src/components/chat-panel.js`, exporting `mountChatPanel(root)`. Import `askCoach` from `../api-client.js` and `icon` from `../lib/icons.js`. Hold module-level state: `const messages = []` of ChatMessage `{ id, role: 'coach'|'assistant', text, status?: 'pending'|'answered'|'failed', sentAt }` (data-model.md), `let nextId = 1`, `let pending = null`. Build the DOM with `document.createElement` only; never assign message text to `innerHTML` (FR-010).
  - **Launcher**: `button.chat-launcher` with `icon('chat')`, `aria-label="Open coach assistant"`, `aria-controls="chat-panel"`, `aria-expanded`.
  - **Panel**: `section#chat-panel.chat-panel` with `role="dialog"`, `aria-label="Coach assistant"`, `hidden`. It holds a header (title "Coach assistant" + close button with `icon('close')`, `aria-label="Close"`), a `div.chat-log` with `role="log"` and `aria-live="polite"`, and a `form.chat-form`.
  - **Greeting**: the first child of the log is always a `p.chat-greeting` reading "Hi! I'm your fitness coach assistant. Ask me anything about training or nutrition."
  - **Form**: a `textarea` with `maxlength="1000"`, `rows="1"`, `aria-label="Ask the coach assistant"`, `placeholder="Ask about training or nutrition..."`, plus a submit button with `icon('send')` and `aria-label="Send"`.
  - **Toggling**: the launcher toggles `hidden` and `aria-expanded` and focuses the textarea on open. Close and `Esc` (keydown on the panel) hide the panel and focus the launcher.
  - **Send enabling**: Send is disabled when `textarea.value.trim() === ''` or `pending` is set (FR-007). `Enter` without Shift submits; `Shift+Enter` inserts a newline.
  - **Submit**: push a coach message with `status: 'pending'`, clear the textarea, then call `send(msg)`.
  - **`send(msg)`**: set `pending = { msg, controller: new AbortController() }`, re-render, then `await askCoach(msg.text, { signal: AbortSignal.any([AbortSignal.timeout(130000), pending.controller.signal]) })`. On success, set `msg.status = 'answered'` and push `{ role: 'assistant', text: answer }`. In all cases clear `pending` and re-render.
  - **`renderLog()`**: rebuild the bubbles from `messages`. Coach bubbles are `p.chat-msg.chat-msg--coach`, assistant bubbles `p.chat-msg.chat-msg--assistant`, text set via `textContent`. While a message is pending, show a `p.chat-thinking` reading "Thinking" with the animated dots after the last message.

  Error handling is left to US2 (T018): for now a rejected promise just sets `msg.status = 'failed'`.
- [X] T014 [US1] In `app/src/main.js`, import `mountChatPanel` from `./components/chat-panel.js`. In the existing `render().then(...)` callback, call `mountChatPanel(document.body)` next to `renderHeaderAccount(...)`, so it's mounted once, only after the first view has passed the sign-in gate, and outside `#app` (FR-001, research.md §7).

**Checkpoint**: `npm test` passes T008/T009. Manual quickstart checks 1–5 pass. This is the MVP.

---

## Phase 4: User Story 2 - Clear feedback when the assistant is slow or unavailable (Priority: P2)

**Goal**: Every failure (upstream error, unreachable, blank reply, 120 s timeout, not configured) produces a friendly error with Retry, and the question is never lost.

**Independent Test**: With the assistant service unreachable (or returning an error), send a question and confirm a friendly error with a Retry action appears and the question stays in the conversation (quickstart.md checks 8–10).

### Tests for User Story 2 ⚠️ write first, confirm they fail

- [X] T015 [P] [US2] Extend `app/tests/integration/coach-chat.test.js` with failure mappings (each asserts status and `error` code):
  - stub `500` → `502 chatbot_unavailable`
  - stub `200 {"response":"   "}` → `502`
  - stub `200 {}` → `502`
  - stub `200` with a non-JSON body (`'oops'`) → `502`
  - `CHATBOT_URL=http://localhost:9/chat` (connection refused) → `502`
  - `CHATBOT_URL` deleted → `503 chatbot_not_configured`
  - timeout: call `setChatTimeoutForTests(200)`, have the stub wait 1000 ms before replying, and expect `504 chatbot_timeout`; reset with `setChatTimeoutForTests(null)` in `t.after`

  Each failure body's `message` must equal the exact strings in contracts/chat-api.md.
- [X] T016 [P] [US2] In `app/tests/integration/coach-chat.test.js`, add a signed-out test following `app/tests/integration/coach-auth.test.js`: set `process.env.COACH_AUTH_DISABLED = 'false'` and `SESSION_SECRET` before `startTestServer`, then `POST /api/chat` with no cookie → `401`, and the stub received no request (SC-006). Restore the env in `t.after`.

### Implementation for User Story 2

- [X] T017 [US2] In `app/server/lib/coach-chat.js`, finish the error mapping in `askCoachChatbot` (research.md §4):
  - wrap `fetch` in try/catch: `err.name === 'TimeoutError'` (or `'AbortError'`) → throw `new ChatbotError('chatbot_timeout', { cause: err })`; any other fetch error → `new ChatbotError('chatbot_unavailable', { cause: err })`
  - `!res.ok` → `chatbot_unavailable`, with the cause carrying the upstream status
  - JSON parse failure → `chatbot_unavailable`
  - `response` missing, non-string or blank → `chatbot_unavailable`

  Make sure the `ChatbotError` constructor accepts `(code, options)` and passes `options` to `super(code, options)`. No automatic retries.
- [X] T018 [US2] In `app/src/components/chat-panel.js`, add the failed state (contracts/chat-panel-ui.md "Behavior"):
  - in `send(msg)`'s catch: if the error is an `AbortError` from Clear chat (`pending.controller.signal.aborted`), do nothing; otherwise set `msg.status = 'failed'`. This includes a `TimeoutError` from the 130 s client signal and any `ApiError` other than 401, which `api-client.js` already handles.
  - in `renderLog()`, directly after a failed coach bubble, render `div.chat-error` with `icon('warning-circle')`, the fixed text "The coach assistant is unavailable right now. Try again." (never the server's message), and a `button.chat-retry` with `icon('retry')` and the label "Retry"
  - Retry is disabled while another message is pending. Clicking it sets `msg.status = 'pending'` and `msg.sentAt = new Date()`, then calls `send(msg)` on the **same** message object, so no duplicate bubble is added (Story 2 #4)
  - the submit button shows as disabled and the textarea stays editable while pending (Story 2 #1)
- [X] T019 [P] [US2] In `app/src/styles/chat.css`, style `.chat-error`: `--danger` text on `--danger-tint` with a `--danger-border` border, `--radius-input`, inline icon. `.chat-retry` is a small pill button, ≥ 44px tall.

**Checkpoint**: The integration suite covers every row of the contracts/chat-api.md response table. Quickstart checks 8–10 pass.

---

## Phase 5: User Story 3 - Keep the conversation while working (Priority: P3)

**Goal**: The conversation survives panel close/open and screen changes for the page load, can be cleared, and always scrolls to the newest message.

**Independent Test**: Ask two questions, close the panel, switch to another client, reopen the panel, and confirm both questions and answers are still there; then click "Clear chat" and confirm the conversation is empty (quickstart.md checks 6–7).

### Implementation for User Story 3

- [X] T020 [US3] In `app/src/components/chat-panel.js`, add a "Clear chat" text button to the panel header, before the close button. On click: if `pending` is set, call `pending.controller.abort()` and set `pending = null`; then empty `messages` (`messages.length = 0`) and re-render, so only the greeting shows (Story 3 #2). A late response for an aborted message must not be appended: check `pending?.msg === msg` before applying a result in `send()`. Hide or disable Clear chat when `messages` is empty.
- [X] T021 [US3] In `app/src/components/chat-panel.js`, after every `renderLog()` and when the panel opens, scroll the log to the bottom (`log.scrollTop = log.scrollHeight`), so the newest message or the Thinking indicator is visible (Story 3 #3). Also guard `mountChatPanel` so a second call is a no-op (a module-level `mounted` flag), so the panel and its `messages` survive any re-run of `main.js`'s render path (FR-011). Confirm that `main.js`'s `hashchange` → `render()` only touches `#app` and `#sidebar`, not the panel.
- [X] T022 [P] [US3] In `app/src/styles/chat.css`, style the header's Clear chat button as a quiet text button (`--muted`, hover `--ink`, ≥ 44px target), and make sure the header lays out title / Clear chat / Close on one row at 375px width.

**Checkpoint**: All three stories work independently. Quickstart checks 1–12 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T023 [P] Update `app/README.md`:
  - in "Local development setup" step 4, add `CHATBOT_URL=https://8000-<id>.cloudspaces.litng.ai/chat` to the `.env.local` example, noting it's the Lightning AI chatbot endpoint
  - in "Deploying to Vercel" step 1, add `CHATBOT_URL` to the env var list and note that Fluid compute must be on for `maxDuration: 130`
  - in "Architecture notes", add one bullet: `/api/chat` proxies to `CHATBOT_URL` behind the coach gate, adds the coaching instruction on the server, and nothing is stored (see `specs/013-fitness-coach-chatbot/`)
- [X] T024 [P] Accessibility pass on `app/src/components/chat-panel.js` against contracts/chat-panel-ui.md: `aria-expanded` stays in sync, focus returns to the launcher on close, the live region announces answers and errors, and all controls are reachable by keyboard in DOM order (Clear chat → Close → Retry → textarea → Send). Fix any gaps.
- [X] T025 Run `cd app && npm test` and `cd app && npm run build`; both must pass with no new warnings.
- [ ] T026 _(Partly done 2026-09-25: the 20-question length check passed at 18/20 against the real endpoint via `/api/chat`, and the API paths behind checks 3, 4 and 10 were checked with curl. Browser checks 1–12 still need a person: Playwright had no Chrome installed.)_ Run the manual validation table in `specs/013-fitness-coach-chatbot/quickstart.md` (checks 1–12) with `npm run dev` against the real Lightning AI endpoint, then the 20-question answer-length check (SC-002/SC-003: ≥ 18/20 answers ≤ 4 sentences / 80 words and on-topic). If it misses, tune only `COACH_INSTRUCTION` in `app/server/lib/coach-chat.js` and update the matching string in `data-model.md` and `contracts/chat-api.md`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies. T001–T003 are independent files.
- **Foundational (Phase 2)**: T004 → T005, T006 (same file, in order). T007 is independent (different file). This phase blocks all stories.
- **US1 (Phase 3)**: needs Phase 2. It is the MVP.
- **US2 (Phase 4)**: needs US1's route (T011), `askCoachChatbot` (T010) and the panel (T013), because it refines both.
- **US3 (Phase 5)**: needs US1's panel (T013). It doesn't depend on US2, so US2 and US3 can proceed in parallel after US1 (they both edit `chat-panel.js`, so if two people work on them, merge carefully).
- **Polish (Phase 6)**: after the stories you intend to ship.

### Within stories

- Tests (T008, T009 / T015, T016) are written first and must fail before implementing.
- Server: T010 → T011. Client: T012 ∥ T013 → T014.
- US2: T017 (server) ∥ T018 (client) ∥ T019 (css).
- US3: T020 → T021 (same file); T022 in parallel.

### Story dependency graph

```text
Setup (T001–T003) ─▶ Foundational (T004–T007) ─▶ US1 (T008–T014) ─┬─▶ US2 (T015–T019) ─┐
                                                                  └─▶ US3 (T020–T022) ─┴─▶ Polish (T023–T026)
```

---

## Parallel Examples

### Phase 1

```text
T001 app/.env.example   ∥   T002 app/vercel.json   ∥   T003 app/src/lib/icons.js
```

### User Story 1

```text
Tests:        T008 tests/unit/coach-chat.test.js   ∥   T009 tests/integration/coach-chat.test.js
Then server:  T010 → T011                          ∥   Client: T012 chat.css  ∥  T013 chat-panel.js → T014 main.js
```

### User Story 2

```text
Tests:  T015 ∥ T016 (same file — sequence them if one person edits)
Impl:   T017 server/lib/coach-chat.js   ∥   T018 components/chat-panel.js   ∥   T019 styles/chat.css
```

### User Story 3

```text
T020 → T021 components/chat-panel.js   ∥   T022 styles/chat.css
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1): the coach can ask and get a short answer.
3. **Stop and validate**: `npm test`, then quickstart checks 1–5. This is deployable on its own (set `CHATBOT_URL` in Vercel).

### Incremental delivery

1. MVP (US1): a working chat for the happy path.
2. \+ US2: robust failures and Retry. Recommended before real-world use, because the upstream is an external Lightning AI space that can sleep.
3. \+ US3: comfortable multi-question use with Clear chat.
4. Polish: docs, accessibility, full quickstart run and prompt tuning.

---

## Notes

- There are no DB, migration or `customers/` changes anywhere in this feature (constitution: Customer Data Standards).
- Only the coach's typed text and `COACH_INSTRUCTION` ever leave the app (FR-014). Never add customer context to the upstream payload.
- Commit after each task or logical group, and stop at any checkpoint to validate a story on its own.
