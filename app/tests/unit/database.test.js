// Unit tests for app/server/lib/customer-data.js's synchronous validation
// logic. These never touch Supabase: every validated function checks its
// input and throws before calling getSupabaseClient()/the network, so no
// mocking is needed here (Node's ESM module mocking needs
// --experimental-test-module-mocks, which would change the whole project's
// `npm test` invocation — too invasive for this). Success-path round trips
// against a real Supabase project are covered by
// tests/integration/customer-data.test.js instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCustomer,
  updateCustomerNotes,
  updateCustomerProgram,
  updateCustomerNutritionPlan,
  addFeedbackEntry,
  queueOfflineChange,
  computeFeedbackTrend,
  CustomerNotFoundError,
  ValidationError,
} from '../../server/lib/customer-data.js';

test('getCustomer rejects an invalid slug before touching the network', async () => {
  await assert.rejects(() => getCustomer('AB'), ValidationError); // too short, uppercase
  await assert.rejects(() => getCustomer('-leading-hyphen'), ValidationError);
  await assert.rejects(() => getCustomer('trailing-hyphen-'), ValidationError);
  await assert.rejects(() => getCustomer(''), ValidationError);
});

test('updateCustomerProgram/Notes reject empty or oversized content (500KB limit)', async () => {
  await assert.rejects(() => updateCustomerProgram('valid-slug', ''), ValidationError);
  await assert.rejects(() => updateCustomerNotes('valid-slug', ''), ValidationError);

  const tooBig = 'a'.repeat(500 * 1024 + 1);
  await assert.rejects(() => updateCustomerProgram('valid-slug', tooBig), ValidationError);
  await assert.rejects(() => updateCustomerNotes('valid-slug', tooBig), ValidationError);
});

test('updateCustomerNutritionPlan enforces the 100KB limit (not 500KB, per specs/005-nutrition-plan-tab FR-008)', async () => {
  // assertContentSize runs before getCustomer()/any network call, so this
  // throws synchronously without needing a real customer or Supabase access.
  const between100kAnd500k = 'a'.repeat(150 * 1024); // over 100KB, under 500KB — would pass the program/notes limit but not nutrition's
  await assert.rejects(() => updateCustomerNutritionPlan('valid-slug', between100kAnd500k), ValidationError);
});

test('addFeedbackEntry rejects a malformed date before any DB call', async () => {
  // addFeedbackEntry only checks date *shape* (\d{4}-\d{2}-\d{2}); calendar
  // validity (e.g. rejecting month 13) is validateFeedbackSubmission's job,
  // called by the route handler before addFeedbackEntry — see contracts/
  // data-api-layer.md. So only shape-invalid dates belong in this test.
  await assert.rejects(
    () => addFeedbackEntry('valid-slug', 'Display Name', { date: 'not-a-date', label: null, fields: {} }),
    ValidationError
  );
  await assert.rejects(
    () => addFeedbackEntry('valid-slug', 'Display Name', { date: '09/17/2026', label: null, fields: {} }),
    ValidationError
  );
});

test('queueOfflineChange rejects an invalid fileType before any DB call', async () => {
  await assert.rejects(
    () =>
      queueOfflineChange('valid-slug', 'nutrition', {
        sequence: 1,
        timestamp: new Date().toISOString(),
        action: 'edit',
        content_hash: 'a'.repeat(64),
        content_size_bytes: 10,
      }),
    ValidationError
  );
});

test('computeFeedbackTrend computes completion rate only from raw_matched entries with a known completed value', () => {
  const entries = [
    { raw_matched: true, completed: true, entry_date: '2026-01-01', difficulty: 'Moderada' },
    { raw_matched: true, completed: false, entry_date: '2026-01-02', difficulty: 'Fácil' },
    { raw_matched: true, completed: null, entry_date: '2026-01-03', difficulty: null },
    { raw_matched: false, completed: true, entry_date: '2026-01-04', difficulty: 'Hard' }, // excluded: not raw_matched
  ];
  const trend = computeFeedbackTrend(entries);
  assert.equal(trend.completionRate, 0.5); // 1 of 2 entries with a known completed value
  assert.equal(trend.points.length, 3); // raw_matched entries only
  assert.equal(trend.points[0].difficultyScore, 2); // 'Moderada' -> 2
  assert.equal(trend.points[1].difficultyScore, 1); // 'Fácil' -> 1
  assert.equal(trend.points[2].difficultyScore, null); // no difficulty recorded
});

test('computeFeedbackTrend returns null completionRate when no entry has a known completed value', () => {
  const trend = computeFeedbackTrend([{ raw_matched: true, completed: null, entry_date: '2026-01-01', difficulty: null }]);
  assert.equal(trend.completionRate, null);
});

test('CustomerNotFoundError and ValidationError carry a machine-readable code', () => {
  const notFound = new CustomerNotFoundError('missing-slug');
  assert.equal(notFound.code, 'CUSTOMER_NOT_FOUND');
  assert.match(notFound.message, /missing-slug/);

  const invalid = new ValidationError('date', 'must be YYYY-MM-DD');
  assert.equal(invalid.code, 'VALIDATION_ERROR');
  assert.equal(invalid.field, 'date');
});
