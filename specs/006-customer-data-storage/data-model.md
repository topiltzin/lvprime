# Phase 1: Data Model — Customer Data Storage on Supabase PostgreSQL

**Date**: 2026-09-17  
**Status**: Complete

## Overview

This section defines the PostgreSQL schema and data structures for storing customer fitness data in Supabase, replacing the current filesystem-based markdown storage.

---

## Entity: Customer

**Purpose**: Represents a fitness coaching client

**Storage**: `customers` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique customer ID |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | URL-friendly identifier (e.g., "jaqueline-orellano") |
| `name` | VARCHAR(255) | NOT NULL | Customer's display name |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation date |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Example Row**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "jaqueline-orellano",
  "name": "Jaqueline Orellano",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-09-17T14:22:00Z"
}
```

---

## Entity: Program

**Purpose**: Stores customer's current workout routine (formerly program.md)

**Storage**: `programs` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique program ID |
| `customer_id` | UUID | FOREIGN KEY (customers.id), NOT NULL | Links to customer |
| `content` | TEXT | NOT NULL | Full markdown content from program.md |
| `version` | INTEGER | NOT NULL, DEFAULT 0 | Optimistic-concurrency version, replaces sync-engine's file-mtime tracking |
| `content_hash` | VARCHAR(64) | NULLABLE | SHA256 hex of `content`, replaces hash-utils.js file-based hashing |
| `last_writer` | VARCHAR(20) | NULLABLE, CHECK (last_writer IN ('coach','customer')) | Who wrote the current version (per sync-engine.js "coach-always-wins") |
| `sync_status` | VARCHAR(20) | NOT NULL, DEFAULT 'synced', CHECK (sync_status IN ('synced','pending','conflicted')) | Mirrors sync-state.js `sync_status` |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Validation Rules**:
- `content` MUST be valid UTF-8 markdown text
- `content` MUST NOT exceed 500KB
- One row per customer_id; updates increment `version` rather than creating new rows (matches sync-engine.js `resolveCoachSync`: `new_version = serverVersion + 1`)
- `content_hash` MUST be a 64-character lowercase hex string when set (per hash-utils.js `isValidHashFormat`)

**Example Row**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "# 12-Week Muscle Gain Program\n\n## Week 1\n...",
  "version": 3,
  "content_hash": "a1b2c3...64chars",
  "last_writer": "coach",
  "sync_status": "synced",
  "updated_at": "2026-09-16T09:00:00Z"
}
```

---

## Entity: Feedback

**Purpose**: Stores customer's progress log (formerly feedback.md)

**Schema revision (2026-09-17)**: The original version of this entity modeled entries as a fixed JSONB shape (`{date, week, how_customer_felt, completed, notes, overall_impression}` with a strict `Easy|Moderate|Hard` enum). That does not match production: `app/server/markdown-parser.js`'s `extractFeedbackTemplate`/`parseFeedbackEntries`/`formatFeedbackEntry` treat each customer's `feedback.md` as having its **own freeform field template**, extracted from a "Formato de Entrada" example block in the file itself — e.g. `customers/jaqueline-orellano/feedback.md` uses Spanish fields like "Energía", "Dificultad", "Ejercicio más difícil", "Dolor articular", "Ardor muscular", none of which fit the invented schema. Forcing entries into the fixed shape would silently drop most real data. Corrected below to store raw markdown, matching Program/Notes/NutritionPlan.

**Storage**: `feedbacks` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique feedback record ID |
| `customer_id` | UUID | FOREIGN KEY (customers.id), NOT NULL | Links to customer |
| `content` | TEXT | NOT NULL, DEFAULT '' | Full raw markdown content from feedback.md, including the customer's own "Formato de Entrada" template block |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Validation Rules**:
- `content` MUST be valid UTF-8 markdown text
- `content` MUST NOT exceed 500KB (same limit as Program/Notes)
- Entries are never parsed/validated at the storage layer — `parseFeedbackEntries(content)` and `extractFeedbackTemplate(content)` (pure functions, no filesystem dependency, reused unchanged from `markdown-parser.js`) derive structured entries/template on read; `formatFeedbackEntry(template, {date, label, fieldValues})` + append derives the new `content` on write, mirroring `feedback-writer.js`'s existing `appendFeedbackEntry` logic exactly, just reading/writing Supabase instead of the filesystem
- One row per customer_id; empty string (`''`) means no feedback logged yet

---

## Entity: Notes

**Purpose**: Stores coach's observations and insights (formerly notes.md)

