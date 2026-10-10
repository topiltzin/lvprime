# Contract: Welcome API

Routes under `/api/customers/:slug/welcome`. Sender is always the coach; there is no customer write path. Errors use the existing shapes (`sendJson`, 422 field map, 503 `unable_to_load`). Logs record outcomes only, never message text.

## GET /api/customers/:slug/welcome/due?today=YYYY-MM-DD  — `access: 'customer-own'`
A customer for their own slug only (other slugs → 404 `customer_not_found`; signed-out 401; archived 403 `account_disabled`; must-change-password 403 `password_change_required`). The coach is allowed and receives `{ "due": false }` always (the coach never sees a customer popup).

200: `{ "due": true, "message": { "body": "Great week ahead!", "coachName": "Lili" }, "weekStart": "2026-10-05" }` or `{ "due": false }`.
422 `validation_failed` when `today` is missing, malformed, or more than 1 day from the server date.
No side effects.

## POST /api/customers/:slug/welcome/seen  — `access: 'customer-own'`
Body: `{ "weekStart": "YYYY-MM-DD" }`. Records the dismissal.
200 `{ "recorded": true }`; idempotent. 422 for a malformed or non-Monday `weekStart`. No-op `{ "recorded": false }` when no message exists.

## GET /api/customers/:slug/welcome  — coach only
200 `{ "message": null }` or `{ "message": { "body", "deliveryWeekday", "repeatWeekly", "updatedAt", "status": "scheduled"|"seen", "lastSeenAt" } }`. Customer → 403 `forbidden`.

## PUT /api/customers/:slug/welcome  — coach only
Body: `{ "body": "text", "deliveryWeekday": 1, "repeatWeekly": true }`.
200 `{ "message": { …same shape as GET… } }`. 422 `{ "error": "validation_failed", "fields": { "body"|"deliveryWeekday"|"repeatWeekly": "..." } }`. 404 `customer_not_found`.
Saving changed text resets seen state (see data model).

## DELETE /api/customers/:slug/welcome  — coach only
200 `{ "deleted": true }` (also when nothing existed).

## GET /api/customers/:slug/messages  — coach only (read-only history from 016)
Unchanged response shape; customers receive 403 `forbidden`. POST, mark-read and DELETE routes are removed (404).

## Payload removals
`unreadMessages` is removed from `GET /api/customers` and `GET /api/customers/:slug`.
