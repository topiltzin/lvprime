# Contract: Messages API

All routes are under `/api/customers/:slug/messages`, tagged `access: 'customer-own'` in `server/index.js`: coach for any slug; a customer only for their own slug (other slugs → 404 `customer_not_found`); signed-out → 401; archived customer → 403 `account_disabled`; customer who must change password → 403 `password_change_required`. Sender is always derived from the session (`req.actor.role`), never from the body. JSON in/out.

## GET /api/customers/:slug/messages
Latest 100 messages, oldest first.

200:
```json
{
  "messages": [
    { "id": 12, "senderRole": "coach", "body": "Great week!", "createdAt": "2026-10-06T14:02:11Z", "readAt": null }
  ],
  "canReply": true,
  "unread": 0,
  "latestCoachMessageRead": false
}
```
- `unread` = incoming messages for the caller still unread.
- `canReply` is always true for the coach; for a customer true only when ≥1 coach message exists.
- `latestCoachMessageRead` is `null` when the coach has sent nothing.
- Safe to repeat: no side effects.

## POST /api/customers/:slug/messages
Body: `{ "body": "text", "clientId": "uuid" }`

- 201 `{ "message": { …same shape… } }` on create; 200 with the existing message when `clientId` repeats (idempotent).
- 422 `{ "error": "validation_failed", "fields": { "body": "..." } }` for empty/whitespace, over 1000 characters, or missing/invalid `clientId`.
- 409 `{ "error": "no_coach_message", "message": "..." }` when a customer sends before the coach has written (FR-004).

## POST /api/customers/:slug/messages/read
Marks messages from the *other* role as read for the caller. Body empty.
200 `{ "marked": 3, "unread": 0 }`. Idempotent.

## DELETE /api/customers/:slug/messages/:id
Coach only (customer → 403 `forbidden`). Only coach-authored messages in that conversation; a customer-authored or unknown id → 404 `message_not_found`.
200 `{ "deleted": true }`.

## Existing payload additions
- `GET /api/customers` (coach): each customer gains `unreadMessages` (number of unread customer replies).
- `GET /api/customers/:slug` (coach and customer): gains `unreadMessages` (incoming unread for the caller).
- A failure counting unread must not break these payloads: on error, return `unreadMessages: 0` and log.

## Errors
Same shapes as the rest of the API (`sendJson`, 422 field map, 503 `unable_to_load` for database failures). Logs record outcomes only, never message bodies.
