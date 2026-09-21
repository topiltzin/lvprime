// Unit test for migrate-exercises.js's pure parsing logic. Uses a synthetic
// fixture rather than the real repo-root exercise.md — that file was a
// one-time migration source and is deleted once migrated (spec FR-009,
// specs/007-exercise-library-migration US3); a test reading it would break
// permanently the moment the migration completed, which defeats the point of
// an ongoing regression test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExerciseMd } from '../../server/migrations/migrate-exercises.js';

const FIXTURE = `# Exercise Library

## Strength — Upper Body

| Exercise | How-to video |
|---|---|
| Push-up | https://example.com/push-up |
| Pull-up | https://example.com/pull-up |

## Cardio

| Exercise | How-to video |
|---|---|
| Burpee | https://example.com/burpee |
`;

test('parseExerciseMd extracts every row across multiple category sections, skipping header/separator rows', () => {
  const rows = parseExerciseMd(FIXTURE);

  assert.deepEqual(rows, [
    { name: 'Push-up', category: 'Strength — Upper Body', videoUrl: 'https://example.com/push-up' },
    { name: 'Pull-up', category: 'Strength — Upper Body', videoUrl: 'https://example.com/pull-up' },
    { name: 'Burpee', category: 'Cardio', videoUrl: 'https://example.com/burpee' },
  ]);

  const names = rows.map((r) => r.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, 'expected no duplicate exercise names to be parsed');
});

test('parseExerciseMd ignores a table header row and a separator row', () => {
  const text = `## Cardio

| Exercise | How-to video |
|---|---|
| Burpee | https://example.com/burpee |
`;
  const rows = parseExerciseMd(text);
  assert.deepEqual(rows, [{ name: 'Burpee', category: 'Cardio', videoUrl: 'https://example.com/burpee' }]);
});
