import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, writeCustomer } from './helpers.js';

// Superseded by specs/006-customer-data-storage: server/index.js now reads
// from Supabase, not FITNESS_DASHBOARD_CUSTOMERS_DIR, so this fixture
// filesystem is never consulted. See tests/integration/customer-data.test.js
// and tests/integration/migration-data-integrity.test.js for the DAL-level
// replacement coverage. Skipped rather than deleted or left as a silent
// failure — rewriting these against real Supabase fixtures (create via
// upsertCustomer, assert via HTTP, clean up after) is future work, not done
// here to keep this migration's scope bounded.
const SKIP_REASON = 'superseded — server reads Supabase now, not the fixture filesystem (see file header)';

test('GET /api/customers lists a full customer and an incomplete one without erroring', { skip: SKIP_REASON }, async (t) => {
  const server = await startTestServer((tmpDir) => {
    writeCustomer(tmpDir, 'full-customer', {
      'program.md': '# Full Customer\n\n**Objetivo:** Get strong\n',
      'feedback.md': '# Full Customer - Feedback\n',
      'notes.md': '# Notes\n',
    });
    // A folder missing all three standard files (spec FR-010 edge case).
    fs.mkdirSync(path.join(tmpDir, 'incomplete-customer'), { recursive: true });
  });
  t.after(() => server.close());

  const res = await fetch(`${server.baseUrl}/api/customers`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.customers.length, 2);
  const full = body.customers.find((c) => c.slug === 'full-customer');
  const incomplete = body.customers.find((c) => c.slug === 'incomplete-customer');

  assert.ok(full, 'expected full-customer in the list');
  assert.equal(full.hasProgram, true);
  assert.equal(full.hasNotes, true);
  assert.equal(full.programGoal, 'Get strong');

  assert.ok(incomplete, 'expected incomplete-customer in the list even though it has no files');
  assert.equal(incomplete.hasProgram, false);
  assert.equal(incomplete.hasNotes, false);
});

test('GET /api/customers returns 200 with an empty list when customers/ is empty', { skip: SKIP_REASON }, async (t) => {
  const server = await startTestServer(() => {});
  t.after(() => server.close());

  const res = await fetch(`${server.baseUrl}/api/customers`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.customers, []);
});
