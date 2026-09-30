import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgramWeekPdfContent } from '../../src/components/program-pdf.js';
import { setLangForTests } from '../../src/lib/i18n.js';

// specs/010 contracts/week-tab-navigation-v2.md "PDF export": the content model is built
// from one week's own routine, tested without any DOM or jsPDF dependency.

test("buildProgramWeekPdfContent labels and fills the PDF from that week's own routine", () => {
  const weekDetail = {
    weekNumber: 2,
    weeklySchedule: [{ day: 'Monday', focus: 'Push', html: '<p>Tuck Planche Hold</p>', exercises: [] }],
    progressionHtml: '<ul><li>Add reps</li></ul>',
  };

  setLangForTests('en');
  const content = buildProgramWeekPdfContent(weekDetail);
  assert.equal(content.weekLabel, 'Week 2');
  assert.equal(content.weekNumber, 2);
  assert.deepEqual(content.days, weekDetail.weeklySchedule);
  assert.equal(content.progressionHtml, '<ul><li>Add reps</li></ul>');
});

test('buildProgramWeekPdfContent returns an empty days array and no progression for a bare week', () => {
  setLangForTests('en');
  const content = buildProgramWeekPdfContent({ weekNumber: 1, weeklySchedule: [] });
  assert.deepEqual(content.days, []);
  assert.equal(content.weekLabel, 'Week 1');
  assert.equal(content.progressionHtml, null);
});

test('the PDF week label follows the interface language (Spanish by default)', () => {
  setLangForTests('es');
  assert.equal(buildProgramWeekPdfContent({ weekNumber: 3, weeklySchedule: [] }).weekLabel, 'Semana 3');
  setLangForTests('en');
});
