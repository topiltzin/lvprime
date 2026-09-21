// Integration test for check-exercise-coverage.js against real Supabase data
// (read-only — never writes). Per contracts/coverage-check.md's Testing
// Checklist, asserts internal consistency rather than a hardcoded missing
// count: the real gap is 54 before specs/008's backfill runs and 0 after, so
// a fixed-count assertion here would break the moment the backfill lands.
//
// Requires SUPABASE_URL/SUPABASE_SECRET_KEY (see app/.env.example) — skips
// with a clear message if not set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listAllCustomers, getCustomerProgram, listExercises } from '../../server/lib/customer-data.js';
import { parseProgramDetail } from '../../server/markdown-parser.js';
import { renderMarkdown } from '../../server/markdown-render.js';
import { diffMissingExercises } from '../../server/scripts/check-exercise-coverage.js';

const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test(
  'coverage check against live data is internally consistent',
  { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' },
  async () => {
    const customers = await listAllCustomers();
    assert.ok(customers.length > 0, 'expected at least one customer to check against');

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
    assert.ok(usages.length > 0, 'expected at least one exercise usage across all programs');

    const libraryRows = await listExercises();
    const missing = diffMissingExercises(
      usages,
      libraryRows.map((r) => r.name)
    );

    // Re-fetch fresh so this genuinely proves each reported name is absent
    // right now, not just at the start of this test.
    const freshLibraryNames = new Set((await listExercises()).map((r) => r.name.trim().toLowerCase()));
    for (const { name, slugs } of missing) {
      assert.equal(
        freshLibraryNames.has(name.trim().toLowerCase()),
        false,
        `"${name}" was reported missing but is actually present in the library`
      );
      assert.ok(slugs.length > 0, `"${name}" must list at least one referencing customer slug`);
    }

    // Every non-missing used name really does have a library match.
    const missingKeys = new Set(missing.map((m) => m.name.trim().toLowerCase()));
    for (const { name } of usages) {
      const key = name.trim().toLowerCase();
      if (missingKeys.has(key)) continue;
      assert.equal(freshLibraryNames.has(key), true, `"${name}" was not reported missing but has no library match`);
    }
  }
);
