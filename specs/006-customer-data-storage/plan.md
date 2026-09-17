# Implementation Plan: Customer Data Storage Migration for Vercel Deployment

**Branch**: `006-customer-data-storage` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-customer-data-storage/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Migrate the Lili Trainer app from filesystem-based customer data storage (markdown files in `/customers/` directory) to Supabase PostgreSQL database to enable serverless deployment on Vercel. This requires: (1) designing a PostgreSQL schema that maps the current markdown file structure, (2) building a data access layer to abstract database reads/writes from the application, (3) creating a one-time migration script to transfer existing customer data, and (4) updating all app endpoints to use the database instead of the filesystem. The migration maintains zero regression—coaches see no change in functionality or data format, only persistence now works across Vercel redeployments.

**Scope revision (2026-09-17)**: Discovered during implementation that the codebase already has a "Coach Local Sync" feature (`specs/004-server-data-sync`) with its own state store — `server/sync-state.js` persists version numbers, content hashes, and an offline-change queue to a local JSON file (`server/data/sync-state.json`) plus an in-memory object. This store has the exact same Vercel-incompatibility problem as the customer `.md` files (doesn't survive stateless serverless functions or redeployments). Per user decision, this migration's scope now includes absorbing that sync state into Supabase (`programs`/`notes` gain `version`/`content_hash`/`last_writer`/`sync_status` columns; two new tables `sync_events` and `offline_queue_entries` replace the JSON file) rather than leaving it as a second, still-broken storage mechanism. See data-model.md and contracts/ for the updated schema, and tasks.md Phase 6 for the migration tasks.

## Technical Context

**Language/Version**: JavaScript (ES2022+), Node.js 22.5.0+

**Primary Dependencies**: 
- Frontend: Vue 3 (implicit via Vite), `marked` (v13.0.3) for markdown rendering
- Backend: Node.js with express-like server, Supabase client library
- Database: Supabase PostgreSQL (managed by Supabase)
- Build: Vite

**Storage**: Supabase PostgreSQL (replaces current filesystem-based storage)

**Testing**: Node.js test runner (`node --test tests/`)

**Target Platform**: Browser (client-side rendering) + Vercel serverless functions (backend) + Supabase database

**Project Type**: Web service - coach-only dashboard for customer fitness programs deployed on Vercel

**Performance Goals**: 
- Customer data load: <500ms (per spec SC-004)
- Database query response: <200ms average
- Zero data loss during migration
- Identical performance to filesystem reads

**Constraints**: 
- No authentication system required (coach-only, trusted environment)
- Stateless functions on Vercel (no persistent filesystem)
- Must maintain identical data format to existing markdown structure
- Zero regression on user-facing features
- Data must survive Vercel redeployments

**Scale/Scope**: Single coach, 10-50 customers, ~5-15 customers active concurrently, existing 4 customer data files per customer (program.md, feedback.md, notes.md, nutrition_plan.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I: Content & Program Quality**
- ✅ PASS: This feature only changes storage layer (filesystem → database). No content generation or modification.
- ✅ PASS: Data format remains identical—program.md, feedback.md, notes.md, nutrition_plan.md structure preserved in database.
- ✅ PASS: Content quality validated at creation time (by nutrition specialist skill, fitness coach skill). Migration doesn't modify content.

**Principle II: Verify-Before-Save Testing Standards (NON-NEGOTIABLE)**
- ✅ PASS: This feature is storage-layer only; no new customer data is created or saved.
- ✅ PASS: Migration script will read existing data and write to database unchanged; no content modification occurs.
- ✅ PASS: No new save operations on unverified data; existing verified data is preserved.

**Principle III: User Experience Consistency**
- ✅ PASS: Data structure and format identical after migration—zero visible change to coaches.
- ✅ PASS: Dates already use YYYY-MM-DD format (per constitution); preserved in database.
- ✅ PASS: Coaching voice and content tone unchanged; only storage mechanism changed.

**Principle IV: Performance & Responsiveness**
- ✅ PASS: Database query <200ms target maintains <500ms overall load time (spec SC-004).
- ✅ PASS: No redundant re-reads; database access abstracted and optimized.
- ✅ PASS: Existing data reused; no bloat from migration.

**Overall**: ✅ **NO VIOLATIONS** — Feature is storage-layer migration only. All four principles satisfied. Constitutional gates passed.

## Project Structure

### Documentation (this feature)

```text
specs/006-customer-data-storage/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit-plan command) — Supabase integration patterns
├── data-model.md        # Phase 1 output (/speckit-plan command) — PostgreSQL schema design
├── quickstart.md        # Phase 1 output (/speckit-plan command) — Migration validation guide
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── database-schema.md    # PostgreSQL table structure for Customer, Program, Feedback, Notes, NutritionPlan
│   └── data-api-layer.md     # Interface for data access layer (read/write operations)
├── checklists/          # Quality checklists
│   └── requirements.md   # Specification validation checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── components/
│   │   ├── tab-container.js         # MODIFY: Update data access to use database layer
│   │   ├── nutrition-pdf.js         # NO CHANGE
│   │   ├── program-pdf.js           # NO CHANGE
│   │   └── [other components]       # NO CHANGE
│   ├── views/
│   │   └── customer-view.js         # MODIFY: Replace filesystem reads with database calls
│   ├── lib/
│   │   ├── database.js              # NEW: Data access layer (abstract database operations)
│   │   ├── database-client.js       # NEW: Supabase client initialization
│   │   └── customer-data.js         # NEW: Customer data CRUD operations
│   └── styles/
│       └── [existing styles]         # NO CHANGE
│
├── server/
│   ├── serve.js                     # MODIFY: Replace filesystem reads with database calls
│   └── migrations/
│       └── migrate-data.js           # NEW: One-time migration script (filesystem → Supabase)
│
├── tests/
│   ├── unit/
│   │   └── database.test.js         # NEW: Unit tests for data access layer
│   └── integration/
│       └── customer-data.test.js    # NEW: Integration tests with Supabase
│
├── .env.example                      # MODIFY: Add SUPABASE_URL and SUPABASE_KEY
└── package.json                      # MODIFY: Add @supabase/supabase-js dependency

customers/                            # DEPRECATED (after migration verification)
├── [customer-name]/
│   ├── program.md
│   ├── feedback.md
│   ├── notes.md
│   └── nutrition_plan.md
```

**Structure Decision**: Single full-stack project (Vite frontend + Node.js backend) with new data access layer abstraction. Files are modified to use database instead of filesystem, but directory structure and build system remain unchanged. Migration script runs once before go-live. Existing filesystem data preserved as backup during transition period.

## Complexity Tracking

> **No violations detected** — Constitution Check passed without exceptions. This section not needed.
