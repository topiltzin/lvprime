# Implementation Plan: Gemini Chatbot Option

**Branch**: `014-gemini-chatbot-option` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-gemini-chatbot-option/spec.md`

## Summary

Add a `CHATBOT_PROVIDER` setting (`lightning` default, `gemini`) to the existing chatbot proxy so the same chat and memory-summary calls can go to Google's Interactions API. The proxy builds one shared upstream body; a per-provider step turns it into the provider's request and extracts the answer. The `lightning` path is untouched. The code change is already in `app/server/lib/coach-chat.js` and `app/.env.example`; remaining work is tests and docs.

## Technical Context

**Language/Version**: Node.js (ES modules, built-in `fetch`/`AbortSignal.timeout`)

**Primary Dependencies**: None added

**Storage**: N/A (memory notes stay in Supabase via `lib/chat-memory.js`, unchanged)

**Testing**: `node --test` (`app/tests/unit/coach-chat.test.js`, `app/tests/integration/coach-chat.test.js` with a local stub upstream)

**Target Platform**: Existing Node server / Vercel deployment

**Project Type**: web-service (single `app/` project)

**Performance Goals**: Answer in under 30 s typical; existing 120 s upstream timeout kept

**Constraints**: Keys/URLs never reach the browser; question/answer text never logged; no fallback between providers

**Scale/Scope**: One module, one env-var set

## Constitution Check

The constitution governs customer markdown files and the coaching workflow (`program.md`, `feedback.md`, `notes.md`). This feature touches none of them.

- I. Content & Program Quality: N/A, no program files written.
- II. Verify-Before-Save: N/A for customer files; the feature is verified by tests and the quickstart.
- III. UX Consistency: PASS. Same chat panel, same Spanish coaching voice and error messages.
- IV. Performance: PASS. No extra calls per question.
- Customer Data Standards: PASS. No customer data stored or logged by this change.

Post-design re-check: still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/014-gemini-chatbot-option/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── provider-config.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── .env.example                      # new settings documented
├── README.md                         # chatbot paragraph mentions providers
├── server/lib/coach-chat.js          # provider selection, request build, answer extraction
└── tests/
    ├── unit/coach-chat.test.js       # provider selection + Gemini parsing cases
    └── integration/coach-chat.test.js # Gemini path against stub
```

**Structure Decision**: Keep everything inside `coach-chat.js`; the handler (`server/handlers/chat.js`) and memory code already depend only on `askCoachChatbot`/`summarizeIntoNotes`.

## Complexity Tracking

No violations.
