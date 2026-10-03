-- Customer sign-in accounts (specs/015-login-coach-customer-roles).
-- auth_user_id links a customer to their Supabase Auth user; must_change_password is
-- true from account creation (or a coach reset) until they set their own password.
-- Run in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Then check it with: node --env-file=.env.local server/migrations/017-customer-accounts.js

ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_user_id UUID NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS customers_auth_user_id_key ON customers (auth_user_id);
