# Contract: Supabase PostgreSQL Database Schema

**Purpose**: Define the exact structure of PostgreSQL tables for customer data storage on Supabase

**Version**: 1.0  
**Date**: 2026-09-17

---

## Database Configuration

**Service**: Supabase PostgreSQL (managed)  
**Connection Method**: `@supabase/supabase-js` client library  
**Environment Variables**:
- `SUPABASE_URL`: Project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Secret API key for backend operations (never expose to browser)

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
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_programs_customer_id ON programs(customer_id);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `content`: UTF-8 markdown text, <500KB
- One row per customer (unique constraint enforces this)
- `updated_at`: Auto-updates on row modification

---

### Table: `feedbacks`

```sql
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_feedbacks_customer_id ON feedbacks(customer_id);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `entries`: JSONB array of objects (see data-model.md for schema)
- One row per customer (unique constraint enforces this)
- Default: empty array

---

### Table: `notes`

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_notes_customer_id ON notes(customer_id);
```

**Constraints**:
- `customer_id`: FK to customers.id; cascade delete if customer removed
- `content`: UTF-8 markdown text, <500KB
- One row per customer (unique constraint enforces this)

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
- `content`: UTF-8 markdown text, <500KB
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

**Connection String** (for local testing):
```
postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
```

Provided in Supabase dashboard → Settings → Database → Connection String
