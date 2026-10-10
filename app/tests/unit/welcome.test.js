import test from 'node:test';
import assert from 'node:assert/strict';
import { isDue, isoWeekday, validateToday, validateWelcome, weekStart } from '../../server/lib/welcome.js';

// Welcome message logic (specs/018-welcome-motivation-popup data-model.md).

test('validateWelcome rejects empty and whitespace-only text', () => {
  assert.equal(validateWelcome({ body: '' }).ok, false);
  const r = validateWelcome({ body: '   \n ' });
  assert.equal(r.ok, false);
  assert.ok(r.fields.body);
});

test('validateWelcome enforces the 300-character limit by characters', () => {
  assert.equal(validateWelcome({ body: 'a'.repeat(300) }).ok, true);
  assert.equal(validateWelcome({ body: 'a'.repeat(301) }).ok, false);
  assert.equal(validateWelcome({ body: '💪'.repeat(300) }).ok, true);
});

test('validateWelcome checks weekday and applies defaults', () => {
  assert.equal(validateWelcome({ body: 'hi', deliveryWeekday: 0 }).ok, false);
  assert.equal(validateWelcome({ body: 'hi', deliveryWeekday: 8 }).ok, false);
  assert.equal(validateWelcome({ body: 'hi', deliveryWeekday: 'x' }).ok, false);
  assert.equal(validateWelcome({ body: 'hi', repeatWeekly: 'yes' }).ok, false);
  const r = validateWelcome({ body: '  hi  ' });
  assert.deepEqual(r.value, { body: 'hi', deliveryWeekday: 1, repeatWeekly: true });
});

test('weekStart returns the Monday of the week', () => {
  assert.equal(weekStart('2026-10-05'), '2026-10-05');
  assert.equal(weekStart('2026-10-11'), '2026-10-05');
  assert.equal(weekStart('2026-10-12'), '2026-10-12');
  assert.equal(weekStart('2027-01-01'), '2026-12-28');
});

test('isoWeekday is 1 for Monday and 7 for Sunday', () => {
  assert.equal(isoWeekday('2026-10-05'), 1);
  assert.equal(isoWeekday('2026-10-07'), 3);
  assert.equal(isoWeekday('2026-10-11'), 7);
});

test('validateToday accepts only real dates within one day of the server date', () => {
  const now = Date.UTC(2026, 9, 7, 12);
  assert.equal(validateToday('2026-10-07', now), true);
  assert.equal(validateToday('2026-10-06', now), true);
  assert.equal(validateToday('2026-10-08', now), true);
  assert.equal(validateToday('2026-10-09', now), false);
  assert.equal(validateToday('2026-02-30', now), false);
  assert.equal(validateToday('10/07/2026', now), false);
  assert.equal(validateToday(undefined, now), false);
});

test('isDue follows the delivery day, catches up and respects the repeat setting', () => {
  const base = { delivery_weekday: 1, repeat_weekly: true, last_seen_week: null };
  assert.equal(isDue(base, '2026-10-07'), true); // Wednesday, Monday delivery: catch-up
  assert.equal(isDue({ ...base, last_seen_week: '2026-10-05' }, '2026-10-07'), false); // seen this week
  assert.equal(isDue({ ...base, last_seen_week: '2026-10-05' }, '2026-10-12'), true); // next week
  assert.equal(isDue({ ...base, repeat_weekly: false, last_seen_week: '2026-10-05' }, '2026-10-12'), false);
  assert.equal(isDue({ ...base, delivery_weekday: 4 }, '2026-10-06'), false); // Thursday delivery, Tuesday today
  assert.equal(isDue({ ...base, delivery_weekday: 7 }, '2026-10-10'), false);
  assert.equal(isDue({ ...base, delivery_weekday: 7 }, '2026-10-11'), true);
  assert.equal(isDue(null, '2026-10-11'), false);
});
