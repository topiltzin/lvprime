# Contract: Database Schema Delta

**Builds on**: `specs/006-customer-data-storage/contracts/database-schema.md` v1.2
**Requirement Refs**: FR-001, FR-002, FR-004, FR-008, FR-009

---

## `programs` table

```sql
ALTER TABLE programs
  DROP CONSTRAINT programs_customer_id_key;          -- was UNIQUE(customer_id)

ALTER TABLE programs
  ADD COLUMN week_number INTEGER NOT NULL DEFAULT 1
    CHECK (week_number >= 1);

ALTER TABLE programs
  ADD CONSTRAINT programs_customer_id_week_number_key
    UNIQUE (customer_id, week_number);

ALTER TABLE programs
  ALTER COLUMN week_number DROP DEFAULT;             -- DEFAULT 1 was only for backfilling existing rows
```

Existing rows (one per customer, pre-dating this feature) backfill to `week_number = 1` via the
`DEFAULT 1` above, applied before the default is dropped — every existing customer's current
`program.md` content becomes their week 1 routine, satisfying `spec.md`'s Assumptions.

**Locked-write enforcement**: not a database constraint — enforced in the application layer
(`syncCoachWrite`/`updateCustomerProgram`, see `weekly-routine-api.md`) by comparing the target
`week_number` against `MAX(week_number) FOR customer_id` before writing, per data-model.md's
derived `is_locked` rule. A `CHECK` constraint cannot express "reject unless this is the max row
for this customer" declaratively without a trigger, and a trigger is unnecessary complexity when
every write already goes through one shared function.

## `sync_events` table

```sql
ALTER TABLE sync_events
  ADD COLUMN week_number INTEGER NULL;
```

`week_number` is populated for `file_type = 'program'` events, `NULL` otherwise.

## `offline_queue_entries` table

```sql
ALTER TABLE offline_queue_entries
  ADD COLUMN week_number INTEGER NULL;
```

Same rule: populated only for `file_type = 'program'` entries.

## Acceptance Criteria

- [ ] A customer can have more than one `programs` row (previously impossible under
      `UNIQUE(customer_id)`).
- [ ] Inserting a second row for the same `(customer_id, week_number)` pair fails with a unique
      violation.
- [ ] Every pre-existing `programs` row for a real customer has `week_number = 1` after
      migration, and that customer's existing program content is unchanged.
- [ ] `sync_events` and `offline_queue_entries` rows created before this migration have
      `week_number = NULL` and continue to be readable/writable exactly as before for
      `'notes'`/`'nutrition_plan'`/`'feedback'` file types.
