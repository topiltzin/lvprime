import test from 'node:test';
import assert from 'node:assert/strict';
import { findDoneEntry, sessionLabel, todayIso } from '../../src/lib/day-completion.js';

const TODAY = '2026-09-25';
const entry = (date, label = 'Lunes - Piernas A', completed = true) => ({ date, label, completed });

test('sessionLabel joins day and focus, or falls back to the day', () => {
  assert.equal(sessionLabel({ day: 'Lunes', focus: 'Piernas A' }), 'Lunes - Piernas A');
  assert.equal(sessionLabel({ day: 'Lunes', focus: '' }), 'Lunes');
  assert.equal(sessionLabel({ day: 'Lunes' }), 'Lunes');
});

test('todayIso uses the local calendar date', () => {
  assert.equal(todayIso(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});

test('findDoneEntry window includes today and today-6, excludes today-7 and the future', () => {
  assert.equal(findDoneEntry([entry('2026-09-25')], 'Lunes - Piernas A', TODAY)?.date, '2026-09-25');
  assert.equal(findDoneEntry([entry('2026-09-19')], 'Lunes - Piernas A', TODAY)?.date, '2026-09-19');
  assert.equal(findDoneEntry([entry('2026-09-18')], 'Lunes - Piernas A', TODAY), null);
  assert.equal(findDoneEntry([entry('2026-09-26')], 'Lunes - Piernas A', TODAY), null);
});

test('findDoneEntry window crosses month boundaries', () => {
  assert.equal(findDoneEntry([entry('2026-09-28')], 'Lunes - Piernas A', '2026-10-02')?.date, '2026-09-28');
  assert.equal(findDoneEntry([entry('2026-09-25')], 'Lunes - Piernas A', '2026-10-02'), null);
});

test('findDoneEntry ignores not-completed, unknown and non-ISO entries', () => {
  assert.equal(findDoneEntry([entry(TODAY, undefined, false)], 'Lunes - Piernas A', TODAY), null);
  assert.equal(findDoneEntry([entry(TODAY, undefined, null)], 'Lunes - Piernas A', TODAY), null);
  assert.equal(findDoneEntry([entry('25 de septiembre')], 'Lunes - Piernas A', TODAY), null);
  assert.equal(findDoneEntry(undefined, 'Lunes - Piernas A', TODAY), null);
});

test('findDoneEntry matches labels case-insensitively and returns the newest', () => {
  const found = findDoneEntry(
    [entry('2026-09-22', 'lunes - piernas a'), entry('2026-09-24', ' Lunes - Piernas A '), entry(TODAY, 'Martes')],
    'Lunes - Piernas A',
    TODAY,
  );
  assert.equal(found.date, '2026-09-24');
});
