// Structural integrity check for the exercises table. Originally cross-
// referenced the migrated rows against exercise.md (per
// specs/007-exercise-library-migration/quickstart.md Scenario 2, spec
// SC-001) — that comparison ran once, confirmed all 39 exercises migrated
// correctly, and exercise.md was then deleted per spec FR-009/US3, so a
// test depending on it would break permanently. What remains has ongoing
// regression value: the case-insensitive-uniqueness property (spec FR-008)
// that keeps upsertExercise() idempotent no matter how many times the
// (now-historical) migration script or any future manual edit runs.
//
// Requires SUPABASE_URL/SUPABASE_SECRET_KEY (see app/.env.example) — skips
// with a clear message if not set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listExercises } from '../../server/lib/customer-data.js';

const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test(
  'exercises table has no case-duplicate names and every row has a name',
  { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' },
  async () => {
    const rows = await listExercises();
    assert.ok(rows.length > 0, 'expected at least one migrated exercise');

    for (const row of rows) {
      assert.ok(row.name && row.name.trim().length > 0, 'every row must have a non-empty name');
    }

    const names = rows.map((r) => r.name.toLowerCase());
    assert.equal(new Set(names).size, names.length, 'expected no case-duplicate exercise names in the table');
  }
);
