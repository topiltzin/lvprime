# Data Model: Login with Coach and Customer Profiles

## Changes to existing `customers` table

| Column | Type | Notes |
|--------|------|-------|
| `auth_user_id` | UUID NULL, UNIQUE | Supabase Auth user for this customer. NULL = no sign-in yet (FR-004, FR-017). |
| `must_change_password` | BOOLEAN NOT NULL DEFAULT false | True from account creation or coach reset until the customer sets their own password. |

Migration `017-customer-accounts.sql` is idempotent (`ADD COLUMN IF NOT EXISTS`, unique index `IF NOT EXISTS`). Existing customers get NULL and false, so nothing changes for them.

## Entities

- **Coach**: A Supabase Auth user with no `customers` link. Fields (email, password hash) live in Supabase Auth only.
- **Customer account**: Supabase Auth user (email, password hash) plus the link above. One account per customer (unique `auth_user_id`), one customer per account.
- **Session** (cookie, not stored): `{ sub, email, role, slug?, exp }` signed with HMAC. `slug` is present for customers only. Authority for `archived_at` and `must_change_password` is the `customers` row, read per customer request.

## State transitions (customer account)

```text
(no access) --coach creates access--> PENDING_PASSWORD (must_change_password = true)
PENDING_PASSWORD --customer sets password--> ACTIVE (false)
ACTIVE --coach resets password--> PENDING_PASSWORD
any --coach archives customer--> BLOCKED (sign-in refused, existing sessions rejected)
BLOCKED --coach restores--> previous state
```

## Validation rules

- Email: valid format, unique across Supabase Auth (409 `email_taken`).
- Default password (coach-entered): same strength rules as the personal password, minimum 8 characters.
- New password: at least 8 characters, one letter and one number, not equal to the current password, matches confirmation.
