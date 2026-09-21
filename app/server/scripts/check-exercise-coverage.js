/**
 * Read-only, repeatable report: which exercise names referenced in any
 * customer's current program have no matching entry in the exercises
 * library. Never writes anything — see
 * specs/008-exercise-coverage-backfill/contracts/coverage-check.md.
 *
 * Run: node server/scripts/check-exercise-coverage.js   (from the app/ directory)
 */
import { listAllCustomers, getCustomerProgram, listExercises } from '../lib/customer-data.js';
import { parseProgramDetail } from '../markdown-parser.js';
import { renderMarkdown } from '../markdown-render.js';

/**
 * @param {Array<{name: string, slug: string}>} usages every exercise-name occurrence across all
 *   programs, one entry per (name, customer) pair
 * @param {string[]} libraryNames every exercise name currently in the library
 * @returns {Array<{name: string, slugs: string[]}>} missing names, deduplicated, each with every
 *   referencing customer slug, in first-seen order
 */
export function diffMissingExercises(usages, libraryNames) {
  const libraryKeys = new Set(libraryNames.map((n) => n.trim().toLowerCase()));
  const missingByKey = new Map();

  for (const { name, slug } of usages) {
    const key = name.trim().toLowerCase();
    if (libraryKeys.has(key)) continue;
    if (!missingByKey.has(key)) missingByKey.set(key, { name, slugs: [] });
    const entry = missingByKey.get(key);
    if (!entry.slugs.includes(slug)) entry.slugs.push(slug);
  }

  return [...missingByKey.values()];
}

async function collectUsages() {
  const customers = await listAllCustomers();
  const usages = [];
  for (const customer of customers) {
    const program = await getCustomerProgram(customer.slug);
    if (!program) continue;
    const detail = parseProgramDetail(program.content, renderMarkdown);
    for (const day of detail.weeklySchedule) {
      for (const exercise of day.exercises) {
        usages.push({ name: exercise.name, slug: customer.slug });
      }
    }
  }
  return usages;
}

/**
 * The scan-and-diff logic, as data rather than printed text — shared with
 * app/server/scripts/publish.js (specs/009-publish-coverage-check) so both
 * this script's own CLI output and a program publish's coverage report come
 * from the exact same computation.
 * @returns {Promise<{customerCount: number, distinctUsedCount: number, libraryCount: number, missing: Array<{name: string, slugs: string[]}>}>}
 */
export async function checkCoverage() {
  const [usages, libraryRows] = await Promise.all([collectUsages(), listExercises()]);
  const distinctUsedCount = new Set(usages.map((u) => u.name.trim().toLowerCase())).size;
  const customerCount = new Set(usages.map((u) => u.slug)).size;
  const missing = diffMissingExercises(usages, libraryRows.map((r) => r.name));

  return { customerCount, distinctUsedCount, libraryCount: libraryRows.length, missing };
}

/**
 * Pure formatting of a checkCoverage() result into the exact console text
 * this script has always printed — extracted so publish.js prints identical
 * text rather than a re-implementation of it (spec FR-002).
 * @param {{customerCount: number, distinctUsedCount: number, libraryCount: number, missing: Array<{name: string, slugs: string[]}>}} report
 * @returns {string}
 */
export function formatCoverageReport({ customerCount, distinctUsedCount, libraryCount, missing }) {
  const lines = [
    `Scanned ${customerCount} customer(s), ${distinctUsedCount} distinct exercise name(s) referenced.`,
    `Library has ${libraryCount} exercise(s).`,
    `Missing: ${missing.length}`,
  ];

  if (missing.length === 0) {
    lines.push('', 'No coverage gaps — every referenced exercise name has a library match.');
    return lines.join('\n');
  }

  lines.push('');
  for (const { name, slugs } of missing) {
    lines.push(`  "${name}" — used by: ${slugs.join(', ')}`);
  }
  return lines.join('\n');
}

async function main() {
  console.log(formatCoverageReport(await checkCoverage()));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
