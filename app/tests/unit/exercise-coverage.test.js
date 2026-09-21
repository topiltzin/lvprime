// Unit test for check-exercise-coverage.js's pure diff logic — no Supabase
// involved, per contracts/coverage-check.md's Testing Checklist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { diffMissingExercises, formatCoverageReport } from '../../server/scripts/check-exercise-coverage.js';

test('diffMissingExercises returns only names absent from the library, case-insensitively', () => {
  const usages = [
    { name: 'Push-up', slug: 'alice' },
    { name: 'Barbell Bench Press', slug: 'alice' },
    { name: 'squat', slug: 'bob' }, // matches library's "Squat" case-insensitively
  ];
  const libraryNames = ['Push-up', 'Squat'];

  const missing = diffMissingExercises(usages, libraryNames);
  assert.deepEqual(missing, [{ name: 'Barbell Bench Press', slugs: ['alice'] }]);
});

test('diffMissingExercises deduplicates a missing name used by multiple customers, listing all slugs', () => {
  const usages = [
    { name: 'Face Pull', slug: 'alice' },
    { name: 'face pull', slug: 'bob' },
    { name: 'FACE PULL', slug: 'alice' }, // same customer again — must not duplicate the slug
  ];

  const missing = diffMissingExercises(usages, []);
  assert.deepEqual(missing, [{ name: 'Face Pull', slugs: ['alice', 'bob'] }]);
});

test('diffMissingExercises returns an empty array when every used name has a library match', () => {
  const usages = [{ name: 'Squat', slug: 'alice' }];
  const missing = diffMissingExercises(usages, ['squat']);
  assert.deepEqual(missing, []);
});

test('diffMissingExercises returns an empty array for no usages at all', () => {
  assert.deepEqual(diffMissingExercises([], ['Squat']), []);
});

// specs/009-publish-coverage-check/contracts/publish-coverage-integration.md
test('formatCoverageReport reports "no coverage gaps" when missing is empty', () => {
  const text = formatCoverageReport({ customerCount: 2, distinctUsedCount: 10, libraryCount: 93, missing: [] });
  assert.equal(
    text,
    'Scanned 2 customer(s), 10 distinct exercise name(s) referenced.\n' +
      'Library has 93 exercise(s).\n' +
      'Missing: 0\n' +
      '\n' +
      'No coverage gaps — every referenced exercise name has a library match.'
  );
});

test('formatCoverageReport lists each missing entry, in the given order, with its referencing slugs', () => {
  const text = formatCoverageReport({
    customerCount: 2,
    distinctUsedCount: 12,
    libraryCount: 93,
    missing: [
      { name: 'Barbell Bench Press', slugs: ['topiltzin-flores'] },
      { name: 'Face Pull', slugs: ['alice', 'bob'] },
    ],
  });
  assert.equal(
    text,
    'Scanned 2 customer(s), 12 distinct exercise name(s) referenced.\n' +
      'Library has 93 exercise(s).\n' +
      'Missing: 2\n' +
      '\n' +
      '  "Barbell Bench Press" — used by: topiltzin-flores\n' +
      '  "Face Pull" — used by: alice, bob'
  );
});
