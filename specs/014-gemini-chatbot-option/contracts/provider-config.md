# Contract: Provider selection and upstream calls

The browser-facing `POST /api/chat` contract is unchanged (see `specs/013-fitness-coach-chatbot/contracts/chat-api.md`).

## Error mapping (unchanged codes)
| Situation | Code |
|---|---|
| Unknown provider, missing URL/key | `chatbot_not_configured` |
| Network error, non-2xx, bad JSON, empty answer | `chatbot_unavailable` |
| Timeout | `chatbot_timeout` |

## lightning (default)
Unchanged: POST to `CHATBOT_URL`, optional `Authorization: Bearer`, body `{ system, messages, message, max_tokens }`, answer in `response`.

## gemini
```
POST $GEMINI_API_URL
Content-Type: application/json
x-goog-api-key: $GEMINI_API_KEY
Api-Revision: 2026-05-20

{ "model": "$GEMINI_MODEL", "input": "<system prompt + notes + history + question>" }
```
Answer: concatenated `text` of `steps[]` where `type == "model_output"`.
