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
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Validation Rules**:
- `content` MUST be valid UTF-8 markdown text
- `content` MUST NOT exceed 500KB
- One active program per customer_id (no versioning in MVP)

**Example Row**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "# 12-Week Muscle Gain Program\n\n## Week 1\n...",
  "updated_at": "2026-09-16T09:00:00Z"
}
```

---

## Entity: Feedback

**Purpose**: Stores customer's progress log (formerly feedback.md)

**Storage**: `feedbacks` table in PostgreSQL

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique feedback record ID |
| `customer_id` | UUID | FOREIGN KEY (customers.id), NOT NULL | Links to customer |
| `entries` | JSONB | NOT NULL, DEFAULT '[]'::jsonb | Array of feedback entries |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Entries Schema** (JSONB array):
```json
[
  {
    "date": "2026-09-16",
    "week": "Week 1",
    "how_customer_felt": "Strong energy, good form",
    "completed": true,
    "notes": "All exercises completed as prescribed",
    "overall_impression": "Moderate"
  },
  {
    "date": "2026-09-15",
    "week": "Week 1",
    "how_customer_felt": "Fatigued, sore shoulders",
    "completed": false,
    "notes": "Skipped shoulder day due to soreness",
    "overall_impression": "Hard"
  }
]
```

**Validation Rules**:
- Each entry MUST have: date (YYYY-MM-DD), how_customer_felt, completed (boolean), notes, overall_impression
- Dates MUST be in YYYY-MM-DD format
- overall_impression must be one of: Easy, Moderate, Hard

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
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Validation Rules**:
- `content` MUST be valid UTF-8 markdown text
- Insights MUST cite specific dated feedback entries (enforced at app level)
- `content` MUST NOT exceed 500KB

**Example Row**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "## Observations\n\n- 2026-09-16: Customer finding squats challenging → suggest tempo squats\n- 2026-09-15: Fatigue pattern on Mondays → recommend rest day adjustment",
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
- `content` MUST NOT exceed 500KB
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

## Key Relationships

```
Customer (1)
  ├── has_one Program
  ├── has_one Feedback
  ├── has_one Notes
  └── has_one NutritionPlan
```

**Cardinality**:
- One customer has exactly one active program, one feedback log, one notes document, one nutrition plan
- Each program/feedback/notes/nutrition_plan belongs to one customer
- No versioning or historical tracking in MVP (updates overwrite previous)

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

- **Tables**: 5 (customers, programs, feedbacks, notes, nutrition_plans)
- **Relationships**: One-to-one (customer to each data type)
- **Data Format**: Markdown content preserved as TEXT columns; metadata as structured columns
- **Scale**: Supports 10-50 customers, typical data size 50KB-500KB per customer
- **Migration**: One-time script converts filesystem to database with zero data loss

---

## Future Extensibility

This model supports future enhancements:
- **Versioning**: Add `version_id`, `version_date` to track historical versions
- **Collaboration**: Add `created_by`, `last_updated_by` for multi-coach scenarios
- **Attachments**: Add separate `files` table for PDFs, images
- **Archival**: Add `is_archived` flag for inactive customers
