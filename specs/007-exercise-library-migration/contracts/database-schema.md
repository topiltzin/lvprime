# Contract: `exercises` Table Schema

**Extends**: specs/006-customer-data-storage/contracts/database-schema.md (same database, same
conventions — UUID PKs, `NOW()`-defaulted timestamps, one `CREATE TABLE` + index block)

**Requirement Refs**: FR-001, FR-002, FR-007, FR-008, Data Model → Exercise

---

## DDL

```sql
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  video_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_exercises_name_lower ON exercises (LOWER(name));
```

## Constraints

- `name` is required and effectively unique case-insensitively via the functional unique index —
  an insert/update whose `LOWER(name)` collides with an existing row fails at the database level
  (belt-and-suspenders alongside the application-level check in exercise-data-api.md).
- `video_url` is nullable. `NULL` is the documented "not yet linked" state (FR-005), not an error
  state — no `CHECK` constraint should reject it.
- `category` is unconstrained free text.
- No foreign keys to/from this table — it is not customer-scoped (unlike every other table in
  specs/006's schema, which carries a `customer_id`).

## Acceptance Criteria

- [ ] Running this DDL against a Supabase project that already has the specs/006 schema succeeds
      with no conflicts (table/index name collisions).
- [ ] Inserting two rows whose `name` differs only by case (e.g. "Push-up" / "push-up") fails on
      the second insert with a unique-violation error.
- [ ] Inserting a row with `video_url` omitted/`NULL` succeeds.
- [ ] `SELECT * FROM exercises WHERE LOWER(name) = LOWER($1)` uses `idx_exercises_name_lower`
      (verify via `EXPLAIN`) rather than a sequential scan, so lookups stay cheap as the table
      grows.
