// Integration test for backfill-missing-exercises.js's shared backfillExercises()
// loop, per contracts/exercise-backfill-data.md's Testing Checklist. Uses a
// small, disposable, clearly-namespaced fixture set — NEVER the real
// MISSING_EXERCISES data — following the test-safety rule from research.md §4
// (a specs/007 unit test once upserted a real exercise name with no cleanup and
// silently wiped its real video link).
//
// Requires SUPABASE_URL/SUPABASE_SECRET_KEY (see app/.env.example) — skips
// with a clear message if not set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillExercises } from '../../server/scripts/backfill-missing-exercises.js';
import { listExercises } from '../../server/lib/customer-data.js';
import { getSupabaseClient } from '../../server/lib/database-client.js';

const FIXTURE_PREFIX = 'Coverage Backfill Test Fixture —';
const FIXTURE_ENTRIES = [
  { name: `${FIXTURE_PREFIX} A`, category: 'Test', videoUrl: 'https://example.com/fixture-a' },
  { name: `${FIXTURE_PREFIX} B`, category: 'Test', videoUrl: 'https://example.com/fixture-b' },
];

const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test(
  'backfillExercises integration',
  { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' },
  async (t) => {
    t.after(async () => {
      const supabase = getSupabaseClient();
      await supabase.from('exercises').delete().ilike('name', `${FIXTURE_PREFIX}%`);
    });

    await t.test('first run adds every fixture entry', async () => {
      const result = await backfillExercises(FIXTURE_ENTRIES);
      assert.deepEqual(result, { added: 2, skipped: 0 });

      const rows = await listExercises();
      for (const entry of FIXTURE_ENTRIES) {
        const row = rows.find((r) => r.name === entry.name);
        assert.ok(row, `expected "${entry.name}" to have been added`);
        assert.equal(row.video_url, entry.videoUrl);
      }
    });

    await t.test('second run with the same entries adds nothing (idempotent)', async () => {
      const result = await backfillExercises(FIXTURE_ENTRIES);
      assert.deepEqual(result, { added: 0, skipped: 2 });
    });

    await t.test('an already-present fixture row is left untouched, not overwritten', async () => {
      const differentVideoUrl = 'https://example.com/should-not-be-applied';
      const result = await backfillExercises([{ ...FIXTURE_ENTRIES[0], videoUrl: differentVideoUrl }]);
      assert.deepEqual(result, { added: 0, skipped: 1 });

      const rows = await listExercises();
      const row = rows.find((r) => r.name === FIXTURE_ENTRIES[0].name);
      assert.equal(row.video_url, FIXTURE_ENTRIES[0].videoUrl, 'existing row must keep its original video_url');
    });
  }
);
