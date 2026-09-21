// Unit tests for app/server/lib/customer-data.js's exercise-library
// validation logic. Like tests/unit/database.test.js, this only covers paths
// that throw before touching the network — upsertExercise validates name/
// videoUrl synchronously before calling getSupabaseClient(). Success-path
// round trips (listExercises, getExerciseVideoLinkMap, a real upsert) are
// covered by tests/integration/exercise-data.test.js against a real Supabase
// project instead (see that file's header for why no client mocking is used).
import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertExercise, ValidationError } from '../../server/lib/customer-data.js';

test('upsertExercise rejects an empty or oversized name before any DB call', async () => {
  await assert.rejects(() => upsertExercise('', { videoUrl: 'https://x.example/video' }), ValidationError);
  await assert.rejects(() => upsertExercise('   ', { videoUrl: 'https://x.example/video' }), ValidationError);
  await assert.rejects(
    () => upsertExercise('a'.repeat(256), { videoUrl: 'https://x.example/video' }),
    ValidationError
  );
});

test('upsertExercise rejects a non-http(s) videoUrl before any DB call', async () => {
  await assert.rejects(() => upsertExercise('Some Fixture Exercise Name', { videoUrl: 'not-a-url' }), ValidationError);
  await assert.rejects(
    () => upsertExercise('Some Fixture Exercise Name', { videoUrl: 'ftp://x.example/video' }),
    ValidationError
  );
});

// "Accepts a null/omitted videoUrl" is deliberately NOT unit-tested here: proving
// that requires letting the call reach the network, which — unlike the
// ValidationError paths above — cannot use a throwaway name safely, since a real
// exercise name would silently overwrite a real row's data (this happened once
// during development: an earlier version of this test used 'Deadlift' and wiped
// its real video_url when run with real Supabase credentials loaded). That
// success path is covered safely instead by
// tests/integration/exercise-data.test.js's disposable, cleaned-up fixture row.
