/**
 * One-time migration: customers/[slug]/{program,feedback,notes,nutrition_plan}.md
 * -> Supabase (customers/programs/feedbacks/notes/nutrition_plans tables).
 *
 * Idempotent per customer: if a customer's `customers` row already exists,
 * that customer is skipped entirely (does not touch their program/notes/
 * feedback/nutrition_plans rows) rather than overwriting anything, so this
 * script is safe to re-run after partial failures.
 *
 * Run: node server/migrations/migrate-data.js   (from the app/ directory)
 * See specs/006-customer-data-storage/quickstart.md Scenario 2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseClient } from '../lib/database-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOMERS_DIR = path.resolve(__dirname, '..', '..', '..', 'customers');

const MAX_STANDARD_BYTES = 500 * 1024; // programs, notes, feedbacks (data-model.md)
const MAX_NUTRITION_BYTES = 100 * 1024; // specs/005-nutrition-plan-tab FR-008

function toDisplayName(slug) {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

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

async function customerAlreadyMigrated(supabase, slug) {
  const { data, error } = await supabase.from('customers').select('id').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Inserts one text-content table row, skipping (with a warning) if content
 * exceeds maxBytes rather than failing the whole customer's migration.
 */
async function migrateContentTable(supabase, table, customerId, content, maxBytes, label, warnings) {
  if (content == null) return { inserted: false, reason: 'file-missing' };
  const size = Buffer.byteLength(content, 'utf8');
  if (size > maxBytes) {
    warnings.push(`${label}: content is ${size} bytes, exceeds ${maxBytes} byte limit — SKIPPED`);
    return { inserted: false, reason: 'too-large' };
  }
  const { error } = await supabase.from(table).insert({ customer_id: customerId, content });
  if (error) throw new Error(`${label}: insert failed: ${error.message}`);
  return { inserted: true };
}

async function migrateCustomer(supabase, slug, summary) {
  if (await customerAlreadyMigrated(supabase, slug)) {
    console.log(`  ⏭  ${slug}: already migrated, skipping (idempotency guard)`);
    summary.skippedAlreadyMigrated.push(slug);
    return;
  }

  const dir = path.join(CUSTOMERS_DIR, slug);
  const displayName = toDisplayName(slug);
  const warnings = [];

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({ slug, name: displayName })
    .select()
    .single();
  if (customerError) throw new Error(`${slug}: failed to create customer row: ${customerError.message}`);
  summary.customers.push(slug);

  const programText = readIfExists(path.join(dir, 'program.md'));
  const programResult = await migrateContentTable(
    supabase,
    'programs',
    customer.id,
    programText,
    MAX_STANDARD_BYTES,
    `${slug}/program.md`,
    warnings
  );
  if (programResult.inserted) summary.programs.push(slug);

  const notesText = readIfExists(path.join(dir, 'notes.md'));
  const notesResult = await migrateContentTable(
    supabase,
    'notes',
    customer.id,
    notesText,
    MAX_STANDARD_BYTES,
    `${slug}/notes.md`,
    warnings
  );
  if (notesResult.inserted) summary.notes.push(slug);

  const nutritionText = readIfExists(path.join(dir, 'nutrition_plan.md'));
  const nutritionResult = await migrateContentTable(
    supabase,
    'nutrition_plans',
    customer.id,
    nutritionText,
    MAX_NUTRITION_BYTES,
    `${slug}/nutrition_plan.md`,
    warnings
  );
  if (nutritionResult.inserted) summary.nutritionPlans.push(slug);

  // feedback.md always gets a row (even if the file doesn't exist), matching
  // customer-data.js's getCustomerFeedback default of content: ''.
  const feedbackText = readIfExists(path.join(dir, 'feedback.md')) ?? '';
  const feedbackSize = Buffer.byteLength(feedbackText, 'utf8');
  if (feedbackSize > MAX_STANDARD_BYTES) {
    warnings.push(`${slug}/feedback.md: content is ${feedbackSize} bytes, exceeds ${MAX_STANDARD_BYTES} byte limit — SKIPPED (row not created)`);
  } else {
    const { error: feedbackError } = await supabase
      .from('feedbacks')
      .insert({ customer_id: customer.id, content: feedbackText });
    if (feedbackError) throw new Error(`${slug}/feedback.md: insert failed: ${feedbackError.message}`);
    summary.feedbacks.push(slug);
  }

  for (const w of warnings) {
    console.warn(`  ⚠️  ${w}`);
    summary.warnings.push(w);
  }
  console.log(`  ✓ Migrated customer: ${slug}`);
}

async function verifyFeedbackRoundTrip(supabase, summary) {
  const { parseFeedbackEntries } = await import('../markdown-parser.js');
  for (const slug of summary.feedbacks) {
    const dir = path.join(CUSTOMERS_DIR, slug);
    const original = readIfExists(path.join(dir, 'feedback.md')) ?? '';
    const originalEntryCount = parseFeedbackEntries(original).length;

    const { data: cust } = await supabase.from('customers').select('id').eq('slug', slug).single();
    const { data: row } = await supabase.from('feedbacks').select('content').eq('customer_id', cust.id).single();
    const migratedEntryCount = parseFeedbackEntries(row.content).length;

    if (originalEntryCount !== migratedEntryCount) {
      const msg = `${slug}: feedback entry count mismatch after migration (original ${originalEntryCount}, migrated ${migratedEntryCount})`;
      console.error(`  ✗ ${msg}`);
      summary.errors.push(msg);
    } else {
      console.log(`  ✓ ${slug}: feedback round-trip verified (${migratedEntryCount} entries)`);
    }
  }
}

async function main() {
  console.log(`Migrating customers from ${CUSTOMERS_DIR} ...`);
  const supabase = getSupabaseClient();
  const slugs = listCustomerSlugs();

  const summary = {
    customers: [],
    programs: [],
    notes: [],
    nutritionPlans: [],
    feedbacks: [],
    skippedAlreadyMigrated: [],
    warnings: [],
    errors: [],
  };

  for (const slug of slugs) {
    try {
      await migrateCustomer(supabase, slug, summary);
    } catch (err) {
      console.error(`  ✗ ${slug}: migration failed: ${err.message}`);
      summary.errors.push(`${slug}: ${err.message}`);
    }
  }

  console.log('\nVerifying feedback round-trip...');
  await verifyFeedbackRoundTrip(supabase, summary);

  console.log('\n--- Migration Summary ---');
  console.log(`Customer directories found: ${slugs.length}`);
  console.log(`Customers migrated: ${summary.customers.length}`);
  console.log(`Customers already migrated (skipped): ${summary.skippedAlreadyMigrated.length}`);
  console.log(`Programs migrated: ${summary.programs.length}`);
  console.log(`Notes migrated: ${summary.notes.length}`);
  console.log(`Nutrition plans migrated: ${summary.nutritionPlans.length}`);
  console.log(`Feedback logs migrated: ${summary.feedbacks.length}`);
  console.log(`Warnings: ${summary.warnings.length}`);
  console.log(`Errors: ${summary.errors.length}`);

  if (summary.errors.length > 0) {
    console.error('\nMigration completed WITH ERRORS:');
    summary.errors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
  } else {
    console.log('\nMigration complete: zero errors.');
  }
}

main().catch((err) => {
  console.error('Migration script crashed:', err);
  process.exitCode = 1;
});
