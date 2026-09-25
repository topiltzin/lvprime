# Quickstart: Fitness Coach Chatbot

**Feature**: [spec.md](./spec.md) | **Contracts**: [chat-api.md](./contracts/chat-api.md), [chat-panel-ui.md](./contracts/chat-panel-ui.md)

## Prerequisites

- The existing app runs locally (`app/README.md` steps 1–6).
- The Lightning AI chatbot is running. Check it directly:

  ```bash
  curl -s -X POST "https://8000-01m3cags23heagcw7bk8nz057w.cloudspaces.litng.ai/chat" \
    -H 'Content-Type: application/json' \
    -d '{"message":"Beginner diet tips?","max_tokens":200}'
  # expect: {"response":"..."}
  ```

## Setup

Add to `app/.env.local` (and document it in `app/.env.example` without the real value):

```bash
CHATBOT_URL=https://8000-01m3cags23heagcw7bk8nz057w.cloudspaces.litng.ai/chat
```

Then run `cd app && npm run dev`.

## Automated checks

```bash
cd app
npm test                                   # includes tests/unit/coach-chat.test.js
node --test tests/integration/coach-chat.test.js
```

Expected: all pass without calling Lightning AI. The integration test uses a local stub for the upstream and covers 200, upstream 500, blank `response`, timeout → 504, missing `CHATBOT_URL` → 503, 422 validation, and 401 when signed out.

## Manual validation

| # | Steps | Expected | Covers |
|---|---|---|---|
| 1 | Open the app signed out | Sign-in page shows and there's **no** chat launcher | FR-001 |
| 2 | Sign in, click the launcher | Panel opens with greeting, focus in the textarea | Story 1 #1 |
| 3 | Send "Beginner diet tips?" | Question shows right away, "Thinking...", then a short coach-voice answer (≤ ~4 sentences); the instruction text never appears | Story 1 #2–5, FR-006 |
| 4 | DevTools → Network → `/api/chat` request | Payload is `{"message":"Beginner diet tips?"}` only; no Lightning URL visible in any browser request | FR-004, FR-012 |
| 5 | Ask a question whose answer has a list; also try `<b>hi</b>` as a question | Line breaks kept; tags shown as literal text, not bold | FR-010 |
| 6 | Ask two questions, close panel, open a client, reopen | Both Q&A pairs still there, newest in view | Story 3 #1, #3 |
| 7 | Click Clear chat | Only the greeting remains | Story 3 #2 |
| 8 | Set `CHATBOT_URL` to `http://localhost:9/chat`, restart, send | Error "The coach assistant is unavailable right now. Try again." + Retry; question kept | Story 2 #2 |
| 9 | Restore the URL, click Retry | Same question resent, answer appears, no duplicate bubble | Story 2 #4 |
| 10 | Remove `CHATBOT_URL`, restart, send | Same friendly error with Retry | research §4 |
| 11 | Resize to 375 px wide | Panel full-width, no horizontal scroll, launcher reachable | FR-015 |
| 12 | Toggle OS dark mode | Panel follows the app theme | FR-015 |

Answer-length check (SC-002/SC-003): send 20 typical questions (diet, warm-ups, soreness, sleep, beginner splits...) and count answers of ≤ 4 sentences / 80 words that stay on fitness topics. Target is ≥ 18 of 20 for each. If it misses, tune `COACH_INSTRUCTION` in `app/server/lib/coach-chat.js`.

## Deploy (Vercel)

1. Add `CHATBOT_URL` to the Vercel project's Environment Variables (Production and Preview).
2. Make sure Fluid compute is on (Project → Settings → Functions), so `maxDuration: 130` in `app/vercel.json` is accepted. See research §3.
3. Deploy, sign in on the deployed URL, and repeat manual checks 2–4.
4. Check that `curl -X POST https://<deployment>/api/chat -d '{"message":"hi"}'` without a cookie returns `401` (SC-006).
