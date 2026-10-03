import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeCustomerView } from '../../server/handlers/customers.js';

const input = {
  base: { slug: 'ana-lopez', displayName: 'Ana Lopez', program: { present: true }, measurements: { present: true } },
  notes: { present: true, html: '<p>coach-secret</p>' },
  feedbackRows: [
    { sort_order: 1, entry_date: '2026-09-01', label: 'Day 1', felt: 'tired-secret', completed: 'Yes', difficulty: 'Moderate', notes: 'private-note', raw_matched: true },
  ],
  template: { fields: [] },
};

test('a customer gets completed days and notepad text only: no coach notes, no tracking detail', () => {
  const view = shapeCustomerView('customer', input);
  assert.equal(view.role, 'customer');
  assert.deepEqual(view.notes, { present: false });
  assert.deepEqual(view.feedback, {
    completedDays: [{ date: '2026-09-01', label: 'Day 1', completed: 'Yes', notes: 'private-note' }],
    template: { fields: [] },
  });
  const text = JSON.stringify(view);
  for (const secret of ['coach-secret', 'tired-secret']) assert.ok(!text.includes(secret), secret);
  assert.equal(view.program.present, true);
});

test('the coach still gets notes and the full feedback entries', () => {
  const view = shapeCustomerView('coach', input);
  assert.equal(view.role, 'coach');
  assert.equal(view.notes.html, '<p>coach-secret</p>');
  assert.equal(view.feedback.entries.length, 1);
  assert.equal(view.feedback.entries[0].notes, 'private-note');
  assert.ok(view.feedback.template);
});
