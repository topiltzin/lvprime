# Implementation Plan: Fitness Coach Chatbot

**Branch**: `013-fitness-coach-chatbot` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-fitness-coach-chatbot/spec.md`

## Summary

Add a floating "Coach assistant" chat panel for signed-in coaches. The browser sends only the coach's question to a new authenticated route, `POST /api/chat`. The server adds a fixed instruction ("You are a fitness coach ready to help. Answer in 2-4 short sentences...") and forwards it with `max_tokens: 200` to the Lightning AI chatbot at `CHATBOT_URL`, with a 120 s timeout. It returns `{ answer }` or a clearly mapped error. The panel keeps the conversation in memory for the page load, renders answers as plain text, and offers Retry and Clear chat. There are no database, customer-file or new-dependency changes.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js ≥ 22.5 (server; global `fetch`, `AbortSignal.timeout`), modern browsers (client)

**Primary Dependencies**: Existing only: Vite 8 (dev server + build), `@phosphor-icons/core` (icons). No new packages.

**Storage**: N/A. The conversation lives in browser memory only; nothing goes to Supabase or `customers/`.

**Testing**: `node --test` (`npm test`): unit tests in `app/tests/unit/`, and integration tests in `app/tests/integration/` using `startTestServer` plus a local stub HTTP server standing in for the chatbot

**Target Platform**: Vercel (static `dist/` + single Node function `api/index.js`); local `npm run dev` (Vite middleware) and `npm start`

**Project Type**: Web application: vanilla-JS SPA (`app/src/`) + in-process API router (`app/server/`)

**Performance Goals**: Panel opens instantly (no network on open). The app adds < 50 ms overhead on top of the upstream answer time. 95% of answers within 30 s when the upstream is healthy (SC-004).

**Constraints**: 120 s upstream timeout (FR-008). Function `maxDuration` 130 s. Question ≤ 1,000 chars. Answer rendered as text only. No customer data sent upstream (FR-014). Chatbot URL never exposed to the browser.

**Scale/Scope**: A handful of coaches, one question at a time per coach. 1 new server module, 1 route, 1 client component + stylesheet, 1 client API function, 1 env var.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Content & Program Quality** | The feature doesn't create or change `program.md` / `feedback.md` / `notes.md`, exports or skill definitions. Chat answers are advisory text shown to the coach, not saved program content. | ✅ Pass (not affected) |
| **II. Verify-Before-Save** | Nothing is saved. There are no writes to customer data to verify. The project does have a `node --test` suite; this feature adds unit + integration tests to it anyway. | ✅ Pass (not affected) |
| **III. UX Consistency** | The panel uses the existing design tokens, type scale (16 px body), icon set, pill/radius rules and light/dark handling. Error copy matches the app's friendly-message pattern. The new/existing-customer question doesn't apply because no customer file is touched. | ✅ Pass |
| **IV. Performance & Responsiveness** | Opening the panel costs no network call. A bounded timeout (120 s) with a clear waiting state and Retry. No customer files grow. | ✅ Pass |
| **Customer Data Standards** | FR-014: no customer names, programs, feedback or notes are sent upstream or stored. The conversation is kept outside `customers/` and the DB and isn't persisted. | ✅ Pass |
| **Development Workflow** | The coaching workflow (`CLAUDE.md`) is unaffected. The chatbot gives general advice to the coach; any program change still follows the feedback → notes → program sequence. | ✅ Pass |

**Gate result (pre-research)**: PASS. No violations, so Complexity Tracking is empty.

**Post-design re-check (after Phase 1)**: PASS. The design adds one server module, one route, one UI component and no persistence. The contracts confirm that only the typed question and the fixed instruction leave the app, and that nothing is written to customer data.

## Project Structure

### Documentation (this feature)

```text
specs/013-fitness-coach-chatbot/
├── plan.md                    # This file
├── spec.md                    # Feature spec
├── research.md                # Phase 0: decisions (proxy, prompt, timeouts, errors, state, rendering)
├── data-model.md              # Phase 1: in-memory entities, constants, env
├── quickstart.md              # Phase 1: setup + validation guide
├── contracts/
│   ├── chat-api.md            # POST /api/chat + upstream call + askCoach()
│   └── chat-panel-ui.md       # Panel structure, behavior, visual rules
├── checklists/
│   └── requirements.md        # Spec quality checklist
└── tasks.md                   # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
app/
├── server/
│   ├── index.js                  # MODIFY: add handlePostChat + ROUTES entry POST /api/chat
│   └── lib/
│       └── coach-chat.js         # NEW: COACH_INSTRUCTION, MAX_TOKENS, buildCoachMessage(),
│                                 #      validateChatQuestion(), askCoachChatbot() (fetch + timeout
│                                 #      + error mapping), setChatTimeoutForTests()
├── src/
│   ├── main.js                   # MODIFY: mountChatPanel(document.body) after first render()
│   ├── api-client.js             # MODIFY: askCoach(message, { signal })
│   ├── components/
│   │   └── chat-panel.js         # NEW: launcher + panel, in-memory conversation, send/retry/clear
│   ├── lib/
│   │   └── icons.js              # MODIFY: add chat-circle-dots, paper-plane-right, x, arrow-clockwise
│   └── styles/
│       ├── main.css              # MODIFY: @import './chat.css'
│       └── chat.css              # NEW: panel styles (tokens only; ≤480px full-width)
├── tests/
│   ├── unit/
│   │   └── coach-chat.test.js    # NEW: prompt building + validation
│   └── integration/
│       └── coach-chat.test.js    # NEW: /api/chat against a local stub upstream
├── .env.example                  # MODIFY: document CHATBOT_URL
├── vercel.json                   # MODIFY: functions["api/index.js"].maxDuration = 130
└── README.md                     # MODIFY: CHATBOT_URL in setup + Vercel env list
```

**Structure Decision**: Follows the existing app layout. Server logic that talks to an outside service goes in `app/server/lib/` (next to `customer-data.js`), wired into the single router in `app/server/index.js`. The UI is a self-contained component in `app/src/components/`, mounted from `main.js` the same way as `header-account.js`. No new top-level directories or Vercel functions.

## Complexity Tracking

No constitution violations to justify.
