// Integration test for publish.js's reportProgramCoverage() — the happy-path
// proof in isolation (contracts/publish-coverage-integration.md's Testing
// Checklist). The "does publish.js's main() actually call this, in the right
// place, under the right conditions" question is covered separately by
// tests/integration/publish-cli.test.js, which spawns the real CLI.
//
// Requires SUPABASE_URL/SUPABASE_SECRET_KEY (see app/.env.example) — skips
// with a clear message if not set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reportProgramCoverage } from '../../server/scripts/publish.js';

const skip = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;

test(
  'reportProgramCoverage resolves without throwing against live data',
  { skip: skip && 'SUPABASE_URL/SUPABASE_SECRET_KEY not set' },
  async () => {
    await assert.doesNotReject(() => reportProgramCoverage());
  }
);
