# Contract: Supabase PostgreSQL Database Schema

**Purpose**: Define the exact structure of PostgreSQL tables for customer data storage on Supabase

**Version**: 1.1 (added version/hash/sync_status columns + sync_events/offline_queue_entries tables to absorb specs/004-server-data-sync)
**Date**: 2026-09-17

---

## Database Configuration

**Service**: Supabase PostgreSQL (managed)  
**Connection Method**: `@supabase/supabase-js` client library  
**Environment Variables**:
- `SUPABASE_URL`: Project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SECRET_KEY`: Secret API key for backend operations (never expose to browser)

---

## Full Schema SQL (Run Once in Supabase SQL Editor)

Paste this entire block into **Supabase Dashboard → SQL Editor → New Query** and run it once. It creates all 7 tables in dependency order. Individual table definitions with rationale follow below for reference.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_slug ON customers(slug);

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  content_hash VARCHAR(64),
  last_writer VARCHAR(20) CHECK (last_writer IN ('coach','customer')),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced','pending','conflicted')),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);
CREATE INDEX idx_programs_customer_id ON programs(customer_id);

CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);
CREATE INDEX idx_feedbacks_customer_id ON feedbacks(customer_id);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  content_hash VARCHAR(64),
  last_writer VARCHAR(20) CHECK (last_writer IN ('coach','customer')),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced','pending','conflicted')),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);
CREATE INDEX idx_notes_customer_id ON notes(customer_id);

CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);
CREATE INDEX idx_nutrition_plans_customer_id ON nutrition_plans(customer_id);

CREATE TABLE sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('program','feedback','notes')),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('sync_start','sync_success','sync_conflict','sync_error')),
  source VARCHAR(20) CHECK (source IN ('coach','customer')),
  version_from INTEGER,
  version_to INTEGER,
  conflict_description TEXT,
  error_message TEXT,
  content_hash VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sync_events_customer_id ON sync_events(customer_id, created_at DESC);

CREATE TABLE offline_queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('program','notes')),
  sequence INTEGER NOT NULL,
  queued_at TIMESTAMP NOT NULL,
  action VARCHAR(20) NOT NULL,
  content_hash VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  content_size_bytes INTEGER NOT NULL CHECK (content_size_bytes > 0),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, file_type, sequence)
);
CREATE INDEX idx_offline_queue_customer_file ON offline_queue_entries(customer_id, file_type, sequence);
```

**Verification query** (run after the above to confirm all 7 tables exist):
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expect: customers, feedbacks, notes, nutrition_plans, offline_queue_entries, programs, sync_events
```

---

## Schema Definition

### Table: `customers`

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_slug ON customers(slug);
```

**Constraints**:
- `slug`: Must be lowercase, hyphens allowed, 3-100 characters (regex: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)
- `name`: 1-255 characters
- `id`: Immutable UUID

---

### Table: `programs`

```sql
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  content_hash VARCHAR(64),
  last_writer VARCHAR(20) CHECK (last_writer IN ('coach','customer')),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced','pending','conflicted')),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_programs_customer_id ON programs(customer_id);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `content`: UTF-8 markdown text, <500KB
- One row per customer (unique constraint enforces this)
- `version`: Increments on every write; replaces `sync-engine.js`'s file-mtime-based version tracking (optimistic concurrency, "coach-always-wins" per FR-007 of specs/004-server-data-sync)
- `content_hash`: SHA256 hex (64 lowercase chars), replaces `hash-utils.js` file-content hashing
- `updated_at`: Auto-updates on row modification

---

### Table: `feedbacks`

```sql
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_feedbacks_customer_id ON feedbacks(customer_id);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `content`: raw markdown text of the customer's feedback.md, including its own freeform "Formato de Entrada" template block; parsed on read / formatted-and-appended on write by the pure functions in `markdown-parser.js` (`parseFeedbackEntries`, `extractFeedbackTemplate`, `formatFeedbackEntry`) — no fixed entry shape is enforced at the database layer, since each customer's file can use different field labels
- One row per customer (unique constraint enforces this)
- Default: empty string (no feedback logged yet)

**Migration note**: If you already ran the earlier version of this SQL (with `entries JSONB`), run this to correct it before any data is inserted:
```sql
ALTER TABLE feedbacks DROP COLUMN entries;
ALTER TABLE feedbacks ADD COLUMN content TEXT NOT NULL DEFAULT '';
```

---

