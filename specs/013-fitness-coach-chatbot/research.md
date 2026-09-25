# Research: Fitness Coach Chatbot

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-25

The Technical Context had no open NEEDS CLARIFICATION items: the stack is fixed by the existing app, and the external chatbot's contract comes from the user's example. The decisions below settle how the feature fits into that stack.

## 1. Where the chatbot call happens: server-side proxy, not the browser

- **Decision**: Add an authenticated route `POST /api/chat` to `app/server/index.js`. The browser sends only the coach's question to it. The server adds the coaching instruction, calls the external chatbot, and returns the answer.
- **Rationale**:
  - FR-012 / SC-006: the route sits behind the existing `isAuthorized()` gate, so only signed-in coaches can reach the chatbot through the app. The external URL never ships in the browser bundle.
  - FR-013: the URL is a server env var (`CHATBOT_URL`), configurable per environment like `SUPABASE_URL`.
  - FR-004 / FR-006: the instruction is added on the server, so it can't be dropped or changed from the browser and never appears in the UI.
  - CORS: the Lightning AI endpoint's CORS policy is unknown. A same-origin call to `/api/chat` avoids the question entirely (`api-client.js` is already "same-origin, no CORS").
- **Alternatives considered**:
  - *Browser calls the Lightning URL directly* (`VITE_CHATBOT_URL`): rejected. It exposes the URL publicly, lets anyone skip the sign-in gate, and depends on the upstream's CORS headers.
  - *A separate Vercel function (`api/chat.js`)*: rejected. The project routes all `/api/*` traffic through one function (`vercel.json` rewrite → `api/index.js`) with in-process routing, and a second entry point would break that pattern.

## 2. Prompt shape: instruction prepended to the message

- **Decision**: The upstream takes one free-text `message`, so the server sends:

  ```text
  You are a fitness coach ready to help. Answer in 2-4 short sentences or at most 4 short bullet points. Question: <coach's question>
  ```

  It also sends `max_tokens: 200` as a hard length cap (FR-005). Both live as constants in `app/server/lib/coach-chat.js` (`COACH_INSTRUCTION`, `MAX_TOKENS`).
- **Rationale**: The example API has no separate `system` field, so the instruction has to go into `message`. The user asked for "a sentence like 'you are a fitness coach ready to help'" and short answers, so the wording states both. "2–4 sentences" gives the model a concrete target that matches SC-002 (≤ 4 sentences / 80 words). 200 tokens is roughly 150 words: a backstop above the target, not the target itself.
- **Alternatives considered**:
  - *Adding a `system` field to the payload*: rejected, because the upstream contract in the spec doesn't support it.
  - *Making the instruction or max tokens env-configurable*: rejected for v1 (YAGNI). Tuning is a one-line constant change, and the spec says the wording "can be tuned during planning".
  - *Trimming long answers on the server*: rejected, because cutting mid-sentence reads worse than a slightly long answer. `max_tokens` already bounds length.

## 3. Timeouts: 120 s upstream, a little more in the browser, a function limit above both

- **Decision**:
  - Server → upstream: `fetch(..., { signal: AbortSignal.timeout(120_000) })`. On abort it returns `504 chatbot_timeout` (FR-008).
  - Browser → `/api/chat`: `AbortSignal.timeout(130_000)` as a safety net if the server response is lost. On abort, the panel shows the same error-with-Retry state.
  - Vercel: set `functions["api/index.js"].maxDuration = 130` in `app/vercel.json`, so the platform doesn't kill the function before the 120 s upstream timeout returns its friendly 504.
