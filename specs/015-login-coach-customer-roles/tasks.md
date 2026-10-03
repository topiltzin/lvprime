---

description: "Task list for Login with Coach and Customer Profiles"
---

# Tasks: Login with Coach and Customer Profiles

**Input**: Design documents from `/specs/015-login-coach-customer-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md, quickstart.md

**Tests**: Included. The repo has an existing `node --test` suite (`app/tests/`), and the plan lists the test files. Sign-in is stubbed with `setSignInForTests`, so no real Supabase is needed.

**Organization**: Grouped by user story. All paths are relative to the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 to US4, mapping to spec.md

---

## Phase 1: Setup

- [X] T001 Create migration `app/server/migrations/017-customer-accounts.sql` (idempotent): `ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_user_id UUID NULL`, `ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false`, and `CREATE UNIQUE INDEX IF NOT EXISTS customers_auth_user_id_key ON customers(auth_user_id)`. Follow the header style of `014-customer-archive.sql`.
- [X] T002 [P] Create the migration check script `app/server/migrations/017-customer-accounts.js`, modeled on `014-customer-archive.js` (verifies both columns exist).
- [X] T003 [P] Add all new Spanish strings to `app/src/lib/strings.js` under `login.*`, `password.*`, `access.*` and `role.*` keys: set-password title and intro, current/new/confirm labels, strength rule text, mismatch and same-as-default errors, "account disabled, contact your coach", "Dar acceso", "Restablecer contraseña", default-password label, disabled-tab hint. Check whether `app/src/lib/i18n.js` and `app/tests/unit/i18n.test.js` need an English counterpart and add it if so.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Roles, per-request authorization, and the data helpers every story relies on.

- [X] T004 Add data helpers to `app/server/lib/customer-data.js`: `getCustomerByAuthUserId(userId)` returning `{ slug, name, archived_at, must_change_password }` or null; `linkCustomerAccount(slug, authUserId)` (sets `must_change_password = true`; throws a typed error when the customer already has `auth_user_id`); `setMustChangePassword(slug, bool)`; `getCustomerAccess(slug)` returning `{ hasAccess, mustChangePassword, authUserId }`.
- [X] T005 Add password validation to `app/server/auth.js`: `validateNewPassword({ currentPassword, newPassword, confirmPassword })` returning `fields`. Rules verbatim from data-model.md: "at least 8 characters, one letter and one number, not equal to the current password, matches confirmation".
- [X] T006 [P] Unit tests for T005 in `app/tests/unit/passwords.test.js`: too short, no digit, no letter, same as current, mismatch, valid.
- [X] T007 Extend the session in `app/server/auth.js`: the cookie payload becomes `{ sub, email, role, slug?, exp }`; `getSession` returns `role` and `slug`; cookies issued before this change (no `role`) are treated as `coach`. Add `sessionCookie(req, user, { role, slug })`. Keep `COACH_AUTH_DISABLED=true` acting as an authenticated coach.
- [X] T008 Add Supabase admin helpers to `app/server/auth.js`: `createAuthUser(email, password)` using `auth.admin.createUser({ email, password, email_confirm: true })` and mapping the already-registered error to `email_taken`; `setAuthPassword(userId, password)` using `auth.admin.updateUserById`. Both go through swappable impls with `setAdminForTests(fns)` like `setSignInForTests`.
- [X] T009 Create `app/server/access.js` exporting `authorize(req, route, slug)` returning `{ ok, status, body, actor }`. Customer sessions: load the row with `getCustomerByAuthUserId` (one lookup); reject 403 `account_disabled` when `archived_at` is set; when `must_change_password` is true allow only `/api/password`, `/api/session`, `/api/logout`, otherwise 403 `password_change_required`; for `customer-own` routes require the URL slug to equal the row's slug, else 404 `customer_not_found`; for `coach` routes return 403 `forbidden`. Coach sessions always pass. No session returns 401 `unauthorized`.
- [X] T010 Tag every entry in `ROUTES` in `app/server/index.js` with `access: 'coach' | 'customer-own'` per the authorization matrix in `contracts/auth-api.md` and research R6. Coach: list, create, content get/put, archive/restore, measurements, attachments upload/delete, chat (3 routes), sync (3 routes). Customer-own: `GET /api/customers/:slug`, program weeks (2 routes), nutrition, feedback POST, quick-complete, day-notes, `/customer-files/:slug/*`. Replace the bare `isAuthorized` check with `authorize`, passing the slug captured from the route match. Routes without a tag MUST default to `coach`.
- [X] T011 [P] Unit tests for T009 in `app/tests/unit/access.test.js`: signed out, coach, customer own slug, customer other slug (404), customer on coach route (403), archived (403), must-change gating. (Covered in `tests/integration/customer-auth.test.js` instead of a separate unit file.)

**Checkpoint**: Server enforces roles. Existing coach behavior is unchanged.

---

## Phase 3: User Story 1 - Sign in and land in the right place (Priority: P1) MVP

**Goal**: Signed-out visitors see only the login page; coaches land on the customer list; customers land on their own page.

**Independent Test**: quickstart scenarios 1 and 6 (landing part). Sign in as a coach, then as a stubbed customer.

- [X] T012 [US1] Update `handleLogin` in `app/server/handlers/auth.js`: after `signIn`, resolve the role with `getCustomerByAuthUserId`; return 403 `account_disabled` ("Contact your coach.") when archived; set the cookie with role and slug; respond `{ email, role, slug?, mustChangePassword }`. Keep the 401 `invalid_credentials` message identical for unknown email and wrong password (FR-015).
- [X] T013 [US1] Update `handleSession` in `app/server/handlers/auth.js` to return `role`, `slug` and `mustChangePassword` (customer values from the row, coach `null`/`false`).
- [X] T014 [P] [US1] Integration test `app/tests/integration/customer-auth.test.js` (part 1): signed out gets 401 on `/api/customers`; coach login returns `role: "coach"`; customer login returns `role: "customer"` and the slug; wrong credentials give 401 with the same message; logout clears access. Stub sign-in and the customer lookup.
- [X] T015 [US1] Update `app/src/api-client.js`: `login` returns the response body; `getSession` exposes `role`, `slug`, `mustChangePassword`.
- [X] T016 [US1] Role-aware startup in `app/src/main.js`: fetch the session first; customers skip the overview, are redirected to `#/customers/<slug>` and any other hash is rewritten to their own slug; coaches behave as today. Do not mount the sidebar or the chat panel for customers (`renderSidebar`, `mountChatPanel`).
- [X] T017 [P] [US1] Update `app/src/components/header-account.js` to show the signed-in email and role, with sign out working for both roles.
- [X] T018 [US1] Show the `account_disabled` message in `app/src/views/login-view.js` (the existing `formError` path) and keep the layout unchanged.

**Checkpoint**: Both roles can sign in and land correctly (customers need an account from US2 to try it for real; tests use stubs).

---

## Phase 4: User Story 2 - Coach creates a customer account with a default password (Priority: P1)

**Goal**: The coach gives a customer sign-in access, and can reset it.

**Independent Test**: quickstart scenarios 2, 3 and 7 (reset part). Create access, then sign in with the default password.

- [X] T019 [US2] Create `app/server/handlers/customer-access.js` with `handleCreateAccess(req, res, slug)` and `handleResetAccess(req, res, slug)` per `contracts/auth-api.md`. Create: validate `email` (same pattern as login) and `defaultPassword` (minimum 8 characters, one letter, one number), 409 `access_exists` when already linked, `createAuthUser`, then `linkCustomerAccount`; if linking fails after the user was created, delete the auth user so nothing is orphaned. Reset: 404 `no_access` when unlinked, `setAuthPassword`, `setMustChangePassword(slug, true)`.
- [X] T020 [US2] Register `POST /api/customers/:slug/access` and `POST /api/customers/:slug/access/reset` in `app/server/index.js` with `access: 'coach'`.
- [X] T021 [US2] In `handleGetCustomer` (`app/server/handlers/customers.js`), add `access: { hasAccess, email, mustChangePassword }` for coach sessions only (needs the actor from `authorize`; pass it to the handler).
- [X] T022 [P] [US2] Add `createCustomerAccess(slug, { email, defaultPassword })` and `resetCustomerPassword(slug, { defaultPassword })` to `app/src/api-client.js`.
- [X] T023 [US2] Add the access control to `app/src/views/customer-view.js` (coach only): a small panel or dialog reading "Dar acceso" with email and default-password fields when `access.hasAccess` is false, otherwise the customer's email, a "must set password" badge, and "Restablecer contraseña". Show server field errors (`email_taken`, strength). Reuse existing form and dialog styles.
- [X] T024 [P] [US2] Integration tests in `app/tests/integration/customer-auth.test.js` (part 2): create access returns 201; duplicate email returns 409 and creates nothing; second create returns `access_exists`; reset sets the flag; customer session on these routes returns 403.

**Checkpoint**: The coach can onboard customers end to end.

---

## Phase 5: User Story 3 - Customer sets their own password on first sign-in (Priority: P1)

**Goal**: A customer on a default password can reach nothing until they choose a new one.

**Independent Test**: quickstart scenarios 4, 5 and 7.

- [X] T025 [US3] Add `handleChangePassword` to `app/server/handlers/auth.js` for `POST /api/password`: verify `currentPassword` with `signIn`, apply `validateNewPassword` (422 `fields`), `setAuthPassword`, `setMustChangePassword(slug, false)` for customers, then issue a fresh cookie. Register in `app/server/index.js` as a signed-in route reachable while the flag is set (T009 allow-list).
- [X] T026 [P] [US3] Add `changePassword({ currentPassword, newPassword, confirmPassword })` to `app/src/api-client.js`. Make the shared request wrapper detect 403 `password_change_required` and call a registered handler (same pattern as `setUnauthorizedHandler`).
- [X] T027 [US3] Create `app/src/views/change-password-view.js`, built from the same field and password-toggle helpers as `login-view.js` (export those helpers from `login-view.js` or move them to a shared module). Fields: current (default) password, new password, confirmation. Client-side checks mirror the server rules. On success resolve so the caller can continue.
- [X] T028 [US3] In `app/src/main.js`, when the session says `mustChangePassword` (or the 403 handler fires), render the change-password view before anything else, then reload into the customer page.
- [X] T029 [P] [US3] Integration tests in `app/tests/integration/customer-auth.test.js` (part 3): while the flag is set every other route returns 403 `password_change_required`; change with a weak, same or mismatched password returns 422; a valid change clears the flag and unlocks routes; the old default no longer signs in (stubbed Supabase state).

**Checkpoint**: Default passwords can't stay in use.

---

## Phase 6: User Story 4 - Customer sees only their own process; Notas and Seguimiento disabled (Priority: P2)

**Goal**: Privacy between customers, and the coach's notes and tracking never reach customers.

**Independent Test**: quickstart scenario 6 and 8.

- [X] T030 [US4] In `handleGetCustomer` (`app/server/handlers/customers.js`), when the actor is a customer: omit `notes` entirely (`notes: { present: false }`); keep `measurements` (parsed values only, never note text); replace `feedback` with `{ completedDays: [{ date, label, completed }] }` containing only those three fields, with no `felt`, `difficulty`, `notes`, `trend` or `template`. Check `app/src/lib/day-completion.js` and the Program tab to confirm the "done" marks still work from `completedDays`.
- [X] T031 [US4] Update the consumers in `app/src/views/customer-view.js` (and any component reading `feedback.entries`) to use `completedDays` when the role is customer, and to tolerate the missing `notes`/`feedback.trend`.
- [X] T032 [US4] Disabled-tab support in `app/src/components/tab-container.js`: tabs with `isEnabled: false` render as visible `aria-disabled="true"` buttons with a disabled style, are skipped by keyboard navigation, and ignore clicks and hash/`setActiveTab` calls. Add the style in the existing stylesheet under `app/src/styles/`. Check whether `isEnabled` is already honored and extend rather than duplicate.
- [X] T033 [US4] In `buildTabConfig` (`app/src/views/customer-view.js`) set `isEnabled: false` for `feedback` (Seguimiento) and `notes` (Notas) when the role is customer, and make sure the default active tab is Programa. Hide coach-only controls for customers: the access panel, edit-content actions, archive, measurement entry, attachment upload and delete.
- [X] T034 [US4] Guard the customer route in `app/src/main.js` `render()`: for customers, any route other than their own slug (including the overview) re-renders their own page.
- [X] T035 [US4] Handle archived customers in `app/src/api-client.js`: on 403 `account_disabled` show the login page with the contact-your-coach message.
- [X] T036 [P] [US4] Integration tests in `app/tests/integration/customer-auth.test.js` (part 4): customer `GET /api/customers/<own>` has no `notes` text and no `feedback.entries`, `felt` or `difficulty`; `GET /api/customers/<other>` returns 404; every coach-only route returns 403 for a customer; archived customer gets 403 on the next request; a coach still receives the full payload including notes and feedback.
- [ ] T037 [P] [US4] Unit test for the tab container disabled behavior in `app/tests/unit/tab-container.test.js` if the project already tests components in node; otherwise cover it in the manual quickstart only and note that in the task checkbox. (Not done: the suite has no DOM, so disabled tabs are covered by quickstart scenario 6 only.)

**Checkpoint**: All four stories work independently.

---

## Phase 7: Polish & Cross-Cutting

- [X] T038 [P] Run `cd app && npm test` and fix any existing tests broken by the new `access` gating (`app/tests/integration/*.test.js` rely on `COACH_AUTH_DISABLED=true`, which must still behave as coach).
- [X] T039 [P] Document the new environment and deployment prerequisites in `app/README.md`: run migration 017, disable public sign-ups in Supabase Auth, how to create the first coach user, how coaches give access.
- [ ] T040 Execute every scenario in `specs/015-login-coach-customer-roles/quickstart.md` against a dev Supabase project and tick them off; confirm the cookie response headers and CSP are unchanged (`app/vercel.json`, `server/security-headers.js`).
- [ ] T041 [P] Verify the layout of the login, change-password and disabled-tab states at 375 px width, with keyboard-only navigation and visible focus, using the existing login styling.

---

## Dependencies & Execution Order

- Phase 1 has no dependencies. Phase 2 depends on T001 (columns) and blocks everything else.
- Within Phase 2: T004, T005, T008 first; T007 can run next to them; T009 needs T004 and T007; T010 needs T009.
- US1 needs Phase 2. US2 needs Phase 2 and T012 only for manual end-to-end testing. US3 needs Phase 2 and US1's session handling (T012, T013, T015). US4 needs Phase 2 and T016.
- Priority order for delivery: US1, then US2, then US3, then US4. US3 and US4 touch different files and can be built in parallel after US1.
- Do not release to real customers before US3 and US4 are done: until then they could keep the default password or see coach notes.

## Parallel Opportunities

- Phase 1: T002 and T003 together.
- Phase 2: T006 and T011 beside their implementation tasks once those are done.
- US1: T014, T017 together. US2: T022, T024 together. US3: T026, T029 together. US4: T036, T037 together.
- US3 and US4 after US1: separate developers.

## Implementation Strategy

1. **MVP**: Phases 1 and 2, then US1 and US2 with US3. This is the smallest slice safe to hand to a customer (they can sign in, are forced to a personal password, and are scoped by the server enforcement already built in Phase 2).
2. Add US4 for the visible disabled tabs and the stripped payload. Server-side scoping of other customers is already enforced from Phase 2, but notes and feedback only stop being sent in T030.
3. Polish, then run the quickstart end to end.
