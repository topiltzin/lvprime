# Data Model: Coach–Client Messaging

## customer_messages (new table, `server/migrations/018-customer-messages.sql`)

| Column | Type | Rules |
|--------|------|-------|
| `id` | BIGINT identity PK | Orders the thread (stable, gap-tolerant) |
| `customer_slug` | VARCHAR(255) NOT NULL | FK → `customers(slug)` ON DELETE CASCADE |
| `sender_role` | TEXT NOT NULL | CHECK in (`coach`, `customer`) |
| `body` | TEXT NOT NULL | CHECK `length(btrim(body)) BETWEEN 1 AND 1000` |
| `client_id` | UUID NOT NULL | Duplicate-send guard |
| `created_at` | TIMESTAMPTZ NOT NULL | default `now()` |
| `read_at` | TIMESTAMPTZ NULL | Set when the *recipient* opens the thread |

**Indexes / constraints**
- `UNIQUE (customer_slug, client_id)` — idempotent send.
- `INDEX (customer_slug, id)` — thread listing.
- `INDEX (customer_slug, sender_role) WHERE read_at IS NULL` — unread counts.
- RLS enabled, no policies (only the API server's service key reads/writes).

**Derived concepts (not stored)**
- **Conversation** = all rows for one `customer_slug`. Exactly one per customer (FR-001).
- **Unread for the coach** = rows with `sender_role='customer' AND read_at IS NULL`.
- **Unread for the customer** = rows with `sender_role='coach' AND read_at IS NULL`.
- **Coach's latest message read?** = the newest `sender_role='coach'` row has `read_at IS NOT NULL` (FR-009).
- **Customer may reply?** = at least one `sender_role='coach'` row exists (FR-004).

**State transitions**
- Message: created (`read_at` null) → read (`read_at` set by recipient's mark-read) → optionally deleted (coach's own messages only).
- Marking read is idempotent and only touches rows from the *other* role.

**Lifecycle**
- Customer deleted → messages cascade-deleted. Archived customer → messages kept; access follows the existing archived rule (403 for the customer).
- Password reset / account change → messages untouched.
