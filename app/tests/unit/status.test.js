import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStatus } from '../../src/lib/status.js';

const NOW = new Date('2026-09-15T12:00:00');

test('deriveStatus: null date is no-feedback', () => {
  assert.equal(deriveStatus(null, NOW), 'no-feedback');
});

test('deriveStatus: date more than 7 days before now is needs-checkin', () => {
  // 2026-09-06 is 9 days before 2026-09-15
  assert.equal(deriveStatus('2026-09-06', NOW), 'needs-checkin');
});

test('deriveStatus: date within the last 7 days is on-track', () => {
  // 2026-09-10 is 5 days before 2026-09-15
  assert.equal(deriveStatus('2026-09-10', NOW), 'on-track');
});

test('deriveStatus: exact 7-day boundary is still on-track', () => {
  // 2026-09-08 is exactly 7 days before 2026-09-15
  assert.equal(deriveStatus('2026-09-08', NOW), 'on-track');
});

test('deriveStatus: 8 days before now is needs-checkin (just past the boundary)', () => {
  assert.equal(deriveStatus('2026-09-07', NOW), 'needs-checkin');
});

test('deriveStatus: today is on-track', () => {
  assert.equal(deriveStatus('2026-09-15', NOW), 'on-track');
});
