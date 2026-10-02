# Data Model: Gemini Chatbot Option

No stored data changes. One configuration entity:

**Chatbot service selection** (environment)

| Setting | Applies to | Required | Default |
|---|---|---|---|
| `CHATBOT_PROVIDER` | all | no | `lightning` |
| `CHATBOT_URL` | lightning | yes | none |
| `CHATBOT_API_KEY` | lightning | no | none |
| `GEMINI_API_KEY` | gemini | yes | none |
| `GEMINI_MODEL` | gemini | no | `gemini-3.8-flash` |
| `GEMINI_API_URL` | gemini | no | `https://generativelanguage.googleapis.com/v1beta/interactions` |

Rules: unknown `CHATBOT_PROVIDER`, or a missing required setting for the selected provider → `chatbot_not_configured`.
