import test from 'node:test';
import assert from 'node:assert/strict';
import { notepadPrefill, notepadStartText } from '../../src/lib/day-notes.js';
import {
  extractFeedbackTemplate,
  formatFeedbackEntry,
  parseFeedbackEntries,
  setEntryNotes,
  upsertFeedbackEntryText,
} from '../../server/markdown-parser.js';

const day = {
  day: 'Monday',
  exercises: [
    { name: 'Goblet squat', setsReps: '3x12' },
    { name: 'Plank', setsReps: '' },
  ],
};
const template = { headingLevel: 2, fields: ['How customer felt', 'Completed', 'Notes', 'Overall impression'] };
const key = { date: '2026-10-03', label: 'Monday - Legs' };

test('notepadPrefill lists each exercise as a line to finish', () => {
  assert.equal(notepadPrefill(day), 'Goblet squat — 3x12: \nPlank: ');
  assert.equal(notepadPrefill({ day: 'Sunday' }), '');
});

test('notepadStartText prefers the saved note over the exercise list', () => {
  assert.equal(notepadStartText(day, { notes: 'Squat 40kg\nfelt great' }), 'Squat 40kg\nfelt great');
  assert.equal(notepadStartText(day, { notes: null }), notepadPrefill(day));
});

test('a multi-line note round-trips through the entry format as one entry', () => {
  const notes = 'Goblet squat — 3x12: 40kg\n\n# not a heading\n---\n```\nPlank: 45s';
  const text = formatFeedbackEntry(template, {
    ...key,
    fieldValues: { 'How customer felt': 'ok', Completed: 'Yes', Notes: notes, 'Overall impression': 'Hard' },
  });
  const entries = parseFeedbackEntries(`# Log\n\n${text}\n\n## 2026-10-04 - Next\n- Completed: No\n`);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].notes, notes);
  assert.equal(entries[0].difficulty, 'Hard');
  assert.equal(entries[1].completed, false);
});

test('setEntryNotes replaces only the notes field, repeatedly, without duplicating the day', () => {
  const base = upsertFeedbackEntryText('', template, {
    ...key,
    fieldValues: { 'How customer felt': 'good', Completed: 'Yes', Notes: 'old\nlines', 'Overall impression': 'Easy' },
  }).content;
  const once = setEntryNotes(base, template, { ...key, notes: 'a\nb\nc' }).content;
  const twice = setEntryNotes(once, template, { ...key, notes: 'single' }).content;
  const entries = parseFeedbackEntries(twice);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].notes, 'single');
  assert.equal(entries[0].felt, 'good');
  assert.equal(entries[0].difficulty, 'Easy');
  assert.equal(entries[0].completed, true);
});

test('setEntryNotes adds a notes field when missing, and returns null without an entry', () => {
  const noNotes = { headingLevel: 2, fields: ['Completed'] };
  const base = upsertFeedbackEntryText('', noNotes, { ...key, fieldValues: { Completed: 'Yes' } }).content;
  const out = setEntryNotes(base, noNotes, { ...key, notes: 'hello\nworld' }).content;
  assert.equal(parseFeedbackEntries(out)[0].notes, 'hello\nworld');
  assert.equal(setEntryNotes(base, noNotes, { date: '2026-01-01', label: 'x', notes: 'y' }), null);
});

test('clearing the note stores "not reported", which reads back as no note', () => {
  const base = upsertFeedbackEntryText('', template, {
    ...key,
    fieldValues: { 'How customer felt': 'x', Completed: 'Yes', Notes: 'something', 'Overall impression': 'x' },
  }).content;
  const cleared = setEntryNotes(base, template, { ...key, notes: '   ' }).content;
  assert.equal(parseFeedbackEntries(cleared)[0].notes, null);
});
