// Integration tests for the exercise-library functions in
// app/server/lib/customer-data.js, against the real Supabase project — same
// rationale as tests/integration/customer-data.test.js (no separate test
// project at this scale). Uses disposable, clearly-namespaced fixture rows,
// deleted at the end of the run. Requires SUPABASE_URL/SUPABASE_SECRET_KEY
// (see app/.env.example) and the `exercises` table
// (specs/007-exercise-library-migration/contracts/database-schema.md) —
// skips with a clear message if the env vars aren't set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listExercises, getExerciseVideoLinkMap, upsertExercise } from '../../server/lib/customer-data.js';
import { getSupabaseClient } from '../../server/lib/database-client.js';

const TEST_NAME = 'Integration Test Fixture Exercise';
const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test('exercise-data.js integration', { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' }, async (t) => {
  t.after(async () => {
    const supabase = getSupabaseClient();
    await supabase.from('exercises').delete().ilike('name', TEST_NAME);
  });

  await t.test('upsertExercise inserts, then listExercises/getExerciseVideoLinkMap see it', async () => {
    const created = await upsertExercise(TEST_NAME, {
      category: 'Test',
      videoUrl: 'https://example.com/video-1',
    });
    assert.equal(created.name, TEST_NAME);
    assert.equal(created.video_url, 'https://example.com/video-1');

    const all = await listExercises();
    assert.ok(all.some((r) => r.name === TEST_NAME));

    const map = await getExerciseVideoLinkMap();
    assert.equal(map.get(TEST_NAME.toLowerCase()), 'https://example.com/video-1');
  });

  await t.test('upsertExercise called again with a different case updates the same row, not a duplicate', async () => {
    const upperCaseName = TEST_NAME.toUpperCase();
    await upsertExercise(upperCaseName, { category: 'Test', videoUrl: 'https://example.com/video-2' });

    const all = await listExercises();
    const matches = all.filter((r) => r.name.toLowerCase() === TEST_NAME.toLowerCase());
    assert.equal(matches.length, 1, 'case-insensitive upsert must not create a duplicate row');
    assert.equal(matches[0].video_url, 'https://example.com/video-2', 'the video link must have been updated');
  });

  await t.test('getExerciseVideoLinkMap excludes a row whose video_url is null', async () => {
    const unlinkedName = `${TEST_NAME} Unlinked`;
    await upsertExercise(unlinkedName, { category: 'Test' });
    t.after(async () => {
      const supabase = getSupabaseClient();
      await supabase.from('exercises').delete().eq('name', unlinkedName);
    });

    const map = await getExerciseVideoLinkMap();
    assert.equal(map.has(unlinkedName.toLowerCase()), false);
  });
});
