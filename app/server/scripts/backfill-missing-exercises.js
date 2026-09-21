/**
 * One-time backfill: adds every entry in missing-exercises-data.js to the
 * exercises library, skipping (not overwriting) any name already present.
 * See specs/008-exercise-coverage-backfill/contracts/exercise-backfill-data.md.
 *
 * Idempotent: safe to re-run — an already-present name (case-insensitive) is
 * skipped, never overwritten, same convention as migrate-exercises.js.
 *
 * Run: node server/scripts/backfill-missing-exercises.js   (from the app/ directory)
 */
import { listExercises, upsertExercise } from '../lib/customer-data.js';
import { MISSING_EXERCISES } from './missing-exercises-data.js';

/**
 * Core backfill loop, shared by main() and the integration test (per
 * contracts/exercise-backfill-data.md's Testing Checklist — the test must
 * exercise this exact code path, not a re-implementation of it, against a
 * small disposable fixture array instead of the real MISSING_EXERCISES).
 * @param {Array<{name: string, category: string, videoUrl: string}>} entries
 * @returns {Promise<{added: number, skipped: number}>}
 */
export async function backfillExercises(entries) {
  const existing = await listExercises();
  const alreadyPresent = new Set(existing.map((r) => r.name.trim().toLowerCase()));

  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (alreadyPresent.has(entry.name.trim().toLowerCase())) {
      skipped++;
      continue;
    }
    await upsertExercise(entry.name, { category: entry.category, videoUrl: entry.videoUrl });
    added++;
  }
  return { added, skipped };
}

async function main() {
  if (MISSING_EXERCISES.length === 0) {
    throw new Error('missing-exercises-data.js exported an empty MISSING_EXERCISES array — refusing to run against nothing.');
  }
  const { added, skipped } = await backfillExercises(MISSING_EXERCISES);
  console.log(`Added ${added} exercise(s). Skipped ${skipped} (already present).`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
