// End-to-end proof (specs/009-publish-coverage-check spec FR-008, User Story 2
// Scenario 2): spawns publish.js as a REAL child process against a
// disposable fixture customer, and asserts on its actual stdout — the only
// way to prove main() really calls reportProgramCoverage() in the right
// place, under the right conditions (see research.md §4 for why this is a
// deliberately new testing shape for this codebase).
//
// Test-safety: fixture customer name is clearly namespaced and its exercise
// name is synthetic (can never collide with a real library entry). Cleans up
// both the local customers/<slug>/ directory and the Supabase customer row
// (which cascades to its program row) in t.after.
//
// Requires SUPABASE_URL/SUPABASE_SECRET_KEY (see app/.env.example) — skips
// with a clear message if not set.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getSupabaseClient } from '../../server/lib/database-client.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const APP_DIR = path.resolve(__dirname, '..', '..');
const PUBLISH_SCRIPT = path.join(APP_DIR, 'server', 'scripts', 'publish.js');

const FIXTURE_SLUG = 'publish-cli-test-fixture-customer';
const FIXTURE_EXERCISE_NAME = 'Totally Synthetic Publish CLI Test Exercise';
const FIXTURE_DIR = path.join(REPO_ROOT, 'customers', FIXTURE_SLUG);

const PROGRAM_MD = `# Publish CLI Test Fixture

**Objetivo:** Test fixture only — never a real customer.

### Monday - Full Body
1. **${FIXTURE_EXERCISE_NAME}** - 3 x 10 - Rest 60s
`;

const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test(
  'publish.js CLI reports a coverage gap for a real new customer end-to-end',
  { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' },
  async (t) => {
    t.after(async () => {
      fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
      const supabase = getSupabaseClient();
      await supabase.from('customers').delete().eq('slug', FIXTURE_SLUG);
    });

    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(path.join(FIXTURE_DIR, 'program.md'), PROGRAM_MD);

    const { stdout } = await execFileAsync(
      process.execPath,
      ['--env-file=.env.local', PUBLISH_SCRIPT, FIXTURE_SLUG, 'program'],
      { cwd: APP_DIR }
    );

    assert.match(stdout, new RegExp(`Published ${FIXTURE_SLUG}/program: version \\d+ -> \\d+`));
    assert.match(stdout, /Missing: \d+/);
    assert.match(stdout, new RegExp(`"${FIXTURE_EXERCISE_NAME}" — used by: [^\\n]*${FIXTURE_SLUG}`));
  }
);
