import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldInputSpec } from '../../src/lib/feedback-fields.js';
import { extractFeedbackTemplate } from '../../server/markdown-parser.js';
import { validateFeedbackSubmission, withNotReported } from '../../server/feedback-writer.js';

// Hints taken from real customer feedback.md templates.
test('fieldInputSpec turns a numeric range into a scale', () => {
  assert.deepEqual(fieldInputSpec('[1-10]'), { kind: 'scale', min: 1, max: 10 });
  assert.deepEqual(fieldInputSpec('[0 - 5]'), { kind: 'scale', min: 0, max: 5 });
  assert.equal(fieldInputSpec('[1-100]').kind, 'text'); // too many steps for a picker
});

test('fieldInputSpec turns a short slash list into a choice', () => {
  assert.deepEqual(fieldInputSpec('[Easy/Moderate/Hard/Brutal]'), {
    kind: 'choice',
    options: ['Easy', 'Moderate', 'Hard', 'Brutal'],
  });
  assert.deepEqual(fieldInputSpec('[Baja/Normal/Alta]').options, ['Baja', 'Normal', 'Alta']);
  assert.deepEqual(fieldInputSpec('[Fácil/Moderada/Difícil]').options, ['Fácil', 'Moderada', 'Difícil']);
});

test('fieldInputSpec keeps free text, with the hint as placeholder', () => {
  for (const [hint, placeholder] of [
    ['[X/Y]', 'X/Y'],
    ['[No/Sí - dónde]', 'No/Sí - dónde'],
    ['[Pain? 1-10 or "None"]', 'Pain? 1-10 or "None"'],
    ['[muscle soreness, fatigue, pain location]', 'muscle soreness, fatigue, pain location'],
    ['[Nombre]', 'Nombre'],
  ]) {
    assert.deepEqual(fieldInputSpec(hint), { kind: 'text', placeholder }, hint);
  }
  assert.deepEqual(fieldInputSpec(undefined), { kind: 'text', placeholder: '' });
  assert.deepEqual(fieldInputSpec('free words'), { kind: 'text', placeholder: '' });
});

const FEEDBACK = `# Log

## Session Format
\`\`\`
## [Date] - [Day/Focus Area]
- Energy level: [1-10]
- Completed: [Yes/No]
- Notes:
\`\`\`
`;

test('extractFeedbackTemplate keeps each field hint', () => {
  const template = extractFeedbackTemplate(FEEDBACK);
  assert.deepEqual(template.fields, ['Energy level', 'Completed', 'Notes']);
  assert.deepEqual(template.hints, { 'Energy level': '[1-10]', Completed: '[Yes/No]' });
  assert.deepEqual(extractFeedbackTemplate('# no format block').hints, {});
});

test('only Completed is required; blanks are saved as not reported', () => {
  const template = extractFeedbackTemplate(FEEDBACK);
  assert.deepEqual(validateFeedbackSubmission(template, { date: '2026-09-30', fields: { Completed: 'Yes' } }), {
    valid: true,
  });
  assert.deepEqual(validateFeedbackSubmission(template, { date: '2026-09-30', fields: { Notes: 'x' } }).fields, {
    Completed: 'required',
  });
  assert.deepEqual(withNotReported(template, { Completed: 'Yes', 'Energy level': ' 7 ', Notes: '  ' }), {
    'Energy level': '7',
    Completed: 'Yes',
    Notes: 'Not reported',
  });
});
