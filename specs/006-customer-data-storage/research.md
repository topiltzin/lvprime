# Phase 0: Research & Findings

**Date**: 2026-09-17  
**Status**: Complete

## Research Summary

This research phase evaluated the best practices for integrating Supabase PostgreSQL with a Vite + Node.js application for Vercel deployment, and confirmed the suitability of the chosen approach.

---

## Research Findings

### 1. Supabase Integration with Vercel

**Decision**: Use `@supabase/supabase-js` client library for browser and Node.js

**Rationale**: 
- Official Supabase client provides both browser and Node.js support
- Built-in authentication, real-time subscriptions, and CRUD operations
- Zero-configuration for Vercel deployment
- API key-based access (suitable for coach-only app with no auth layer)

**Alternatives Considered**:
- Direct PostgreSQL driver (`pg`): Would require separate connection pooling for serverless; more manual setup; chosen against because higher operational complexity
- PostgREST API: More RESTful but adds network round-trip; chosen against because client library is simpler and faster

**Implementation Approach**:
```javascript
// Server-side: Use Supabase client with service role key (backend operations)
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Browser-side: Can use anon key for read operations (if needed in future)
```

---

### 2. PostgreSQL Schema Design for Customer Data

**Decision**: Normalize into 5 main tables: `customers`, `programs`, `feedbacks`, `notes`, `nutrition_plans`

**Rationale**:
- Current filesystem structure maps cleanly to relational schema (1 customer = 4 markdown files)
- Normalized design allows efficient querying and updates
- JSONB columns for markdown content preserve format fidelity
- Timestamps enable audit trails and caching logic

**Schema Structure**:
- `customers` table: customer metadata (slug, name, created_at, updated_at)
- `programs` table: program.md content per customer (customer_id FK, content JSONB, updated_at)
- `feedbacks` table: feedback.md entries per customer (customer_id FK, entries JSONB array, updated_at)
- `notes` table: notes.md content per customer (customer_id FK, content JSONB, updated_at)
- `nutrition_plans` table: nutrition_plan.md content per customer (customer_id FK, content TEXT, updated_at)

**Chosen Against**:
- Single JSON blob per customer: Chosen against because makes querying and updating specific fields difficult
- Fully normalized (entries as separate rows): Not chosen because feedback.md is a flat list; array in JSONB is simpler

---

### 3. Data Access Layer Architecture

**Decision**: Create abstraction layer (`lib/database.js`, `lib/customer-data.js`) to encapsulate all Supabase operations

**Rationale**:
- Isolates database details from components and views
- Makes testing easier (mock data layer vs. real Supabase)
- Allows future storage provider swap without app code changes
- Single responsibility: app reads/writes through DAL, DAL handles Supabase details

**Pattern**:
```javascript
// app/server/lib/customer-data.js exports:
export async function getCustomer(slug) { /* ... */ }
export async function getCustomerProgram(slug) { /* ... */ }
export async function addFeedback(slug, entry) { /* ... */ }
export async function updateNotes(slug, content) { /* ... */ }
export async function getNutritionPlan(slug) { /* ... */ }
```

**Chosen Against**:
- Direct Supabase calls in components: Chosen against because spreads dependencies and makes testing harder
- ORM (Prisma, Sequelize): Not chosen because scope is small (5 tables, no complex queries); DAL abstraction sufficient

---

### 4. Migration Strategy

**Decision**: Create one-time migration script that reads all `customers/` markdown files and inserts into Supabase

**Rationale**:
- One-shot operation before go-live
- Preserves all existing data unchanged
- Allows rollback (keep filesystem backup until verified)
- Can be run locally or in Vercel build step

**Process**:
1. Connect to Supabase via `@supabase/supabase-js`
2. Scan `customers/` directory for all subdirectories
3. For each customer: read program.md, feedback.md, notes.md, nutrition_plan.md
4. Parse markdown and insert into corresponding tables
5. Verify row count matches files
6. Preserve filesystem data as backup for 30 days

**Chosen Against**:
- Live migration during app usage: Chosen against because risky; requires dual-write logic and coordination
- Database-to-database replication: Not applicable (no existing database to replicate from)

---

### 5. Vercel Serverless Compatibility

**Decision**: Use connection pooling via Supabase (managed by Supabase)

**Rationale**:
- Vercel serverless functions are ephemeral (each cold start creates new connections)
- Supabase handles pooling automatically via PgBouncer
- No need for manual connection pooling in Node.js
- Prevents connection exhaustion on Vercel

**Verification**:
- Test cold starts with large dataset (>100KB customer data)
- Measure query response time (<200ms target)
- Verify data loads after redeployment

---

### 6. Environment Configuration

**Decision**: Store Supabase URL and API key in environment variables

**Rationale**:
- Supabase URL public (safe to expose); API key secret (must protect)
- Vercel environment variables encrypted at rest
- Easy to switch between dev/prod Supabase projects

**Setup**:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=eyJx... (server-side only)
```

---

## Next Steps

**Phase 1: Design** will use these findings to:
1. Create detailed PostgreSQL schema in `contracts/database-schema.md`
2. Define data access layer interface in `contracts/data-api-layer.md`
3. Design entity relationships in `data-model.md`
4. Create migration and validation guide in `quickstart.md`
