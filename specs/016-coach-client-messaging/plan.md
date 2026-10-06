# Implementation Plan: Coach–Client Messaging

**Branch**: `016-coach-client-messaging` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-coach-client-messaging/spec.md`

## Summary

One private, text-only conversation per customer between the coach and that customer. The coach starts it; the customer can reply once the coach has written. It lives in a new **Messages** tab on the customer page (same tab pattern as Program/Nutrition/Progress), with an unread badge on the tab and an unread signal on the coach's customer cards. Messages are rows in a new Supabase table keyed by customer slug; the existing per-request authorization (`access: 'customer-own'`, feature 015) already guarantees a customer can only reach their own slug and a coach can reach all, so no new auth concept is needed. No realtime transport in v1: the open tab refreshes on open and on a light poll. The floating AI "Coach assistant" is untouched and kept visually and verbally distinct.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node >= 22.5; no framework, Vite 8 front end

**Primary Dependencies**: Existing only (`@supabase/supabase-js`); no new packages. Message text reaches the DOM only via `textContent`.

**Storage**: Supabase Postgres, new `customer_messages` table (migration `018-customer-messages.{sql,js}`), service-key access only, RLS on with no policies (same as chat tables)

**Testing**: `node --test` — unit tests for validation/shaping, integration tests through `startTestServer` with the in-memory fake pattern from `customer-auth.test.js`; client strings covered by `i18n.test.js`

**Target Platform**: Vercel serverless (`api/index.js`) and local `server.js` / Vite dev middleware; mobile-first browser

**Project Type**: Web application (single repo `app/`: `src/` client, `server/` API)

**Performance Goals**: Send and list each one indexed query; message visible to the other side within 5 s of opening/refreshing (SC-002); existing customer page load stays within the current target (unread count is one extra indexed count)

**Constraints**: Strict CSP (no inline scripts); Spanish/English strings via `strings.js`; stateless cookie auth unchanged; `COACH_AUTH_DISABLED` dev bypass keeps acting as coach; 1,000-character message limit; duplicate-send protection

**Scale/Scope**: 1 coach, tens of customers, tens of messages each; 4 endpoints, 1 migration, 1 tab, 2 badge surfaces

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution governs the markdown customer files (`program.md`, `feedback.md`, `notes.md`) and coaching consistency; this feature does not touch those files or their formats.

| Principle | Status | Note |
|-----------|--------|------|
| I. Content & Program Quality | PASS | No change to program/feedback/notes formats or write paths. |
| II. Verify-Before-Save | PASS | Messages are validated before saving (non-empty, length, sender role, reply gate). Nothing is written to `program.md` or `notes.md`; message content is never auto-copied into notes. |
| III. UX Consistency | PASS | Existing tab pattern, tokens, `strings.js` es/en copy, `YYYY-MM-DD` for any date shown by date alone. Distinct from the AI assistant. |
| IV. Performance | PASS | Indexed per-customer reads; no unbounded lists (page of the latest 100). |
| Customer Data Standards | PASS with note | Messages are stored in the database beside the customer record (same as chat memory and customer accounts), not as new files under `customers/`. They contain only coaching communication. Deleting a customer cascades its messages. |

Re-check after design: still PASS (see `data-model.md`; no unrelated personal data added).

## Project Structure

### Documentation (this feature)

```text
specs/016-coach-client-messaging/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── messages-api.md
│   └── messages-ui.md
├── checklists/
│   ├── requirements.md
│   └── ux-alignment.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── server/
│   ├── index.js                       # 4 new routes tagged access: 'customer-own'
│   ├── handlers/
│   │   ├── messages.js                # NEW: list / send / mark read / coach delete
│   │   └── customers.js               # add unreadMessages to the customer view
│   ├── lib/
│   │   ├── messages.js                # NEW: validation, repo (Supabase), unread counts
│   │   └── customer-data.js           # listAllCustomers adds unreadMessages per customer
│   └── migrations/018-customer-messages.{sql,js}   # NEW
├── src/
│   ├── api-client.js                  # getMessages, sendMessage, markMessagesRead, deleteMessage
│   ├── components/
│   │   ├── messages-panel.js          # NEW: thread, composer, states
│   │   └── customer-card.js           # unread signal badge
│   ├── views/customer-view.js         # 'messages' tab (both roles) + tab badge
│   ├── components/tab-container.js    # render 'messages' content, optional tab badge
│   ├── lib/strings.js                 # es + en keys
│   └── styles/messages.css            # NEW (imported from main.css)
└── tests/
    ├── unit/messages.test.js          # NEW
    └── integration/messages.test.js   # NEW
```

**Structure Decision**: Extend the existing single web app (`app/`) exactly where features 013 and 015 did: server logic in `server/lib` + `server/handlers`, routes in `server/index.js` with an `access` tag, client in `src/components` and `src/views`. No new project, service or dependency.

## Complexity Tracking

No constitution violations to justify.
