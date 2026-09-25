# Contract: Coach Chat API

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md) §1–4

## `POST /api/chat` (app server, coach session required)

Sends one coach question to the fitness coach chatbot and returns a short answer. It is registered in `ROUTES` in `app/server/index.js`, so it sits behind `isAuthorized()`, like every non-public route.

### Request

```http
POST /api/chat
Content-Type: application/json
Cookie: <coach session cookie>

{ "message": "Beginner diet tips?" }
```

| Field | Type | Rules |
|---|---|---|
| `message` | string | Required. Trimmed length 1–1,000 characters. |

Any other fields are ignored. The client can't send `max_tokens` or an instruction.

### Responses

| Status | Body | When |
|---|---|---|
| `200` | `{ "answer": "Start with protein at every meal..." }` | The upstream returned 2xx with a non-empty string `response`. `answer` is that string, trimmed. |
| `401` | `{ "error": "unauthorized", "message": "Sign in to continue." }` | No valid coach session (existing gate). |
| `413` | `{ "error": "payload_too_large" }` | Body over the existing 1 MB limit. |
| `422` | `{ "error": "validation_failed", "fields": { "message": "Enter a question." } }` | `message` missing, not a string, or blank after trim. |
| `422` | `{ "error": "validation_failed", "fields": { "message": "Keep questions under 1000 characters." } }` | Trimmed `message` longer than 1,000 chars. |
| `422` | `{ "error": "validation_failed", "fields": { "body": "invalid JSON" } }` | Body isn't valid JSON (same as the other POST handlers). |
| `502` | `{ "error": "chatbot_unavailable", "message": "The coach assistant is unavailable right now. Try again." }` | Upstream non-2xx, network/DNS/connection error, non-JSON body, or 2xx with `response` missing/non-string/blank. |
| `503` | `{ "error": "chatbot_not_configured", "message": "The coach assistant is not set up yet." }` | `CHATBOT_URL` is not set. |
| `504` | `{ "error": "chatbot_timeout", "message": "The coach assistant took too long to answer. Try again." }` | No upstream response within 120 s. |

### Guarantees

- The request body forwarded upstream is built only on the server (see below). The browser's text goes in only as the question part.
- The server never logs the question or answer text, only the outcome (status code or error class).
- One upstream call per `/api/chat` request. No automatic retries: Retry is the coach's choice (FR-009).

## Upstream call (app server → chatbot)

Configured by `CHATBOT_URL` (e.g. `https://8000-01m3cags23heagcw7bk8nz057w.cloudspaces.litng.ai/chat`).

```http
POST ${CHATBOT_URL}
Content-Type: application/json

{
  "message": "You are a fitness coach ready to help. Answer in 2-4 short sentences or at most 4 short bullet points. Question: Beginner diet tips?",
  "max_tokens": 200
}
```

Expected success: `200 { "response": "<answer text>" }`. Timeout: 120 s (`AbortSignal.timeout`). Mapping of every other outcome is in the table above and in [research §4](../research.md#4-error-mapping).

## Client function (`app/src/api-client.js`)

```js
/** POST /api/chat → { answer }. Throws ApiError on any non-2xx; aborts after 130 s. */
export function askCoach(message, { signal } = {})
```

- Uses the shared `request()` helper, so a `401` triggers the usual sign-in takeover.
- `request()` gains a pass-through for `signal` (it already spreads `options` into `fetch`). The panel passes a signal combining `AbortSignal.timeout(130_000)` with its own `AbortController`, which Clear chat uses.
