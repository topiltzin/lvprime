import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  upsertCustomer,
  getCustomerRow,
  listCustomerRows,
  replaceFeedbackEntries,
  replaceAttachments,
} from './db.js';
import { parseProgramGoal, parseFeedbackEntries } from './markdown-parser.js';

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

const STANDARD_FILES = new Set(['program.md', 'feedback.md', 'notes.md']);

function toDisplayName(slug) {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function mtimeOf(filePath) {
  try {
    return Math.floor(fs.statSync(filePath).mtimeMs);
  } catch {
    return null;
  }
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/** All customer slugs currently present under customers/ (folders only). */
export function listCustomerSlugs() {
  if (!fs.existsSync(getCustomersDir())) return [];
  return fs
    .readdirSync(getCustomersDir(), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function scanAttachments(slug, dir) {
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

/**
 * Re-parses and upserts a single customer's index rows if any of its files are
 * newer than what's currently indexed (or if it isn't indexed yet). Never
 * throws for a folder missing some/all of its files — see data-model.md Customer
 * entity: a customer is valid regardless of which files it has.
 */
export function reindexIfStale(db, slug) {
  const dir = path.join(getCustomersDir(), slug);
  if (!fs.existsSync(dir)) return null;

  const programPath = path.join(dir, 'program.md');
  const feedbackPath = path.join(dir, 'feedback.md');
  const notesPath = path.join(dir, 'notes.md');

  const programMtime = mtimeOf(programPath);
  const feedbackMtime = mtimeOf(feedbackPath);
  const notesMtime = mtimeOf(notesPath);

  const existing = getCustomerRow(db, slug);
  const stale =
    !existing ||
    existing.program_mtime !== programMtime ||
    existing.feedback_mtime !== feedbackMtime ||
    existing.notes_mtime !== notesMtime;

  if (!stale) return existing;

  const programText = readIfExists(programPath);
  const feedbackText = readIfExists(feedbackPath);
  const notesText = readIfExists(notesPath);

  const entries = feedbackText ? parseFeedbackEntries(feedbackText) : [];
  const lastMatched = [...entries].reverse().find((e) => e.raw_matched && e.entry_date_iso);

  const row = {
    slug,
    display_name: toDisplayName(slug),
    has_program: programText != null ? 1 : 0,
    has_notes: notesText != null ? 1 : 0,
    program_goal: programText ? parseProgramGoal(programText) : null,
    last_feedback_date: lastMatched ? lastMatched.entry_date_iso : null,
    program_mtime: programMtime,
    feedback_mtime: feedbackMtime,
    notes_mtime: notesMtime,
  };

  upsertCustomer(db, row);
  replaceFeedbackEntries(db, slug, entries);
  replaceAttachments(db, slug, scanAttachments(slug, dir));

  return getCustomerRow(db, slug);
}

/** Reindexes every customer folder currently on disk and returns the summary rows. */
export function listCustomers(db) {
  for (const slug of listCustomerSlugs()) {
    reindexIfStale(db, slug);
  }
  return listCustomerRows(db);
}

export function customerFolderExists(slug) {
  return fs.existsSync(path.join(getCustomersDir(), slug));
}

export function customerPaths(slug) {
  const dir = path.join(getCustomersDir(), slug);
  return {
    dir,
    program: path.join(dir, 'program.md'),
    feedback: path.join(dir, 'feedback.md'),
    notes: path.join(dir, 'notes.md'),
    nutrition: path.join(dir, 'nutrition_plan.md'),
  };
}