**Storage**: `notes` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique notes record ID |
| `customer_id` | UUID | FOREIGN KEY (customers.id), NOT NULL | Links to customer |
| `content` | TEXT | NOT NULL | Full markdown content from notes.md |
| `version` | INTEGER | NOT NULL, DEFAULT 0 | Optimistic-concurrency version (same pattern as `programs.version`) |
| `content_hash` | VARCHAR(64) | NULLABLE | SHA256 hex of `content` |
| `last_writer` | VARCHAR(20) | NULLABLE, CHECK (last_writer IN ('coach','customer')) | Who wrote the current version |
| `sync_status` | VARCHAR(20) | NOT NULL, DEFAULT 'synced', CHECK (sync_status IN ('synced','pending','conflicted')) | Mirrors sync-state.js `sync_status` |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Validation Rules**:
- `content` MUST be valid UTF-8 markdown text
- Insights MUST cite specific dated feedback entries (enforced at app level)
- `content` MUST NOT exceed 500KB
- `content_hash` MUST be a 64-character lowercase hex string when set

**Example Row**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "## Observations\n\n- 2026-09-16: Customer finding squats challenging → suggest tempo squats\n- 2026-09-15: Fatigue pattern on Mondays → recommend rest day adjustment",
  "version": 1,
  "content_hash": "d4e5f6...64chars",
  "last_writer": "coach",
  "sync_status": "synced",
  "updated_at": "2026-09-17T08:45:00Z"
}
```

---

## Entity: NutritionPlan

**Purpose**: Stores customer's nutrition guidance (formerly nutrition_plan.md)

**Storage**: `nutrition_plans` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique nutrition plan ID |
| `customer_id` | UUID | FOREIGN KEY (customers.id), NOT NULL | Links to customer |
| `content` | TEXT | NOT NULL | Full markdown content from nutrition_plan.md |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Validation Rules**:
- `content` MUST be valid UTF-8 markdown text
- `content` MUST NOT exceed 100KB (per specs/005-nutrition-plan-tab FR-008; existing production behavior returns HTTP 413 above this — kept at 100KB here, not the 500KB used for programs/notes, to avoid a regression)
- One active nutrition plan per customer_id (no versioning in MVP)

**Example Row**:
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "# Nutrition Plan: Jaqueline Orellano\n\n## Meta Nutricional Diaria\n...",
  "updated_at": "2026-09-16T12:00:00Z"
}
```

---

## Entity: SyncEvent

**Purpose**: Audit log of sync activity, replacing the in-memory + JSON-file `_syncLog` in `server/sync-state.js` (which does not survive Vercel cold starts or redeploys)

