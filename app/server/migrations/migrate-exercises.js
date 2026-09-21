/**
 * One-time migration: repo-root exercise.md -> Supabase `exercises` table.
 *
 * Idempotent: an exercise whose name (case-insensitively) already exists in
 * `exercises` is skipped, not overwritten, so this script is safe to re-run
 * after a partial failure — same convention as migrate-data.js.
 *
 * Run: node server/migrations/migrate-exercises.js   (from the app/ directory)
 * See specs/007-exercise-library-migration/quickstart.md Scenario 2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listExercises, upsertExercise } from '../lib/customer-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXERCISE_MD_PATH = path.resolve(__dirname, '..', '..', '..', 'exercise.md');

const CATEGORY_HEADING = /^##\s+(.+)$/;
// A Markdown table row with exactly two cells; only rows whose second cell is
// a real http(s) URL are exercise rows — this naturally skips the header row
// ("| Exercise | How-to video |") and the separator row ("|---|---|") without
// needing to special-case them.
const TABLE_ROW = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/;
const HTTP_URL = /^https?:\/\//i;

export function parseExerciseMd(text) {
  const rows = [];
  let category = null;
  for (const line of text.split(/\r?\n/)) {
    const headingMatch = line.match(CATEGORY_HEADING);
    if (headingMatch) {
      category = headingMatch[1].trim();
      continue;
    }
    const rowMatch = line.match(TABLE_ROW);
    if (!rowMatch) continue;
    const [, name, link] = rowMatch;
    if (!HTTP_URL.test(link)) continue;
    rows.push({ name: name.trim(), category, videoUrl: link.trim() });
  }
  return rows;
}

async function main() {
  const text = fs.readFileSync(EXERCISE_MD_PATH, 'utf8');
  const rows = parseExerciseMd(text);
  if (rows.length === 0) {
    throw new Error(`No exercise rows parsed from ${EXERCISE_MD_PATH} — refusing to run against an empty result.`);
  }

  const existing = await listExercises();
  const alreadyPresent = new Set(existing.map((r) => r.name.trim().toLowerCase()));

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (alreadyPresent.has(row.name.toLowerCase())) {
      skipped++;
      continue;
    }
    await upsertExercise(row.name, { category: row.category, videoUrl: row.videoUrl });
    inserted++;
  }

  console.log(
    `Migrated ${inserted} exercise(s), skipped ${skipped} already present, out of ${rows.length} parsed from exercise.md.`
  );
}

// Guarded so importing parseExerciseMd() for unit testing
// (tests/unit/migrate-exercises.test.js) doesn't also run the migration.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
