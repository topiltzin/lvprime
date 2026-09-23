/**
 * Week lock rule for per-week program routines
 * (specs/010-weekly-routine-versioning data-model.md, research.md Decisions 2-3).
 *
 * "Locked" is derived, never stored: the highest week_number for a customer is
 * the only writable (current) week; every lower week is read-only.
 */

export class WeekLockedError extends Error {
  constructor(weekNumber, currentWeek) {
    super(`Week ${weekNumber} is locked (current week is ${currentWeek})`);
    this.name = 'WeekLockedError';
    this.code = 'WEEK_LOCKED';
    this.weekNumber = weekNumber;
    this.currentWeek = currentWeek;
  }
}

export class WeekNumberGapError extends Error {
  constructor(weekNumber, expected) {
    super(`Week ${weekNumber} would leave a gap (next available is ${expected})`);
    this.name = 'WeekNumberGapError';
    this.code = 'WEEK_NUMBER_GAP';
    this.weekNumber = weekNumber;
    this.expected = expected;
  }
}

/**
 * @param {number[]} weekNumbers every week_number that exists for one customer
 * @returns {Array<{weekNumber: number, isCurrent: boolean, isLocked: boolean}>} ascending
 */
export function deriveWeekState(weekNumbers) {
  if (weekNumbers.length === 0) return [];
  const max = Math.max(...weekNumbers);
  return [...weekNumbers]
    .sort((a, b) => a - b)
    .map((weekNumber) => ({ weekNumber, isCurrent: weekNumber === max, isLocked: weekNumber !== max }));
}

/**
 * Throws unless requestedWeekNumber is the current week (update in place) or
 * the next one (create). currentMaxWeek is 0 when the customer has no weeks yet.
 */
export function validateNextWeekNumber(currentMaxWeek, requestedWeekNumber) {
  if (!Number.isInteger(requestedWeekNumber) || requestedWeekNumber < 1) {
    throw new WeekNumberGapError(requestedWeekNumber, currentMaxWeek + 1);
  }
  if (requestedWeekNumber < currentMaxWeek) {
    throw new WeekLockedError(requestedWeekNumber, currentMaxWeek);
  }
  if (requestedWeekNumber > currentMaxWeek + 1) {
    throw new WeekNumberGapError(requestedWeekNumber, currentMaxWeek + 1);
  }
}
