# Quickstart: Gemini Chatbot Option

Prerequisites: `app/.env.local` with Supabase settings; a Gemini API key.

1. **Default unchanged**: leave `CHATBOT_PROVIDER` unset, keep `CHATBOT_URL`; `cd app && npm test` passes; chat works as before.
2. **Gemini**: set `CHATBOT_PROVIDER=gemini` and `GEMINI_API_KEY=...`, restart (`npm start`), sign in, ask a question in the chat panel → short Spanish answer.
3. **Memory**: end the conversation (existing flow) → notes saved; next conversation reflects them.
4. **Misconfiguration**: unset `GEMINI_API_KEY`, or set `CHATBOT_PROVIDER=foo` → the chat shows the not-configured message; no answer from the other service.
5. **Direct check** (optional): the curl in the feature request returns a `model_output` step with the answer text.
