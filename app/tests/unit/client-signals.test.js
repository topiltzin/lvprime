import test from 'node:test';
import assert from 'node:assert/strict';
import { computeClientSignals } from '../../server/lib/client-signals.js';
import { parseFeedbackEntries } from '../../server/markdown-parser.js';
import { filterClients, countByFilter } from '../../src/lib/client-filter.js';

const NOW = new Date('2026-09-29T12:00:00');

const entry = (date, fields) =>
  `### ${date} - Lunes\n${Object.entries(fields).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`;

const parse = (...blocks) => parseFeedbackEntries(blocks.join('\n'));

test('adherence counts only the last 14 days and ignores unanswered "completed"', () => {
  const entries = parse(
    entry('2026-09-28', { Energía: 'Alta', Completado: 'Sí' }),
    entry('2026-09-25', { Energía: 'Media', Completado: 'No' }),
    entry('2026-09-20', { Energía: 'Media', Completado: 'Sí' }),
    entry('2026-09-01', { Energía: 'Media', Completado: 'Sí' }), // outside the window
  );
  const { adherence } = computeClientSignals(entries, { now: NOW });
  assert.deepEqual(adherence, { days: 14, logged: 3, completed: 2, missed: 1, percent: 67 });
});

test('no recent sessions → percent null, no flags', () => {
  const s = computeClientSignals([], { now: NOW });
  assert.equal(s.adherence.percent, null);
  assert.deepEqual(s.flags, []);
});

test('numeric pain at or above 4/10 is flagged; below is not', () => {
  const high = parse(entry('2026-09-28', { Energía: 'Alta', 'Dolor cadera (0-10)': '6 durante, 3 mañana', Completado: 'Sí' }));
  assert.deepEqual(computeClientSignals(high, { now: NOW }).flags, [{ kind: 'pain', level: 6, text: 'Pain 6/10', date: '2026-09-28' }]);
  const low = parse(entry('2026-09-28', { Energía: 'Alta', 'Dolor cadera (0-10)': '2', Completado: 'Sí' }));
  assert.deepEqual(computeClientSignals(low, { now: NOW }).flags, []);
});

test('pain words in notes are flagged unless negated', () => {
  const flagged = parse(entry('2026-09-28', { Energía: 'Alta', Completado: 'Sí', Notas: 'Me dolió el hombro en el press' }));
  assert.equal(computeClientSignals(flagged, { now: NOW }).flags[0].text, 'Mentions pain');
  const negated = parse(entry('2026-09-28', { Energía: 'Alta', Completado: 'Sí', Notas: 'Sin dolor, todo bien' }));
  assert.deepEqual(computeClientSignals(negated, { now: NOW }).flags, []);
});

test('a "Brutal" session is flagged; only the newest flag per kind is kept', () => {
  const entries = parse(
    entry('2026-09-27', { Energía: 'Baja', Completado: 'Sí', 'Impresión general': 'Brutal' }),
    entry('2026-09-28', { Energía: 'Baja', Completado: 'Sí', 'Impresión general': 'Brutal' }),
  );
  const { flags } = computeClientSignals(entries, { now: NOW });
  assert.equal(flags.length, 1);
  assert.equal(flags[0].date, '2026-09-28');
});

test('week is due once the current week is 7+ days old', () => {
  assert.equal(computeClientSignals([], { weekNumber: 3, weekUpdatedAt: '2026-09-22T12:00:00', now: NOW }).weekDue, true);
  assert.equal(computeClientSignals([], { weekNumber: 3, weekUpdatedAt: '2026-09-25T12:00:00', now: NOW }).weekDue, false);
  assert.equal(computeClientSignals([], { weekNumber: null, weekUpdatedAt: null, now: NOW }).weekDue, false);
});

const client = (displayName, lastFeedbackDate, signals = {}) => ({ displayName, lastFeedbackDate, signals });

test('filters combine with the name search and chip counts match the results', () => {
  const clients = [
    client('Ana Ruiz', '2026-09-28', { flags: [{ kind: 'pain' }] }),
    client('Beto Ruiz', '2026-09-10', { weekDue: true }),
    client('Carla Paz', null),
  ];
  assert.deepEqual(filterClients(clients, { filter: 'flagged' }, NOW).map((c) => c.displayName), ['Ana Ruiz']);
  assert.deepEqual(filterClients(clients, { filter: 'needs-checkin' }, NOW).map((c) => c.displayName), ['Beto Ruiz']);
  assert.deepEqual(filterClients(clients, { filter: 'no-feedback' }, NOW).map((c) => c.displayName), ['Carla Paz']);
  assert.deepEqual(filterClients(clients, { filter: 'all', query: 'ruiz' }, NOW).length, 2);
  const counts = countByFilter(clients, 'ruiz', NOW);
  assert.deepEqual(counts, { all: 2, 'needs-checkin': 1, flagged: 1, 'week-due': 1, 'no-feedback': 0, archived: 0 });
});

test('archived clients only match the Archived filter', () => {
  const clients = [
    client('Ana Ruiz', '2026-09-28', { flags: [{ kind: 'pain' }] }),
    { ...client('Beto Ruiz', '2026-09-10', { flags: [{ kind: 'pain' }] }), archivedAt: '2026-09-29T10:00:00Z' },
  ];
  assert.deepEqual(filterClients(clients, { filter: 'all' }, NOW).map((c) => c.displayName), ['Ana Ruiz']);
  assert.deepEqual(filterClients(clients, { filter: 'flagged' }, NOW).map((c) => c.displayName), ['Ana Ruiz']);
  assert.deepEqual(filterClients(clients, { filter: 'archived' }, NOW).map((c) => c.displayName), ['Beto Ruiz']);
  assert.deepEqual(filterClients(clients, { filter: 'archived', query: 'ana' }, NOW), []);
  assert.equal(countByFilter(clients, '', NOW).archived, 1);
  assert.equal(countByFilter(clients, '', NOW).all, 1);
});