**Storage**: `sync_events` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique event ID |
| `customer_id` | UUID | FOREIGN KEY (customers.id), NOT NULL | Links to customer |
| `file_type` | VARCHAR(20) | NOT NULL, CHECK (file_type IN ('program','feedback','notes')) | Matches sync-state.js `file_type` values |
| `event_type` | VARCHAR(20) | NOT NULL, CHECK (event_type IN ('sync_start','sync_success','sync_conflict','sync_error')) | Matches sync-state.js `recordSyncEvent` event types |
| `source` | VARCHAR(20) | NULLABLE, CHECK (source IN ('coach','customer')) | Who triggered the event |
| `version_from` | INTEGER | NULLABLE | Version before this event |
| `version_to` | INTEGER | NULLABLE | Version after this event |
| `conflict_description` | TEXT | NULLABLE | Human-readable conflict detail (per sync-engine.js messages) |
| `error_message` | TEXT | NULLABLE | Error detail if `event_type = 'sync_error'` |
| `content_hash` | VARCHAR(64) | NULLABLE | Hash associated with this event |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Event timestamp (replaces sync-state.js's manual `timestamp` field) |

**Validation Rules**:
- Append-only; rows are never updated or deleted (audit log semantics, matching current `_syncLog.push()` behavior)
- Queried via `getRecentSyncEvents(customer_id, limit)` ordered by `created_at DESC`

---

## Entity: OfflineQueueEntry

**Purpose**: Persists coach changes queued while offline, replacing the JSON-array-in-JSON-file queue in `server/offline-queue.js` / `sync-state.js`

**Storage**: `offline_queue_entries` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique queue entry ID |
| `customer_id` | UUID | FOREIGN KEY (customers.id), NOT NULL | Links to customer |
| `file_type` | VARCHAR(20) | NOT NULL, CHECK (file_type IN ('program','notes')) | Matches offline-queue.js constraint: "Must be 'program' or 'notes'" |
| `sequence` | INTEGER | NOT NULL | Per-customer-per-file_type sequence number; MUST start at 1 and increment without gaps (per offline-queue.js `queueChange` validation) |
| `queued_at` | TIMESTAMP | NOT NULL | Client-supplied ISO8601 timestamp (validated per offline-queue.js: "Must be ISO8601") |
| `action` | VARCHAR(20) | NOT NULL | Action type recorded in the original queue entry |
| `content_hash` | VARCHAR(64) | NOT NULL | SHA256 hex string, 64 chars (per offline-queue.js format check) |
| `content_size_bytes` | INTEGER | NOT NULL, CHECK (content_size_bytes > 0) | Must be > 0 (per offline-queue.js validation) |
| `description` | TEXT | NULLABLE | Optional human-readable description |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Row insertion time |
| | | UNIQUE(customer_id, file_type, sequence) | Enforces sequence continuity per customer/file_type |

**Validation Rules**:
- `sequence` MUST start at 1 for the first entry per (customer_id, file_type) and increment by exactly 1 for each subsequent entry (per offline-queue.js: "First sequence must be 1", "Sequence gap: expected N+1")
- `content_hash` MUST match regex `^[a-f0-9]{64}$` (case-insensitive, per offline-queue.js)
- Entries are cleared (deleted) after a successful flush/sync, matching `clearQueue()` behavior

---

## Key Relationships

```
Customer (1)
  ├── has_one Program (versioned: version, content_hash, last_writer, sync_status)
  ├── has_one Feedback
  ├── has_one Notes (versioned: version, content_hash, last_writer, sync_status)
  ├── has_one NutritionPlan
  ├── has_many SyncEvent (append-only audit log)
  └── has_many OfflineQueueEntry (per file_type, cleared after flush)
```

**Cardinality**:
- One customer has exactly one active program, one feedback log, one notes document, one nutrition plan
- Each program/feedback/notes/nutrition_plan belongs to one customer
- Program and Notes carry a `version` counter that increments on every coach/customer write (absorbs `sync-engine.js` optimistic concurrency); Feedback and NutritionPlan remain unversioned (no concurrent-edit conflict scenario for them today)
- SyncEvent rows are never updated or deleted; OfflineQueueEntry rows are deleted once flushed

---

## Validation & State Transitions

### File Migration (Filesystem → Database)

**Initial State**: `customers/[name]/{program,feedback,notes,nutrition_plan}.md` files on filesystem

**Transition**: Migration script reads all markdown files and inserts into respective tables

**Final State**: Customer data exists in Supabase PostgreSQL; filesystem data retained as backup

### Data Consistency Rules

- **Program**: One per customer; updating replaces entire content
- **Feedback**: Entries array grows over time; new entries appended, past entries never deleted
- **Notes**: One per customer; updating replaces entire content
- **NutritionPlan**: One per customer; updating replaces entire content

### Error Handling

**Scenario**: Database unavailable during customer profile load

**Handling**:
```javascript
try {
  const customer = await getCustomer(slug)
  // Render customer data
} catch (err) {
  // Display user-friendly error message
  showToast('Unable to load customer data. Please try again.', 'error')
}
```

**Scenario**: Partial write failure during migration

**Handling**: Migration script transaction rollback; retry or manual intervention

---

## Summary

- **Tables**: 7 (customers, programs, feedbacks, notes, nutrition_plans, sync_events, offline_queue_entries)
- **Relationships**: One-to-one for customer→program/feedback/notes/nutrition_plan; one-to-many for customer→sync_events/offline_queue_entries
- **Data Format**: Markdown content preserved as TEXT columns; metadata as structured columns
- **Scale**: Supports 10-50 customers, typical data size 50KB-500KB per customer
- **Migration**: One-time script converts filesystem to database with zero data loss
- **Sync/Offline Absorption**: `sync_events` and `offline_queue_entries` replace `server/sync-state.js`'s JSON-file-backed store, making the existing "Coach Local Sync" feature (specs/004-server-data-sync) Vercel-compatible

---

## Future Extensibility

This model supports future enhancements:
- **Versioning**: Add `version_id`, `version_date` to track historical versions
- **Collaboration**: Add `created_by`, `last_updated_by` for multi-coach scenarios
- **Attachments**: Add separate `files` table for PDFs, images
- **Archival**: Add `is_archived` flag for inactive customers
