import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, writeCustomer } from './helpers.js';

// Superseded by specs/006-customer-data-storage for tests that need real
// fixture content (server reads Supabase now, not FITNESS_DASHBOARD_CUSTOMERS_DIR).
// See tests/integration/customer-data.test.js and
// tests/integration/migration-data-integrity.test.js for the replacement
// coverage. The 404-for-unknown-slug test below is unaffected (Supabase
// correctly reports missing customers regardless of fixture data) and stays
// enabled.
const SKIP_REASON = 'superseded — server reads Supabase now, not the fixture filesystem (see file header)';

const PROGRAM = `# Test Customer

**Objetivo:** Build strength

### Monday - Legs
1. **Squat** - 3 x 8 - Rest 90s

## Progression (4 weeks)

- **Week 1:** Find a comfortable load.
- **Week 2:** Increase reps within the given range.
`;

const FEEDBACK = `# Test Customer - Feedback

### Formato de Entrada
\`\`\`
## [Date] - [Day]
- Completed: [Yes/No]
- Notes: [Any notes]
\`\`\`

## 2026-09-10 - Monday
- Completed: Yes
- Notes: Felt strong
`;

const NOTES = `# Coach Notes\n\nCustomer is progressing well.\n`;

test('GET /api/customers/:slug returns program, notes, feedback, and attachments together', { skip: SKIP_REASON }, async (t) => {
  const server = await startTestServer((tmpDir) => {
    writeCustomer(tmpDir, 'test-customer', {
      'program.md': PROGRAM,
      'feedback.md': FEEDBACK,
      'notes.md': NOTES,
      'plans/week1.pdf': 'not a real pdf, just fixture bytes',
    });
  });
  t.after(() => server.close());

  const res = await fetch(`${server.baseUrl}/api/customers/test-customer`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.program.present, true);
  assert.equal(body.program.goal, 'Build strength');
  assert.equal(body.program.weeklySchedule.length, 1);
  assert.equal(body.program.weeklySchedule[0].day, 'Monday');
  assert.match(body.program.weeklySchedule[0].html, /Squat/);
  assert.equal(body.program.weeklySchedule[0].exercises.length, 1);
  assert.equal(body.program.weeklySchedule[0].exercises[0].name, 'Squat');
  assert.equal(body.program.weeklySchedule[0].exercises[0].setsReps, '3 x 8');
  assert.equal(body.program.weeklySchedule[0].exercises[0].rest, '90s');

  assert.equal(body.program.weekNumber, 1);
  assert.match(body.program.progressionHtml, /Find a comfortable load/);

  assert.equal(body.notes.present, true);
  assert.match(body.notes.html, /progressing well/);

  assert.equal(body.feedback.entries.length, 1);
  assert.equal(body.feedback.entries[0].date, '2026-09-10');
  assert.equal(body.feedback.entries[0].completed, true);
  assert.equal(body.feedback.entries[0].rawMatched, true);

  assert.equal(body.attachments.length, 1);
  assert.equal(body.attachments[0].relativePath, 'plans/week1.pdf');
});

test('GET /api/customers/:slug returns 404 for an unknown slug', async (t) => {
  const server = await startTestServer((tmpDir) => {
    writeCustomer(tmpDir, 'test-customer', { 'program.md': PROGRAM });
  });
  t.after(() => server.close());

  const res = await fetch(`${server.baseUrl}/api/customers/does-not-exist`);
  assert.equal(res.status, 404);
});

test('an existing folder missing all files still returns 200 with empty sections', { skip: SKIP_REASON }, async (t) => {
  const server = await startTestServer((tmpDir) => {
    writeCustomer(tmpDir, 'empty-customer', {});
  });
  t.after(() => server.close());

  const res = await fetch(`${server.baseUrl}/api/customers/empty-customer`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.program.present, false);
  assert.equal(body.notes.present, false);
  assert.deepEqual(body.feedback.entries, []);
});
