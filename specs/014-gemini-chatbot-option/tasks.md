---

description: "Task list for Gemini Chatbot Option"
---

# Tasks: Gemini Chatbot Option

**Input**: Design documents from `/specs/014-gemini-chatbot-option/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/provider-config.md

**Tests**: Included (plan.md lists unit and integration test files). Run with `cd app && npm test`.

**Format**: `- [ ] [TaskID] [P?] [Story?] Description with file path`

## Phase 1: Setup

- [x] T001 Document `CHATBOT_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_API_URL` in `app/.env.example` (FR-010)
- [x] T002 [P] Mention the Gemini option in the coach chatbot paragraph of `app/README.md`

## Phase 2: Foundational

- [x] T003 In `app/server/lib/coach-chat.js`, split `callChatbot` into `chatbotProvider()` (default `lightning`, trimmed/lowercased, unknown → `ChatbotError('chatbot_not_configured')`), `buildRequest(provider, body)` and `extractAnswer(provider, data)`; keep the lightning request/response byte-for-byte identical (FR-001, FR-006, FR-007)

## Phase 3: User Story 1 - Switch the coach assistant to Gemini (P1)

**Goal**: With `CHATBOT_PROVIDER=gemini` and a key, chat answers and memory summaries come from Gemini.

**Independent Test**: Quickstart steps 2–3.

- [x] T004 [US1] In `app/server/lib/coach-chat.js`, implement the gemini branch of `buildRequest`: POST to `GEMINI_API_URL` (default `https://generativelanguage.googleapis.com/v1beta/interactions`) with headers `x-goog-api-key` and `Api-Revision: 2026-05-20`, body `{ model: GEMINI_MODEL || 'gemini-3.8-flash', input }` where `input` = system prompt + memory notes + history turns + question, no token cap (FR-002–FR-005)
- [x] T005 [US1] In `app/server/lib/coach-chat.js`, implement the gemini branch of `extractAnswer`: join `text` parts of `steps[]` entries with `type: "model_output"`, ignore `thought` steps, trim (FR-008)
- [x] T006 [P] [US1] Add unit tests in `app/tests/unit/coach-chat.test.js`: Gemini answer extraction (thought step ignored, multiple text parts joined, no `model_output` → empty)
- [x] T007 [US1] Add integration tests in `app/tests/integration/coach-chat.test.js` using the local stub with `CHATBOT_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_API_URL` pointing at the stub: `POST /api/chat` returns the trimmed answer, stub receives `x-goog-api-key`, `Api-Revision` and an `input` containing the question; clean up env vars in `t.after`

## Phase 4: User Story 2 - Existing chatbot unchanged (P1)

**Goal**: Unset or `lightning` behaves exactly as before.

**Independent Test**: `cd app && npm test` passes with no new env vars.

- [x] T008 [US2] Add an integration test in `app/tests/integration/coach-chat.test.js` that `CHATBOT_PROVIDER=" Lightning "` still hits `CHATBOT_URL` with the existing body shape (SC-002)
- [x] T009 [US2] Run `cd app && npm test` and confirm all pre-existing tests still pass

## Phase 5: User Story 3 - Clear failure when misconfigured (P2)

**Goal**: Bad selection or missing settings give `chatbot_not_configured`, never a fallback.

**Independent Test**: Quickstart step 4.

- [x] T010 [P] [US3] Add integration tests in `app/tests/integration/coach-chat.test.js`: Gemini selected without `GEMINI_API_KEY` → 503 `chatbot_not_configured` and the stub for `CHATBOT_URL` receives no request; `CHATBOT_PROVIDER=foo` → 503 `chatbot_not_configured`
- [x] T011 [P] [US3] Add an integration test in `app/tests/integration/coach-chat.test.js`: Gemini reply with no `model_output` text → 502 `chatbot_unavailable`

## Phase 6: Polish

- [x] T012 Run `cd app && npm test` in full
- [ ] T013 Run quickstart.md step 5 (real curl / one live chat with a real `GEMINI_API_KEY`) to verify the request/response shape against the live API; if it differs, adjust `buildRequest`/`extractAnswer` in `app/server/lib/coach-chat.js`

## Dependencies

- T003 → T004, T005 → T006, T007 → T008–T011 → T012 → T013
- US2 and US3 depend only on T003–T005; they can run in parallel with each other.
- T001–T005 are already implemented in the working tree (uncommitted).

## Parallel Examples

- T001 ‖ T002
- T006 ‖ T010 ‖ T011 (T006 is a different file; T010/T011 touch the same file, so write them in one pass)

## Implementation Strategy

MVP = Phases 1–3 (already coded; remaining work is T006–T007). Then add US2/US3 tests, run the full suite, and finish with the live API check (T013), which is the only step that verifies the unconfirmed Gemini format.
