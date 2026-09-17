// Verifies the real customers/ directory content matches what's stored in
// Supabase after running server/migrations/migrate-data.js — per
// specs/006-customer-data-storage/quickstart.md Scenario 8. Read-only: never
// writes to customers/ or Supabase. Requires SUPABASE_URL/SUPABASE_SECRET_KEY
// (see app/.env.example); skips with a clear message if not set.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getCustomer,
  getCustomerProgram,
  getCustomerNotes,
  getCustomerNutritionPlan,
  getCustomerFeedback,
} from '../../server/lib/customer-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOMERS_DIR = path.resolve(__dirname, '..', '..', '..', 'customers');
const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function listCustomerSlugs() {
  return fs
    .readdirSync(CUSTOMERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

test(
  'migrated Supabase data matches customers/ filesystem content exactly',
  { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' },
  async (t) => {
    const slugs = listCustomerSlugs();
    assert.ok(slugs.length > 0, 'expected at least one customer directory to check against');

    for (const slug of slugs) {
      await t.test(`${slug}: customer row exists and content matches`, async () => {
        // A missing DB row here means this customer was never migrated —
        // that's a real failure, not something to skip past.
        await assert.doesNotReject(() => getCustomer(slug), `expected ${slug} to have a customers row`);

        const dir = path.join(CUSTOMERS_DIR, slug);

        const programFile = readIfExists(path.join(dir, 'program.md'));
        const programDb = await getCustomerProgram(slug);
        assert.equal(
          programDb ? programDb.content : null,
          programFile,
          `${slug}: program.md content mismatch`
        );

        const notesFile = readIfExists(path.join(dir, 'notes.md'));
        const notesDb = await getCustomerNotes(slug);
        assert.equal(notesDb ? notesDb.content : null, notesFile, `${slug}: notes.md content mismatch`);

        const nutritionFile = readIfExists(path.join(dir, 'nutrition_plan.md'));
        const nutritionDb = await getCustomerNutritionPlan(slug);
        assert.equal(
          nutritionDb ? nutritionDb.content : null,
          nutritionFile,
          `${slug}: nutrition_plan.md content mismatch`
        );

        const feedbackFile = readIfExists(path.join(dir, 'feedback.md')) ?? '';
        const feedbackDb = await getCustomerFeedback(slug);
        assert.equal(feedbackDb.content, feedbackFile, `${slug}: feedback.md content mismatch`);
      });
    }
  }
);
