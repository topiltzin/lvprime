// Integration tests for app/server/lib/customer-data.js against the real
// Supabase project (no separate "Supabase test project" exists for this
// app — a second project isn't warranted at this scale, per plan.md's
// 10-50 customer scope). Uses a disposable, clearly-namespaced test
// customer created fresh and deleted at the end of the run, so it never
// touches real customer data. Requires SUPABASE_URL/SUPABASE_SECRET_KEY in
// the environment (see app/.env.example) — skips with a clear message if
// they're not set, rather than failing confusingly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCustomer,
  getCustomerProgram,
  getCustomerNotes,
  getCustomerFeedback,
  updateCustomerProgram,
  updateCustomerNotes,
  addFeedbackEntry,
  syncCoachWrite,
  getSyncState,
  queueOfflineChange,
  getOfflineQueue,
  clearOfflineQueue,
  recordSyncEvent,
  getRecentSyncEvents,
  upsertCustomer,
  computeContentHash,
  CustomerNotFoundError,
} from '../../server/lib/customer-data.js';
import { getSupabaseClient } from '../../server/lib/database-client.js';

const TEST_SLUG = 'integration-test-fixture';
const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test('customer-data.js integration', { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' }, async (t) => {
  t.after(async () => {
    const supabase = getSupabaseClient();
    await supabase.from('customers').delete().eq('slug', TEST_SLUG);
  });

  await t.test('upsertCustomer + getCustomer round trip', async () => {
    const created = await upsertCustomer(TEST_SLUG, 'Integration Test Fixture');
    assert.equal(created.slug, TEST_SLUG);

    const fetched = await getCustomer(TEST_SLUG);
    assert.equal(fetched.id, created.id);
  });

  await t.test('getCustomer throws CustomerNotFoundError for a real-looking but missing slug', async () => {
    await assert.rejects(() => getCustomer('definitely-not-a-real-customer'), CustomerNotFoundError);
  });

  await t.test('updateCustomerProgram/getCustomerProgram round trip content exactly', async () => {
    const content = '# Test Program\n\nWeek 1 content here.';
    await updateCustomerProgram(TEST_SLUG, content);
    const fetched = await getCustomerProgram(TEST_SLUG);
    assert.equal(fetched.content, content);
  });

  await t.test('updateCustomerNotes/getCustomerNotes round trip content exactly', async () => {
    const content = '## Observations\n\n- Test note';
    await updateCustomerNotes(TEST_SLUG, content);
    const fetched = await getCustomerNotes(TEST_SLUG);
    assert.equal(fetched.content, content);
  });

  await t.test('addFeedbackEntry appends using the fallback template, parses back correctly', async () => {
    const before = await getCustomerFeedback(TEST_SLUG);
    assert.equal(before.entries.length, 0);

    await addFeedbackEntry(TEST_SLUG, 'Integration Test Fixture', {
      date: '2026-09-17',
      label: 'Test Session',
      fields: {
        'How customer felt': 'Great',
        Completed: 'Yes',
        Notes: 'Integration test entry',
        'Overall impression': 'Moderate',
      },
    });

    const after = await getCustomerFeedback(TEST_SLUG);
    assert.equal(after.entries.length, 1);
    assert.equal(after.entries[0].entry_date, '2026-09-17');
    assert.equal(after.entries[0].completed, true);
  });

  await t.test('addFeedbackEntry replaces an entry with the same date + label instead of appending (specs/012)', async () => {
    const fields = (felt) => ({
      'How customer felt': felt,
      Completed: 'Yes',
      Notes: 'Upsert test',
      'Overall impression': 'Hard',
    });
    const first = await addFeedbackEntry(TEST_SLUG, 'Integration Test Fixture', {
      date: '2026-09-18', label: 'Upsert Session', fields: fields('First'),
    });
    assert.equal(first.created, true);

    const second = await addFeedbackEntry(TEST_SLUG, 'Integration Test Fixture', {
      date: '2026-09-18', label: 'upsert session', fields: fields('Second'),
    });
    assert.equal(second.created, false);
    assert.equal(second.entry.felt, 'Second');

    let feedback = await getCustomerFeedback(TEST_SLUG);
    assert.equal(feedback.entries.length, 2); // the 2026-09-17 entry + this one
    assert.equal(feedback.entries[1].felt, 'Second');

    const other = await addFeedbackEntry(TEST_SLUG, 'Integration Test Fixture', {
      date: '2026-09-18', label: 'Another Session', fields: fields('Other'),
    });
    assert.equal(other.created, true);
    feedback = await getCustomerFeedback(TEST_SLUG);
    assert.equal(feedback.entries.length, 3);
  });

  await t.test('syncCoachWrite: fresh write, then conflicting stale-version write', async () => {
    const content1 = 'Sync content v1';
    const hash1 = computeContentHash(content1);
    const r1 = await syncCoachWrite(TEST_SLUG, 'notes', { currentVersion: 0, content: content1, contentHash: hash1 });
    assert.equal(r1.newVersion, 1);
    assert.equal(r1.conflicted, false);

    // Stale client still thinks server is at version 0 — should be flagged conflicted
    // but still applied (coach-always-wins).
    const content2 = 'Sync content v2 (stale client)';
    const hash2 = computeContentHash(content2);
    const r2 = await syncCoachWrite(TEST_SLUG, 'notes', { currentVersion: 0, content: content2, contentHash: hash2 });
    assert.equal(r2.newVersion, 2);
    assert.equal(r2.conflicted, true);

    const state = await getSyncState(TEST_SLUG, 'notes');
    assert.equal(state.version, 2);
    assert.equal(state.lastWriter, 'coach');

    const events = await getRecentSyncEvents(TEST_SLUG, 10);
    const eventTypes = events.map((e) => e.event_type);
    assert.ok(eventTypes.includes('sync_conflict'));
    assert.ok(eventTypes.includes('sync_success'));
  });

  await t.test('offline queue: sequential entries accepted, gap rejected, clear empties it', async () => {
    await queueOfflineChange(TEST_SLUG, 'program', {
      sequence: 1,
      timestamp: new Date().toISOString(),
      action: 'edit',
      content_hash: computeContentHash('q1'),
      content_size_bytes: 2,
    });
    await queueOfflineChange(TEST_SLUG, 'program', {
      sequence: 2,
      timestamp: new Date().toISOString(),
      action: 'edit',
      content_hash: computeContentHash('q2'),
      content_size_bytes: 2,
    });

    const queue = await getOfflineQueue(TEST_SLUG, 'program');
    assert.equal(queue.length, 2);

    await assert.rejects(() =>
      queueOfflineChange(TEST_SLUG, 'program', {
        sequence: 10,
        timestamp: new Date().toISOString(),
        action: 'edit',
        content_hash: computeContentHash('q3'),
        content_size_bytes: 2,
      })
    );

    await clearOfflineQueue(TEST_SLUG, 'program');
    const afterClear = await getOfflineQueue(TEST_SLUG, 'program');
    assert.equal(afterClear.length, 0);
  });

  await t.test('recordSyncEvent + getRecentSyncEvents append-only audit log', async () => {
    await recordSyncEvent(TEST_SLUG, 'program', 'sync_error', { errorMessage: 'test error' });
    const events = await getRecentSyncEvents(TEST_SLUG, 1);
    assert.equal(events[0].event_type, 'sync_error');
    assert.equal(events[0].error_message, 'test error');
  });
});