### Table: `notes`

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  content_hash VARCHAR(64),
  last_writer VARCHAR(20) CHECK (last_writer IN ('coach','customer')),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced','pending','conflicted')),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_notes_customer_id ON notes(customer_id);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `content`: UTF-8 markdown text, <500KB
- One row per customer (unique constraint enforces this)
- `version`/`content_hash`/`last_writer`/`sync_status`: same semantics as `programs` (see above)

---

### Table: `sync_events`

```sql
CREATE TABLE sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('program','feedback','notes')),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('sync_start','sync_success','sync_conflict','sync_error')),
  source VARCHAR(20) CHECK (source IN ('coach','customer')),
  version_from INTEGER,
  version_to INTEGER,
  conflict_description TEXT,
  error_message TEXT,
  content_hash VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_events_customer_id ON sync_events(customer_id, created_at DESC);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- Append-only: rows are never UPDATEd or DELETEd (audit log)
- Replaces the in-memory `_syncLog` array in `server/sync-state.js`, which does not persist across Vercel invocations

---

### Table: `offline_queue_entries`

```sql
CREATE TABLE offline_queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('program','notes')),
  sequence INTEGER NOT NULL,
  queued_at TIMESTAMP NOT NULL,
  action VARCHAR(20) NOT NULL,
  content_hash VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  content_size_bytes INTEGER NOT NULL CHECK (content_size_bytes > 0),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, file_type, sequence)
);

CREATE INDEX idx_offline_queue_customer_file ON offline_queue_entries(customer_id, file_type, sequence);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `sequence`: MUST start at 1 per (customer_id, file_type) and increment without gaps (enforced at application layer, per `offline-queue.js`)
- `content_hash`: MUST match `^[a-f0-9]{64}$` (enforced by CHECK constraint, per `offline-queue.js` format validation)
- Rows deleted after successful flush (replaces `clearQueue()` which reset the JSON array to `'[]'`)

---

### Table: `nutrition_plans`

```sql
CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_nutrition_plans_customer_id ON nutrition_plans(customer_id);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `content`: UTF-8 markdown text, <100KB (per specs/005-nutrition-plan-tab FR-008 — not 500KB like programs/notes, to preserve the existing 413 behavior)
- One row per customer (unique constraint enforces this)

---

## Row-Level Security (RLS) Policies

**Note**: For MVP (coach-only, no auth), RLS can be disabled. If future multi-coach support is added:

```sql
-- Example: Allow all coaches to read/write their own customer data
-- (Implementation details defer to future auth work)
```

For now: RLS disabled; access controlled at application layer.

---

## Backup & Disaster Recovery

**Supabase Backups**:
- Automatic daily backups (included in Supabase)
- 7-day retention (free tier)
- Point-in-time recovery available

**Manual Backup** (during migration):
1. Export `customers` table as CSV
2. Export `programs`, `feedbacks`, `notes`, `nutrition_plans` as JSONL
3. Store in version control or cloud storage

---

## Migration Sequence

**Phase 1: Setup** (run once before go-live)
1. Create Supabase project
2. Execute all CREATE TABLE statements above
3. Verify tables exist with correct structure

**Phase 2: Data Migration**
1. Run migration script (reads filesystem, inserts into database)
2. Verify row counts match file count
3. Spot-check data integrity

**Phase 3: Go-Live**
1. Deploy app with database layer
2. Monitor queries for performance
3. Retain filesystem backup for 30 days

---

## Performance Expectations

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| SELECT customer by slug | <50ms | Indexed on slug |
| SELECT program/feedback/notes/nutrition by customer_id | <50ms | Indexed on customer_id |
| INSERT/UPDATE row | <100ms | Includes network latency |
| Load all data for customer profile | <200ms | 4 queries in parallel, <50ms each |

**Indexes**:
- Primary indexes on id (automatic)
- Foreign key indexes on customer_id (automatic)
- Optional: Full-text search on program/nutrition content (future)

---

## Supabase-Specific Notes

**Connection Pooling**: Supabase automatically handles via PgBouncer; no config needed

**Timeout**: Default 10s; suitable for serverless functions

**Rate Limiting**: Free tier: 50,000 requests/month; upgrade as needed

**No direct Postgres connection needed**: The app uses `@supabase/supabase-js`, which talks to Supabase over its REST API (PostgREST) using `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (Settings → API). The raw `postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres` connection string is only needed if connecting a third-party SQL client directly (e.g., to run the schema SQL above via `psql` instead of the SQL Editor) — the app itself never uses it.
