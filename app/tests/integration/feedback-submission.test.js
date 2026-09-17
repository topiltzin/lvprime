import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, writeCustomer } from './helpers.js';

// Superseded by specs/006-customer-data-storage for tests that need a real
// customer to exist (server checks Supabase now, not the fixture filesystem,
// so a fixture-only customer 404s instead of reaching the 422 path under
// test). See tests/integration/customer-data.test.js's addFeedbackEntry
// coverage for the replacement. The 404-for-unknown-slug test below is
// unaffected and stays enabled.
const SKIP_REASON = 'superseded — server checks Supabase now, not the fixture filesystem (see file header)';

const FEEDBACK = `# Test Customer - Feedback

### Formato de Entrada
\`\`\`
## [Date] - [Day]
- Completed: [Yes/No]
- Notes: [Any notes]
\`\`\`
`;

test('POST with a missing required field returns 422 and leaves feedback.md unchanged', { skip: SKIP_REASON }, async (t) => {
  const server = await startTestServer((tmpDir) => {
    writeCustomer(tmpDir, 'test-customer', { 'feedback.md': FEEDBACK });
  });
  t.after(() => server.close());

  const feedbackPath = path.join(server.tmpDir, 'test-customer', 'feedback.md');
  const before = fs.readFileSync(feedbackPath, 'utf8');

  const res = await fetch(`${server.baseUrl}/api/customers/test-customer/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-09-22', fields: { Completed: 'Yes' } }), // Notes missing
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.fields.Notes, 'required');

  const after = fs.readFileSync(feedbackPath, 'utf8');
  assert.equal(after, before, 'feedback.md must be byte-for-byte unchanged after a rejected submission');
});

test('POST with all fields returns 201, appends a YYYY-MM-DD entry, and is reflected in a subsequent GET', { skip: SKIP_REASON }, async (t) => {
  const server = await startTestServer((tmpDir) => {
    writeCustomer(tmpDir, 'test-customer', { 'feedback.md': FEEDBACK });
  });
  t.after(() => server.close());

  const res = await fetch(`${server.baseUrl}/api/customers/test-customer/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: '2026-09-22',
      label: 'Tuesday',
      fields: { Completed: 'Yes', Notes: 'Great session' },
    }),
  });

  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.date, '2026-09-22');
  assert.equal(created.completed, true);
  assert.equal(created.rawMatched, true);

  const feedbackPath = path.join(server.tmpDir, 'test-customer', 'feedback.md');
  const fileText = fs.readFileSync(feedbackPath, 'utf8');
  assert.match(fileText, /## 2026-09-22 - Tuesday/);
  assert.match(fileText, /- Completed: Yes/);
  assert.match(fileText, /- Notes: Great session/);

  const getRes = await fetch(`${server.baseUrl}/api/customers/test-customer`);
  const detail = await getRes.json();
  assert.equal(detail.feedback.entries.length, 1);
  assert.equal(detail.feedback.entries[0].date, '2026-09-22');
});

test('POST for an unknown customer slug returns 404', async (t) => {
  const server = await startTestServer((tmpDir) => {
    writeCustomer(tmpDir, 'test-customer', { 'feedback.md': FEEDBACK });
  });
  t.after(() => server.close());

  const res = await fetch(`${server.baseUrl}/api/customers/does-not-exist/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-09-22', fields: { Completed: 'Yes', Notes: 'x' } }),
  });
  assert.equal(res.status, 404);
});
