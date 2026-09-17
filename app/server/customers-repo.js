// The SQLite-backed indexing (reindexIfStale/listCustomers/customerFolderExists/
// customerPaths, and db.js itself) that used to live here was removed as part
// of specs/006-customer-data-storage: reads now go straight to Supabase via
// app/server/lib/customer-data.js (listAllCustomers, getCustomer, etc.),
// which needs no local index/cache. Only the filesystem-based attachment
// scanning remains — attachments (PDFs etc.) are out of scope for the DB
// migration and stay directly on disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_CUSTOMERS_DIR = path.resolve(__dirname, '..', '..', 'customers');

// A function, not a frozen constant: read fresh on every call so integration
// tests (which run multiple fixtures within one process/module instance) can
// point at a different temporary directory per test via the env var, without
// being stuck with whatever was resolved at module-import time.
export function getCustomersDir() {
  return process.env.FITNESS_DASHBOARD_CUSTOMERS_DIR
    ? path.resolve(process.env.FITNESS_DASHBOARD_CUSTOMERS_DIR)
    : REPO_CUSTOMERS_DIR;
}

// Pre-existing bug fixed here: nutrition_plan.md was missing from this set,
// so it incorrectly showed up in the attachments list (found while wiring
// specs/006-customer-data-storage, unrelated to the Supabase migration itself).
const STANDARD_FILES = new Set(['program.md', 'feedback.md', 'notes.md', 'nutrition_plan.md']);

/** All customer slugs currently present under customers/ (folders only). */
export function listCustomerSlugs() {
  if (!fs.existsSync(getCustomersDir())) return [];
  return fs
    .readdirSync(getCustomersDir(), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function scanAttachments(slug, dir) {
  const attachments = [];
  function walk(current, relBase) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile() && !STANDARD_FILES.has(relPath)) {
        const stat = fs.statSync(fullPath);
        attachments.push({
          relative_path: relPath,
          size_bytes: stat.size,
          modified_at: Math.floor(stat.mtimeMs),
        });
      }
    }
  }
  walk(dir, '');
  return attachments;
}
