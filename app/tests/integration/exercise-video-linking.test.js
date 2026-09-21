// Integration test for the full read path described in
// specs/007-exercise-library-migration/contracts/exercise-video-linking.md:
// a real getExerciseVideoLinkMap() query feeding a real parseProgramDetail()
// call, proving the two pieces compose correctly end-to-end (unit coverage
// for each piece individually lives in tests/unit/exercise-data.test.js and
// tests/unit/markdown-parser.test.js).
//
// Deliberately does not go through the HTTP layer (server/index.js's
// handleGetCustomer) — tests/integration/customer-detail.test.js's
// fixture-filesystem-based HTTP harness is already marked superseded pending
// a rework against a Supabase test project (see that file's header); redoing
// that harness is out of scope for this feature.
//
// Requires SUPABASE_URL/SUPABASE_SECRET_KEY (see app/.env.example) and the
// `exercises` table — skips with a clear message if the env vars aren't set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getExerciseVideoLinkMap, upsertExercise } from '../../server/lib/customer-data.js';
import { getSupabaseClient } from '../../server/lib/database-client.js';
import { parseProgramDetail } from '../../server/markdown-parser.js';
import { renderMarkdown } from '../../server/markdown-render.js';

const TEST_NAME = 'Integration Test Fixture Video-Link Exercise';
const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

const PROGRAM = `# Test Program

### Monday - Full Body
1. **${TEST_NAME}** - 3 x 10 - Rest 60s
2. **Some Unrelated Exercise Not In The Library** - 3 x 10 - Rest 60s
`;

test(
  'exercise-video-linking integration (getExerciseVideoLinkMap -> parseProgramDetail)',
  { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' },
  async (t) => {
    t.after(async () => {
      const supabase = getSupabaseClient();
      await supabase.from('exercises').delete().ilike('name', TEST_NAME);
    });

    await upsertExercise(TEST_NAME, { videoUrl: 'https://example.com/fixture-video' });

    const videoLinkMap = await getExerciseVideoLinkMap();
    const detail = parseProgramDetail(PROGRAM, renderMarkdown, videoLinkMap);
    const [linked, unlinked] = detail.weeklySchedule[0].exercises;

    assert.equal(linked.videoUrl, 'https://example.com/fixture-video');
    assert.equal(unlinked.videoUrl, null);
  }
);
