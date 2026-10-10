# Implementation Plan: Welcome Motivation Popup

**Branch**: `018-welcome-motivation-popup` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-welcome-motivation-popup/spec.md`

## Summary

Replace the two-way coach–client conversation (016) with a one-way **welcome message**: one row per customer holding the coach's text, a delivery weekday and a weekly/once setting. After a customer signs in, the client asks the server whether a message is due for the customer's local date; if so a native `<dialog>` popup opens over the already-rendered page with a canvas firework burst on open and a shorter one on close (plain fade under reduced motion). Closing records the week as seen, so it never repeats that week on any device. The coach edits the message, day and repeat setting in the customer page (the old Messages tab becomes "Welcome message") and can preview the popup without marking it seen. The 016 table is kept (coach read-only history); customer replies, the customer-side thread and unread badges are removed. No new dependency.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node >= 22.5; no framework, Vite 8 front end

**Primary Dependencies**: Existing only (`@supabase/supabase-js`). Fireworks are a small hand-written canvas animation (no confetti library), which keeps the strict CSP and bundle size untouched.

**Storage**: Supabase Postgres, new `welcome_messages` table (migration `019-welcome-messages.{sql,js}`), service-key access only, RLS on with no policies. `customer_messages` (016) is left in place, read-only for the coach.

**Testing**: `node --test`: unit tests for validation and due-date logic, integration tests through `startTestServer` with the in-memory override pattern used by `messages.test.js`; client strings covered by `i18n.test.js`. Manual visual/motion checks in `quickstart.md`.

**Target Platform**: Vercel serverless (`api/index.js`) and local `server.js`; mobile-first browser

**Project Type**: Web application (single repo `app/`)

**Performance Goals**: Due-check is one indexed primary-key read, issued after the page is rendered so it never delays sign-in (SC-007); effect ≤ 1.5 s, capped particle count, device-pixel-ratio capped at 2, animation stops and canvas is removed when done.

**Constraints**: Strict CSP (no inline scripts, no external hosts); es/en via `strings.js`; reduced-motion = fade only; no flashing above 3/s; 300-character limit; dates `YYYY-MM-DD`; `COACH_AUTH_DISABLED` bypass keeps acting as coach.

**Scale/Scope**: 1 coach, tens of customers, one message each; 3 endpoints, 1 migration, 1 popup component, 1 coach editor panel.

## Constitution Check

The constitution governs the markdown customer files and coaching consistency; this feature does not read or write `program.md`, `feedback.md` or `notes.md`.

| Principle | Status | Note |
|-----------|--------|------|
| I. Content & Program Quality | PASS | No change to program/feedback/notes formats or write paths. |
| II. Verify-Before-Save | PASS | Message validated before save (non-empty, ≤300 chars, weekday 1–7, repeat flag). Nothing is copied into `notes.md`. |
| III. UX Consistency | PASS | Existing tokens, `<dialog>` pattern from 017, es/en strings, `YYYY-MM-DD` for dates. Tone is the coach's own voice. |
| IV. Performance | PASS | One indexed read; non-blocking; effect bounded and self-cleaning. |
| Customer Data Standards | PASS with note | Stored in the database beside the customer record (as in 016), only coaching communication; cascade-deleted with the customer. |

Re-check after design: still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/018-welcome-motivation-popup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── welcome-api.md
│   └── welcome-ui.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── server/
│   ├── index.js                       # replace 4 message routes with welcome routes; keep coach-only GET messages
│   ├── handlers/welcome.js            # NEW: get (coach), put/delete (coach), due check + seen (customer-own)
│   ├── handlers/messages.js           # reduce to coach-only read-only history
│   ├── handlers/customers.js          # drop unreadMessages
│   ├── lib/welcome.js                 # NEW: validation, week math, repo (Supabase + test override)
│   ├── lib/customer-data.js           # drop unreadMessages from listAllCustomers
│   └── migrations/019-welcome-messages.{sql,js}   # NEW
├── src/
│   ├── api-client.js                  # getWelcome, saveWelcome, deleteWelcome, getWelcomeDue, markWelcomeSeen; drop reply calls
│   ├── components/
│   │   ├── welcome-popup.js           # NEW: dialog + open/close lifecycle
│   │   ├── fireworks.js               # NEW: canvas particle bursts, reduced-motion aware
│   │   ├── welcome-editor.js          # NEW: coach editor (text, day, repeat, preview, status) + read-only history
│   │   ├── messages-panel.js          # removed (history folded into welcome-editor)
│   │   ├── customer-card.js           # remove unread badge
│   │   └── tab-container.js           # 'messages' tab → coach-only 'welcome'; customers lose the tab and badge
│   ├── main.js                        # after sign-in (customer role): non-blocking due check → popup
│   ├── lib/strings.js                 # es + en keys; remove reply strings
│   └── styles/welcome.css             # NEW (replaces messages.css; imported from main.css)
└── tests/
    ├── unit/welcome.test.js           # NEW
    └── integration/welcome.test.js    # NEW (tests/*/messages.test.js trimmed to coach read-only history)
```

**Structure Decision**: Extend the existing single web app where 016/017 did (server `lib` + `handlers`, route `access` tags, client `components`). The popup reuses the native `<dialog>` approach from `video-dialog.js` for focus containment, Esc and top layer.

## Complexity Tracking

No constitution violations to justify.
