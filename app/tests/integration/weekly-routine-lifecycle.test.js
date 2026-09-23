// specs/010-weekly-routine-versioning quickstart.md Scenarios 1-3, end to end:
// publish.js runs as a real child process and results are read back through the
// real HTTP routes.
//
// Test-safety: namespaced fixture slug; cleans up customers/<slug>/ and the
// Supabase customer row (cascades to its programs rows) in t.after.
//
// Requires SUPABASE_URL/SUPABASE_SECRET_KEY and the 010 migration applied.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getSupabaseClient } from '../../server/lib/database-client.js';
import { startTestServer } from './helpers.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const APP_DIR = path.resolve(__dirname, '..', '..');
const PUBLISH_SCRIPT = path.join(APP_DIR, 'server', 'scripts', 'publish.js');

const FIXTURE_SLUG = 'weekly-routine-lifecycle-test-fixture';
const FIXTURE_DIR = path.join(REPO_ROOT, 'customers', FIXTURE_SLUG);

const programMd = (title, exercise) => `# ${title}

**Level:** Intermediate

### Monday - Full Body
1. **${exercise}** - 3 x 10 - Rest 60s
`;
const WEEK_1 = programMd('Week One Fixture', 'Synthetic Lifecycle Squat');
const WEEK_2 = programMd('Week Two Fixture', 'Synthetic Lifecycle Planche');
const WEEK_2_EDITED = programMd('Week Two Fixture', 'Synthetic Lifecycle Planche Lean');

async function migrationApplied() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return false;
  const { error } = await getSupabaseClient().from('programs').select('week_number').limit(1);
  return !error;
}

const skipReason = (await migrationApplied())
  ? false
  : 'needs Supabase credentials and server/migrations/010-weekly-routine-versioning.sql applied';

function publish(...args) {
  return execFileAsync(process.execPath, ['--env-file=.env.local', PUBLISH_SCRIPT, FIXTURE_SLUG, 'program', ...args], {
    cwd: APP_DIR,
  });
}

function writeProgram(content) {
  fs.writeFileSync(path.join(FIXTURE_DIR, 'program.md'), content);
}

test('weekly routines: independent weeks, in-place updates, and locked history', { skip: skipReason }, async (t) => {
  const server = await startTestServer(() => {});
  const get = async (p) => {
    const res = await fetch(`${server.baseUrl}${p}`);
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };

  t.after(async () => {
    await server.close();
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    await getSupabaseClient().from('customers').delete().eq('slug', FIXTURE_SLUG);
  });

  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  await t.test('US1: a new week is independent and leaves the previous week unchanged', async () => {
    writeProgram(WEEK_1);
    await publish();
    writeProgram(WEEK_2);
    const { stdout } = await publish('--new-week');
    assert.match(stdout, /created week 2/);

    const weeks = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks`);
    assert.equal(weeks.status, 200);
    assert.deepEqual(
      weeks.body.weeks.map(({ weekNumber, isCurrent, isLocked }) => ({ weekNumber, isCurrent, isLocked })),
      [
        { weekNumber: 1, isCurrent: false, isLocked: true },
        { weekNumber: 2, isCurrent: true, isLocked: false },
      ]
    );

    const week1 = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/1`);
    assert.equal(week1.status, 200);
    assert.deepEqual(week1.body.weeklySchedule[0].exercises.map((e) => e.name), ['Synthetic Lifecycle Squat']);

    const week2 = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/2`);
    assert.deepEqual(week2.body.weeklySchedule[0].exercises.map((e) => e.name), ['Synthetic Lifecycle Planche']);

    const customer = await get(`/api/customers/${FIXTURE_SLUG}`);
    assert.equal(customer.body.program.weekNumber, 2);
    assert.equal(customer.body.programWeeks.length, 2);

    const missing = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/9`);
    assert.equal(missing.status, 404);
  });

  await t.test('US2: updating the current week does not touch past weeks', async () => {
    const before = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/1`);
    writeProgram(WEEK_2_EDITED);
    await publish();

    const week2 = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/2`);
    assert.deepEqual(week2.body.weeklySchedule[0].exercises.map((e) => e.name), ['Synthetic Lifecycle Planche Lean']);

    const after = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/1`);
    assert.equal(after.body.version, before.body.version);
    assert.deepEqual(after.body.weeklySchedule, before.body.weeklySchedule);
  });

  await t.test('US3: locked weeks and gaps are rejected without writing', async () => {
    const before = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/1`);
    writeProgram(WEEK_2);

    await assert.rejects(publish('--week', '1'), (err) => /week 1 is locked \(current week is 2\)/.test(err.stderr));
    await assert.rejects(publish('--week', '4'), (err) => /would leave a gap \(next available is 3\)/.test(err.stderr));

    const after = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks/1`);
    assert.equal(after.body.version, before.body.version);
    const weeks = await get(`/api/customers/${FIXTURE_SLUG}/program/weeks`);
    assert.equal(weeks.body.weeks.length, 2);
  });
});