- **Rationale**: SC-005 requires an error with Retry within 121 s. The server timeout fires at 120 s and answers right away. The larger browser and platform limits only matter if something else fails. Node ≥ 22 (the project's engine) has global `fetch` and `AbortSignal.timeout`, so no new dependency is needed.
- **Platform note**: With Fluid compute (the default for Vercel projects since 2025), 130 s is within every plan's limit. If this project still runs on legacy non-Fluid Hobby functions (60 s max), the deploy rejects `maxDuration: 130`. Then turn on Fluid compute in Project → Settings → Functions. See the [quickstart](./quickstart.md) deploy step.
- **Alternatives considered**: *Streaming the answer*: rejected. The upstream returns one JSON body (`data["response"]`), so there is nothing to stream.

## 4. Error mapping

- **Decision**: `/api/chat` turns every upstream failure into a distinct status with a coach-readable `message`:

  | Upstream outcome | `/api/chat` response |
  |---|---|
  | 2xx with a non-empty string `response` | `200 { answer }` |
  | 2xx but `response` missing, non-string or blank | `502 chatbot_unavailable` (spec Story 2, scenario 5) |
  | non-2xx status | `502 chatbot_unavailable` |
  | network error / DNS / connection refused | `502 chatbot_unavailable` |
  | no answer within 120 s | `504 chatbot_timeout` |
  | `CHATBOT_URL` not set | `503 chatbot_not_configured` |

  The panel shows one friendly message for all of them ("The coach assistant is unavailable right now. Try again.") plus Retry (FR-009). The server logs the status code and error class, never the question text.
- **Rationale**: One UI message keeps the panel simple, as the spec asks. Distinct codes still make server logs and tests precise. `503 chatbot_not_configured` separates a deploy mistake from an upstream outage.
- **Alternatives considered**: *Passing the upstream error text to the coach*: rejected. It is technical, may leak internals, and the spec calls for a friendly message.

## 5. Conversation state: module-level, in memory, per page load

- **Decision**: The conversation is an in-memory array in `app/src/components/chat-panel.js`. The panel is mounted once on `document.body`, outside `#app`, so hash-route changes (`main.js` re-renders `#app` only) don't touch it. A page reload or leaving the app clears it (FR-011, spec Assumptions).
- **Rationale**: The spec says chats are not saved. The SPA never reloads between screens, so a module variable is enough. No `localStorage` means no stored coach questions on shared machines.
- **Alternatives considered**: *`sessionStorage`*: rejected. It would outlive the post-sign-in reload that `main.js` does, which isn't asked for, and adds storage-failure handling for no gain.

## 6. Safe rendering of answers

- **Decision**: Render every message with `textContent` inside an element styled `white-space: pre-wrap` (FR-010). Don't use `marked` or `innerHTML`.
- **Rationale**: Answers are untrusted model output. `textContent` can't inject markup, and `pre-wrap` keeps line breaks and "- item" lists readable. `safe-html.js`/DOMPurify exists but is only needed when rendering HTML, which this feature doesn't do.
- **Alternatives considered**: *Rendering answers as Markdown via `marked` + DOMPurify*: rejected for v1. Short answers rarely need rich formatting, and plain text removes a whole class of rendering bugs.

## 7. Mounting only for signed-in coaches

- **Decision**: `main.js` mounts the chat panel in the same place it mounts the header account area: after the first `render()` resolves, i.e. after the view has passed the sign-in gate (FR-001). The login screen replaces `#app` and then reloads the page, so the panel never exists on the sign-in page.
- **Rationale**: This reuses the existing "gate passed" signal. No new session check is needed.

## 8. Testing approach

- **Decision**:
  - *Unit* (`tests/unit/coach-chat.test.js`): `buildCoachMessage()` prepends the instruction and keeps the question verbatim, and `validateChatQuestion()` enforces 1–1,000 non-blank chars.
  - *Integration* (`tests/integration/coach-chat.test.js`): start a stub HTTP server on port 0 and point `CHATBOT_URL` at it. Cover: success, upstream 500, blank `response`, slow upstream (with a short timeout set through a test hook, `setChatTimeoutForTests`, like `setSignInForTests` in `auth.js`), missing `CHATBOT_URL`, validation 422, and 401 when signed out. The stub also asserts the payload it received (`message` starts with the instruction, `max_tokens === 200`).
- **Rationale**: Matches the project's `node --test` setup and existing helpers (`startTestServer`). A real local HTTP stub exercises the actual `fetch` path without calling Lightning AI in CI.
