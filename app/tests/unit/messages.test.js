import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeMessage } from '../../server/lib/messages.js';

// The 016 conversation is read-only history since feature 018.

test('shapeMessage exposes the public fields only', () => {
  const row = { id: 7, customer_slug: 'ana', sender_role: 'coach', body: 'Great week!', client_id: 'x', created_at: '2026-10-06T14:02:11Z', read_at: null };
  assert.deepEqual(shapeMessage(row), { id: 7, senderRole: 'coach', body: 'Great week!', createdAt: '2026-10-06T14:02:11Z', readAt: null });
});
