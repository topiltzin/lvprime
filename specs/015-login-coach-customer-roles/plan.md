# Implementation Plan: Login with Coach and Customer Profiles

**Branch**: `015-login-coach-customer-roles` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-login-coach-customer-roles/spec.md`

## Summary

A coach-only sign-in already exists (`app/server/auth.js`, `handlers/auth.js`, `views/login-view.js`): Supabase Auth email+password, then a signed HttpOnly cookie, with every `/api/*` and `/customer-files/*` route behind it. This feature **extends** it with a second profile. Customers become Supabase Auth users linked to a `customers` row (`auth_user_id`). The coach creates them with a default password and a `must_change_password` flag. The server resolves role (`coach` | `customer`) per request and enforces it in the router: customers are limited to their own slug, coach-only routes are closed to them, and Notas/Seguimiento content is never serialized for customer sessions. The client adds a forced set-password screen, a "give access / reset password" control for the coach, and disabled Notas/Seguimiento tabs for customers.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node >= 22.5; no framework, Vite 8 front end

**Primary Dependencies**: `@supabase/supabase-js` (Auth admin API for create/update user, `signInWithPassword`); existing `marked`, `dompurify`

**Storage**: Supabase Postgres (`customers` gains `auth_user_id`, `must_change_password`); credentials held by Supabase Auth only, never in app tables

**Testing**: `node --test` (`tests/unit`, `tests/integration`); sign-in stubbed via `setSignInForTests`, extended with stubs for admin calls

**Target Platform**: Vercel serverless (`api/index.js`) and local `server.js` / Vite dev middleware; mobile-first browser

**Project Type**: Web application (single repo `app/`: `src/` client, `server/` API)

**Performance Goals**: Auth check adds at most one indexed lookup per customer request; sign-in under 2 s; customer page load stays within the existing <500 ms target

**Constraints**: Stateless HMAC cookie must stay compatible with Vercel; strict CSP (no inline scripts); Spanish UI via `strings.js`; `COACH_AUTH_DISABLED` dev bypass keeps working (acts as coach)

**Scale/Scope**: 1 coach, tens of customers; ~6 new endpoints, 1 migration, 2 new screens, 1 coach control

## Constitution Check

*Constitution is written for the markdown customer files; this feature does not change their formats.*

| Principle | Status | Note |
|-----------|--------|------|
| I. Content & Program Quality | PASS | No change to program/feedback/notes formats or write paths. |
| II. Verify-Before-Save | PASS | Customer-submitted feedback still goes through existing validation. Customers cannot write notes or programs (FR-012). |
| III. UX Consistency | PASS | Spanish copy through `strings.js`, existing login styling, `YYYY-MM-DD` untouched. |
| IV. Performance | PASS | One extra lookup per customer request. |
| Customer Data Standards | PASS | Only an account link and a flag are added. Credentials live in Supabase Auth, not in customer files. |

Re-check after design: still PASS (see data-model.md; nothing is stored outside the customer structure except the auth link).

## Project Structure

### Documentation (this feature)

```text
specs/015-login-coach-customer-roles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-api.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── server/
│   ├── auth.js                    # extend: session carries role/slug; password rules; admin helpers
│   ├── access.js                  # NEW: authorize(req, route) → role + slug scope, per-request customer lookup
│   ├── index.js                   # route table gets an `access` tag; enforce before handler
│   ├── handlers/
│   │   ├── auth.js                # login returns role/mustChange; session; change-password
│   │   ├── customers.js           # customer-safe payload (no notes/feedback list)
│   │   └── customer-access.js     # NEW: coach creates access / resets password
│   ├── lib/customer-data.js       # lookups by auth_user_id; link/unlink; flag updates
│   └── migrations/017-customer-accounts.{sql,js}   # NEW
├── src/
│   ├── api-client.js              # changePassword, createCustomerAccess, resetCustomerPassword
│   ├── main.js                    # role-aware routing; forced password step; customer home redirect
│   ├── views/
│   │   ├── login-view.js          # reused unchanged in layout
│   │   ├── change-password-view.js  # NEW
│   │   └── customer-view.js       # tabs disabled for customer role; access control for coach
│   ├── components/
│   │   ├── tab-container.js       # honor disabled tabs (aria-disabled)
│   │   ├── sidebar.js             # hidden for customers
│   │   ├── chat-panel.js          # coach only
│   │   └── header-account.js      # show role, sign out
│   └── lib/strings.js             # ES strings
└── tests/
    ├── unit/passwords.test.js, access.test.js
    └── integration/customer-auth.test.js
```

**Structure Decision**: Keep the single `app/` web app; add one server module (`access.js`) as the single enforcement point rather than scattering role checks across handlers.

## Complexity Tracking

No constitution violations.
