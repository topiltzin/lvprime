/**
 * One-time copy of client attachments (PDFs etc.) from the repo's customers/
 * directory into the private Supabase Storage bucket the app now reads from
 * (server/lib/attachments.js). Creates the bucket when it doesn't exist.
 *
 * Idempotent: files already in the bucket are skipped, never overwritten.
 * Files whose names Storage can't hold are uploaded under a sanitized name.
 * Clients that aren't in Supabase are skipped.
 *
 * Run from app/:
 *   node --env-file=.env.local server/migrations/migrate-attachments.js [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCustomersDir, listCustomerSlugs, scanAttachments } from '../customers-repo.js';
import { getCustomer, CustomerNotFoundError } from '../lib/customer-data.js';
import {
  AttachmentRejectedError,
  ensureAttachmentsBucket,
  sanitizeFileName,
  uploadAttachment,
} from '../lib/attachments.js';

const dryRun = process.argv.includes('--dry-run');

function storagePath(relPath) {
  const parts = relPath.split('/');
  return [...parts.slice(0, -1).map((p) => sanitizeFileName(p) || 'folder'), sanitizeFileName(parts.at(-1))].join('/');
}

async function main() {
  if (!dryRun && (await ensureAttachmentsBucket())) console.log('Created the private customer-attachments bucket.');

  const counts = { uploaded: 0, skipped: 0, failed: 0 };
  for (const slug of listCustomerSlugs()) {
    try {
      await getCustomer(slug);
    } catch (err) {
      if (err instanceof CustomerNotFoundError) {
        console.log(`- ${slug}: not in Supabase, skipped`);
        continue;
      }
      throw err;
    }

    const dir = path.join(getCustomersDir(), slug);
    for (const { relative_path: relPath } of scanAttachments(slug, dir)) {
      if (relPath.endsWith('.md') || path.basename(relPath).startsWith('.')) continue;
      const target = storagePath(relPath);
      const label = `${slug}/${relPath}${target === relPath ? '' : ` -> ${target}`}`;
      if (dryRun) {
        console.log(`  would upload ${label}`);
        continue;
      }
      try {
        await uploadAttachment(slug, target, fs.readFileSync(path.join(dir, relPath)));
        counts.uploaded++;
        console.log(`  uploaded ${label}`);
      } catch (err) {
        if (err instanceof AttachmentRejectedError && err.reason === 'exists') {
          counts.skipped++;
          console.log(`  already there: ${label}`);
        } else {
          counts.failed++;
          console.error(`  FAILED ${label}: ${err.message}`);
        }
      }
    }
  }

  console.log(`\nDone${dryRun ? ' (dry run)' : ''}: ${counts.uploaded} uploaded, ${counts.skipped} already there, ${counts.failed} failed.`);
  if (counts.failed) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
