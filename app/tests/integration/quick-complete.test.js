// "Mark done" quick-complete (specs/012-program-day-mark-done contracts/feedback-api.md).
// Validation cases run everywhere; the write cases hit the real Supabase project with
// a disposable fixture customer (same approach as customer-data.test.js) and skip
// without SUPABASE_URL/SUPABASE_SECRET_KEY.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCustomerFeedback,
  quickCompleteFeedbackEntry,
  upsertCustomer,
} from '../../server/lib/customer-data.js';
import { getSupabaseClient } from '../../server/lib/database-client.js';
import { validateQuickCompleteSubmission } from '../../server/feedback-writer.js';

const EN_SLUG = 'integration-test-quick-complete';
const ES_SLUG = 'integration-test-quick-complete-es';
const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test('validateQuickCompleteSubmission', () => {
  assert.deepEqual(validateQuickCompleteSubmission({ date: '2026-09-25', label: 'Lunes - Piernas A' }), { valid: true });
  assert.deepEqual(validateQuickCompleteSubmission({ date: '2026-13-01', label: 'Lunes' }).fields, {
    date: 'required (YYYY-MM-DD)',
  });
  assert.deepEqual(validateQuickCompleteSubmission({ date: '2026-09-25', label: '   ' }).fields, { label: 'required' });
  assert.deepEqual(validateQuickCompleteSubmission({ date: '2026-09-25', label: 'x'.repeat(201) }).fields, {
    label: 'must be 200 characters or fewer',
  });
  assert.equal(validateQuickCompleteSubmission(null).valid, false);
});

async function setFeedbackContent(slug, content) {
  const supabase = getSupabaseClient();
  const { data: customer } = await supabase.from('customers').select('id').eq('slug', slug).single();
  const { error } = await supabase
    .from('feedbacks')
    .upsert({ customer_id: customer.id, content, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' });
  if (error) throw error;
}

test('quickCompleteFeedbackEntry integration', { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' }, async (t) => {
  t.after(async () => {
    await getSupabaseClient().from('customers').delete().in('slug', [EN_SLUG, ES_SLUG]);
  });
  await upsertCustomer(EN_SLUG, 'Quick Complete Fixture');
  await upsertCustomer(ES_SLUG, 'Quick Complete Fixture ES');

  await t.test('first call creates a completed entry with "not reported" defaults', async () => {
    const { entry, created } = await quickCompleteFeedbackEntry(EN_SLUG, 'Quick Complete Fixture', {
      date: '2026-09-25', label: 'Lunes - Piernas A',
    });
    assert.equal(created, true);
    assert.equal(entry.completed, true);
    assert.equal(entry.felt, null);
    assert.equal(entry.difficulty, null);
    assert.equal(entry.notes, null);
    assert.equal(entry.raw_matched, true);

    const { content } = await getCustomerFeedback(EN_SLUG);
    assert.match(content, /- How customer felt: Not reported\n- Completed: Yes\n- Notes: Not reported/);
  });

  await t.test('second call is a no-op: no duplicate entry', async () => {
    const { created } = await quickCompleteFeedbackEntry(EN_SLUG, 'Quick Complete Fixture', {
      date: '2026-09-25', label: 'lunes - piernas a',
    });
    assert.equal(created, false);
    assert.equal((await getCustomerFeedback(EN_SLUG)).entries.length, 1);
  });

  await t.test('an existing Completed: No entry is flipped and keeps its details', async () => {
    await setFeedbackContent(EN_SLUG, `# Log

## 2026-09-24 - Martes - Pull
- How customer felt: Tired
- Completed: No
- Notes: Skipped the last set
- Overall impression: Hard
`);
    const { entry, created } = await quickCompleteFeedbackEntry(EN_SLUG, 'Quick Complete Fixture', {
      date: '2026-09-24', label: 'Martes - Pull',
    });
    assert.equal(created, false);
    assert.equal(entry.completed, true);
    assert.equal(entry.felt, 'Tired');
    assert.equal(entry.notes, 'Skipped the last set');
    assert.equal((await getCustomerFeedback(EN_SLUG)).entries.length, 1);
  });

  await t.test('a Spanish template gets Sí and No reportado', async () => {
    await setFeedbackContent(ES_SLUG, `# Registro

### Formato de Entrada
\`\`\`
### [Fecha] - [Día]
- Energía: [1-10]
- Completado: [Sí/No]
- Notas: [Observaciones]
- Dificultad: [Fácil/Moderada/Difícil]
\`\`\`
`);
    const { entry, created } = await quickCompleteFeedbackEntry(ES_SLUG, 'Quick Complete Fixture ES', {
      date: '2026-09-25', label: 'Lunes - Piernas A',
    });
    assert.equal(created, true);
    assert.equal(entry.completed, true);
    const { content } = await getCustomerFeedback(ES_SLUG);
    assert.match(content, /### 2026-09-25 - Lunes - Piernas A\n- Energía: No reportado\n- Completado: Sí\n- Notas: No reportado\n- Dificultad: No reportado/);
  });
});
