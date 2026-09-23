import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveWeekState,
  validateNextWeekNumber,
  WeekLockedError,
  WeekNumberGapError,
} from '../../server/lib/week-lock-rule.js';

test('deriveWeekState: no weeks yields an empty list', () => {
  assert.deepEqual(deriveWeekState([]), []);
});

test('deriveWeekState: a single week is current and not locked', () => {
  assert.deepEqual(deriveWeekState([1]), [{ weekNumber: 1, isCurrent: true, isLocked: false }]);
});

test('deriveWeekState: only the highest week is current, the rest are locked, sorted ascending', () => {
  assert.deepEqual(deriveWeekState([3, 1, 2]), [
    { weekNumber: 1, isCurrent: false, isLocked: true },
    { weekNumber: 2, isCurrent: false, isLocked: true },
    { weekNumber: 3, isCurrent: true, isLocked: false },
  ]);
});

test('validateNextWeekNumber: updating the current week or creating the next one is allowed', () => {
  assert.doesNotThrow(() => validateNextWeekNumber(2, 2));
  assert.doesNotThrow(() => validateNextWeekNumber(2, 3));
});

test('validateNextWeekNumber: a customer with no weeks can only create week 1', () => {
  assert.doesNotThrow(() => validateNextWeekNumber(0, 1));
  assert.throws(() => validateNextWeekNumber(0, 2), WeekNumberGapError);
});

test('validateNextWeekNumber: targeting a past week throws WeekLockedError with both week numbers', () => {
  assert.throws(
    () => validateNextWeekNumber(2, 1),
    (err) => err instanceof WeekLockedError && err.weekNumber === 1 && err.currentWeek === 2
  );
});

test('validateNextWeekNumber: skipping ahead throws WeekNumberGapError with the expected next week', () => {
  assert.throws(
    () => validateNextWeekNumber(2, 4),
    (err) => err instanceof WeekNumberGapError && err.weekNumber === 4 && err.expected === 3
  );
});

test('validateNextWeekNumber: non-positive or non-integer week numbers are rejected', () => {
  assert.throws(() => validateNextWeekNumber(2, 0), WeekNumberGapError);
  assert.throws(() => validateNextWeekNumber(2, 2.5), WeekNumberGapError);
});
