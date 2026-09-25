# Data Model: Fitness Coach Chatbot

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-25

Nothing is saved. There are no database tables, migrations or customer-file changes. All entities live in browser memory for one page load, or exist only for the length of one request.

## ChatMessage (browser, in memory)

One item in the conversation shown in the panel.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique within the page load (a counter works). Used to find the message on Retry. |
| `role` | `'coach' \| 'assistant'` | Coach messages are the typed questions; assistant messages are answers. |
| `text` | string | Coach: trimmed question, 1–1,000 chars. Assistant: the answer as returned, rendered as plain text. Never contains the coaching instruction (FR-006). |
| `status` | `'pending' \| 'answered' \| 'failed'` | Only on coach messages. See transitions below. |
| `sentAt` | Date | Time the coach sent it (or last retried it). |

### Coach message state transitions

```text
          send                 200 { answer }
(typed) ───────▶ pending ─────────────────────▶ answered   (+ assistant message appended after it)
                   │  ▲
  4xx/5xx/timeout/ │  │ Retry (same text, sentAt updated)
  network error    ▼  │
                 failed
```

- Only one coach message can be `pending` at a time (FR-007). Send is disabled while one is pending.
- `failed` shows the friendly error and the Retry action under that message (FR-009). Retry moves the **same** message back to `pending`; it doesn't add a duplicate.
- A `422` from the server (e.g. text over the limit because of a stale page) also ends in `failed`. Client-side validation normally prevents it.

## Conversation (browser, in memory)

- An ordered array of `ChatMessage`, oldest first, held in a module-level variable in `app/src/components/chat-panel.js`.
- Lifetime: the page load. It survives hash-route changes and panel open/close (FR-011). A reload, sign-out or closed tab clears it.
- **Clear chat** empties the array and shows the greeting again. The greeting is a fixed UI element, not a `ChatMessage`. If a request is pending, Clear chat aborts it (the late answer is ignored).

## ChatRequest / ChatResponse (wire, per request)

See [contracts/chat-api.md](./contracts/chat-api.md) for exact shapes.

- **ChatRequest** (browser → app server): `{ message }`, the coach's question only.
- **UpstreamChatRequest** (app server → chatbot): `{ message: COACH_INSTRUCTION + question, max_tokens: 200 }`.
- **ChatResponse** (app server → browser): `{ answer }` on success, or `{ error, message }` on failure.

## Coaching instruction (server constant)

| Name | Value | Where |
|---|---|---|
| `COACH_INSTRUCTION` | `You are a fitness coach ready to help. Answer in 2-4 short sentences or at most 4 short bullet points. Question: ` | `app/server/lib/coach-chat.js` |
| `MAX_TOKENS` | `200` | same |
| `UPSTREAM_TIMEOUT_MS` | `120000` | same (overridable only in tests) |
| `MAX_QUESTION_CHARS` | `1000` | same, and mirrored in the panel's `maxlength` |

## Configuration (server env)

| Variable | Required | Meaning |
|---|---|---|
| `CHATBOT_URL` | Yes, to use the chat | Full URL of the upstream `/chat` endpoint, e.g. `https://8000-….cloudspaces.litng.ai/chat`. When unset, `/api/chat` returns `503 chatbot_not_configured`. |
