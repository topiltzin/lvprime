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
 *   node --env-file=.env.local server/scripts/publish.js <slug> program [--week <N> | --new-week]
 *
 * program with no flag updates the current week; --new-week starts the next
 * week and locks the previous one (specs/010 contracts/publish-cli.md).
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
  listCustomerProgramWeeks,
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

const USAGE =
  `Usage: node server/scripts/publish.js <slug> <${Object.keys(FILE_BY_TYPE).join('|')}>\n` +
  '       node server/scripts/publish.js <slug> program [--week <N> | --new-week]';

// Returns { week: number|null, newWeek: boolean } or null for invalid flags.
export function parseWeekFlags(fileType, flags) {
  if (flags.length === 0) return { week: null, newWeek: false };
  if (fileType !== 'program') return null;
  if (flags.length === 1 && flags[0] === '--new-week') return { week: null, newWeek: true };
  if (flags.length === 2 && flags[0] === '--week') {
    const week = Number(flags[1]);
    return Number.isInteger(week) && week >= 1 ? { week, newWeek: false } : null;
  }
  return null;
}

async function main() {
  const [slug, fileType, ...flags] = process.argv.slice(2);
  const weekFlags = FILE_BY_TYPE[fileType] ? parseWeekFlags(fileType, flags) : null;
  if (!slug || !weekFlags) {
    console.error(USAGE);
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

  let weekNumber = null;
  let previousWeek = 0;
  if (fileType === 'program') {
    const weeks = await listCustomerProgramWeeks(slug);
    previousWeek = weeks.length ? weeks[weeks.length - 1].weekNumber : 0;
    if (weekFlags.newWeek) {
      if (previousWeek === 0) {
        throw new Error(`${slug} has no program yet; publish without --new-week to create week 1.`);
      }
      weekNumber = previousWeek + 1;
    } else {
      weekNumber = weekFlags.week ?? Math.max(previousWeek, 1);
    }
  }

  const state = await getSyncState(slug, fileType, weekNumber);
  const currentVersion = weekNumber > previousWeek || !state ? 0 : state.version;
  const contentHash = computeContentHash(content);

  let result;
  try {
    result = await syncCoachWrite(slug, fileType, { weekNumber, currentVersion, content, contentHash });
  } catch (err) {
    if (err.code === 'WEEK_LOCKED') {
      throw new Error(
        `week ${err.weekNumber} is locked (current week is ${err.currentWeek}). ` +
          'Use --new-week to start a new week, or omit --week to update the current one.'
      );
    }
    if (err.code === 'WEEK_NUMBER_GAP') {
      throw new Error(`week ${err.weekNumber} would leave a gap (next available is ${err.expected}).`);
    }
    throw err;
  }

  const conflictNote = result.conflicted ? ' (server had a newer version; coach changes applied anyway)' : '';
  if (fileType !== 'program') {
    console.log(`Published ${slug}/${fileType}: version ${currentVersion} -> ${result.newVersion}${conflictNote}`);
  } else if (weekNumber > previousWeek && previousWeek > 0) {
    console.log(
      `Published ${slug}/program: created week ${weekNumber} (was week ${previousWeek}, now locked): ` +
        `version ${currentVersion} -> ${result.newVersion}`
    );
  } else {
    console.log(
      `Published ${slug}/program (week ${weekNumber}): version ${currentVersion} -> ${result.newVersion}${conflictNote}`
    );
  }

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
