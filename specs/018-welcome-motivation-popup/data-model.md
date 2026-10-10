# Data Model: Welcome Motivation Popup

## welcome_messages (new, `server/migrations/019-welcome-messages.sql`)

| Column | Type | Rules |
|--------|------|-------|
| `customer_slug` | VARCHAR(255) PK | FK → `customers(slug)` ON DELETE CASCADE; one message per customer |
| `body` | TEXT NOT NULL | CHECK `length(btrim(body)) BETWEEN 1 AND 300` |
| `delivery_weekday` | SMALLINT NOT NULL DEFAULT 1 | CHECK 1..7 (ISO: 1 = Monday … 7 = Sunday) |
| `repeat_weekly` | BOOLEAN NOT NULL DEFAULT true | false = show once |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Last edit |
| `last_seen_week` | DATE NULL | Monday of the week it was last dismissed |
| `last_seen_at` | TIMESTAMPTZ NULL | When it was last dismissed |

RLS enabled, no policies (service key only).

## Derived concepts (not stored)
- **Week start** of a date = that date's Monday (`YYYY-MM-DD`).
- **Due(today)** = row exists AND `isoWeekday(today) >= delivery_weekday` AND (`repeat_weekly` ? `last_seen_week IS DISTINCT FROM weekStart(today)` : `last_seen_week IS NULL`).
- **Status for the coach**: `scheduled` (never seen or seen in an earlier week), `seen` (`last_seen_week = current week`), with `last_seen_at`.

## State transitions
- Created/edited by coach → `last_seen_week`/`last_seen_at` reset to NULL when the **text** changes (a new message should show), unchanged when only the day or repeat setting changes.
- Customer dismisses → `last_seen_week = weekStart(today)`, `last_seen_at = now()`. Idempotent.
- Coach deletes → row removed; customer sees nothing.
- Customer deleted → cascade.

## Unchanged
`customer_messages` (016): untouched, readable by the coach only.
