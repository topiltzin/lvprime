/**
 * Publish a customer's local MD file (program/notes/nutrition_plan) to
 * Supabase — the "how do local edits reach the DB" step for coach-authored
 * changes. Uses the same coach-always-wins sync path as POST /api/sync/upload
 * (see server/lib/customer-data.js's syncCoachWrite), called directly against
 * Supabase rather than over HTTP.
 *
 * If the customer doesn't exist in Supabase yet, creates it first (upsertCustomer)
 * instead of failing — covers new customers, not just updates to existing ones.
 *
 * Run from app/:
 *   node --env-file=.env.local server/scripts/publish.js <slug> <program|notes|nutrition_plan>
 * or:
 *   npm run publish -- <slug> <program|notes|nutrition_plan>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeContentHash } from '../hash-utils.js';
import {
  getCustomer,
  upsertCustomer,
  getSyncState,
  syncCoachWrite,
  CustomerNotFoundError,
} from '../lib/customer-data.js';
import { checkCoverage, formatCoverageReport } from './check-exercise-coverage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/scripts -> server -> app -> repo root -> customers/
const CUSTOMERS_DIR = path.resolve(__dirname, '..', '..', '..', 'customers');

const FILE_BY_TYPE = {
  program: 'program.md',
  notes: 'notes.md',
  nutrition_plan: 'nutrition_plan.md',
};

function toDisplayName(slug) {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Reports exercise-coverage gaps (specs/008-exercise-coverage-backfill) as
 * part of a program publish's own output (specs/009-publish-coverage-check
 * FR-001, FR-003). Never throws — a failed check must never turn a
 * successful publish into a failed one (FR-004); any error is logged as a
 * warning and swallowed here so callers never need their own try/catch.
 */
export async function reportProgramCoverage() {
  try {
    const report = await checkCoverage();
    console.log('\n' + formatCoverageReport(report));
  } catch (err) {
    console.warn('Exercise coverage check failed (publish already succeeded):', err.message);
  }
}

async function main() {
  const [slug, fileType] = process.argv.slice(2);
  if (!slug || !FILE_BY_TYPE[fileType]) {
    console.error(`Usage: node server/scripts/publish.js <slug> <${Object.keys(FILE_BY_TYPE).join('|')}>`);
    process.exit(1);
  }

  const filePath = path.join(CUSTOMERS_DIR, slug, FILE_BY_TYPE[fileType]);
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    console.error(`No local file found at ${filePath}`);
    process.exit(1);
  }

  try {
    await getCustomer(slug);
  } catch (err) {
    if (!(err instanceof CustomerNotFoundError)) throw err;
    const name = toDisplayName(slug);
    console.log(`Customer "${slug}" not found in Supabase yet — creating as "${name}".`);
    await upsertCustomer(slug, name);
  }

  const state = await getSyncState(slug, fileType);
  const currentVersion = state ? state.version : 0;
  const contentHash = computeContentHash(content);

  const result = await syncCoachWrite(slug, fileType, { currentVersion, content, contentHash });

  console.log(
    `Published ${slug}/${fileType}: version ${currentVersion} -> ${result.newVersion}` +
      (result.conflicted ? ' (server had a newer version; coach changes applied anyway)' : '')
  );

  if (fileType === 'program') await reportProgramCoverage();
}

// Guarded so importing reportProgramCoverage() for testing doesn't also run
// main() (which reads process.argv and would exit the test process).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Publish failed:', err.message);
    process.exit(1);
  });
}
