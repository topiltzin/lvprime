# Research: Coach–Client Messaging

## R1. Shape: one-way feed vs two-way conversation
- **Decision**: One private conversation per customer; coach starts, customer replies after the first coach message.
- **Rationale**: Resolves the user's question in the spec. Replies make coach messages actionable; coach-starts-first keeps the feature close to "coach sends messages" and avoids unsolicited contact.
- **Alternatives**: Broadcast/announcements only (no replies; coach still needs WhatsApp); open two-way where customers can start (more moderation surface, not requested).

## R2. Where to store messages
- **Decision**: New Supabase table `customer_messages`, one row per message, `customer_slug` FK to `customers(slug)` with `ON DELETE CASCADE`. The "conversation" is implicit (all rows of a slug), so there is no separate conversations table.
- **Rationale**: Same pattern as 013 chat tables and 015 accounts (service key, RLS on, no policies). One conversation per customer makes a conversation table pure overhead. Cascade satisfies the "coach deletes a customer" edge case.
- **Alternatives**: A markdown `messages.md` under `customers/` (violates the "three files" rule in Customer Data Standards and doesn't suit concurrent two-sided writes); reuse `chat_messages` (keyed by auth user and built for the AI assistant; mixing would break FR-016); Supabase Realtime tables with client keys (the app has no client-side Supabase access; all data goes through the API).

## R3. Authorization
- **Decision**: Reuse the router `access` tags. All four message routes use `'customer-own'`: a coach may use any slug, a customer only their own, other slugs answer 404 (existing behavior). Sender role comes from `req.actor.role`, never from the request body.
- **Rationale**: Delivers FR-005/FR-011 with the already-tested gate, including archived/must-change-password handling. Coach-only delete is checked in the handler.
- **Alternatives**: New access tag (unneeded).

## R4. Reply gate and the coach-starts-first rule
- **Decision**: On customer POST, the handler requires at least one coach message in that conversation, else 409 `no_coach_message`. The composer is hidden for the customer until then.
- **Rationale**: Server-enforced FR-004 (UI-only would be bypassable).

## R5. Unread and read tracking
- **Decision**: `read_at` per message, set when the *recipient* marks the thread read (`POST …/messages/read`, explicit, not a side effect of GET). Unread for a viewer = messages from the other role with `read_at IS NULL`. Counts ride along existing payloads: `unreadMessages` in `GET /api/customers` (coach's per-card signal) and in `GET /api/customers/:slug` (the tab badge for both roles).
- **Rationale**: Gives FR-007/008/009 without a new endpoint or a read-receipts table; GET stays safe to repeat (prefetch, polling).
- **Alternatives**: Per-user `last_read_message_id` (more compact, but "customer has read the coach's latest" and per-message state are simpler with `read_at`); SSE/websocket badge push (overkill for tens of users).

## R6. Delivery timing
- **Decision**: No realtime. The tab fetches when opened and every ~20 s while it is visible (paused when the page is hidden). The customer-page load and coach customer list already return unread counts.
- **Rationale**: Meets SC-002 ("within 5 s of opening or refreshing") with no new infrastructure; serverless-friendly. Push/email notifications are out of scope (spec assumption).
- **Alternatives**: Long-polling or Supabase Realtime (not usable on Vercel functions / adds a client credential).

## R7. Duplicate-send protection
- **Decision**: The client generates a `clientId` (UUID) per composed message; table has `UNIQUE (customer_slug, client_id)`; a repeat POST returns the existing row with 200 instead of inserting.
- **Rationale**: FR-010 / SC-005 and the "double tap" edge case, including retry after a lost response.

## R8. Validation
- **Decision**: Trim; reject empty; max 1,000 characters (counted in characters, not bytes); no HTML interpretation (client renders with `textContent`; links are plain text). Server rejects with 422 `validation_failed` using the existing field-error shape.

## R9. Coach delete
- **Decision**: Hard delete of a coach-authored message by id within the customer's conversation (`DELETE …/messages/:id`, coach only, only `sender_role='coach'`). Customer messages are never deletable (FR-013).

## R10. UI/UX alignment (UI/UX Pro Max review, see `checklists/ux-alignment.md`)
- **Decision**: A **Messages** tab (not a second floating button); tab order after Progress, before Notes; badge = count + visually hidden phrase ("3 unread messages"), "9+" cap, `role="status"` region only for new-arrival announcements. Bubbles aligned left/right plus a sender label ("Coach" / "You" or the customer's name for the coach); colors from existing tokens with AA contrast; composer has a visible `<label>`, `inputmode`/`enterkeyhint="send"`, 44 px send button, counter from 900/1000 (matches chat panel). Scroll-to-newest on open; transitions via existing motion tokens, which already collapse under `prefers-reduced-motion`.
- **Rationale**: Reuses proven patterns in `chat-panel.js`, `tabs.css`, `tokens.css`; avoids the bottom-right collision with the AI launcher (FR-016).
- **Open item from the spec review**: coach unread cue → a `signalBadge` ("N new messages") in the card's existing signal row, which already pairs icon + text (never color alone). Settled.

## R11. Notifications
- **Decision**: None in v1 (spec assumption). Revisit with the existing `server/lib/email.js` as a follow-up.
