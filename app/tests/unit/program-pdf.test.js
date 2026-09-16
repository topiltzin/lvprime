import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgramWeekPdfContent } from '../../src/components/program-pdf.js';

// User Story 2 / contracts/pdf-export-download.md: the pure content-model builder behind
// the PDF export, tested without any DOM or jsPDF dependency.

test('buildProgramWeekPdfContent uses the matching weeklyProgression entry for the given week', () => {
  const programDetail = {
    weeklySchedule: [{ day: 'Monday', focus: 'Legs', html: '<p>Squat</p>', exercises: [] }],
    weeklyProgression: [
      { weekNumber: 1, text: 'Find a comfortable load.' },
      { weekNumber: 2, text: 'Increase reps within the given range.' },
    ],
  };

  const content = buildProgramWeekPdfContent(2, programDetail);
  assert.equal(content.weekLabel, 'Week 2');
  assert.equal(content.progressionText, 'Increase reps within the given range.');
  assert.deepEqual(content.days, programDetail.weeklySchedule);
});

test('buildProgramWeekPdfContent falls back to the standard message when no entry matches the week', () => {
  const programDetail = {
    weeklySchedule: [{ day: 'Monday', focus: 'Legs', html: '<p>Squat</p>', exercises: [] }],
    weeklyProgression: [{ weekNumber: 1, text: 'Find a comfortable load.' }],
  };

  const content = buildProgramWeekPdfContent(3, programDetail);
  assert.equal(content.weekLabel, 'Week 3');
  assert.equal(content.progressionText, 'No specific guidance for this week.');
});

test('buildProgramWeekPdfContent returns an empty days array (no throw) for an empty schedule', () => {
  const programDetail = { weeklySchedule: [], weeklyProgression: [] };

  const content = buildProgramWeekPdfContent(1, programDetail);
  assert.deepEqual(content.days, []);
  assert.equal(content.weekLabel, 'Week 1');
  assert.equal(content.progressionText, 'No specific guidance for this week.');
});
