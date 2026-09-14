import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'index.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  has_program INTEGER NOT NULL,
  has_notes INTEGER NOT NULL,
  program_goal TEXT,
  last_feedback_date TEXT,
  program_mtime INTEGER,
  feedback_mtime INTEGER,
  notes_mtime INTEGER
);

CREATE TABLE IF NOT EXISTS feedback_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_slug TEXT NOT NULL REFERENCES customers(slug),
  entry_date TEXT,
  label TEXT,
  felt TEXT,
  completed INTEGER,
  difficulty TEXT,
  notes TEXT,
  raw_matched INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback_entries(customer_slug, sort_order);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_slug TEXT NOT NULL REFERENCES customers(slug),
  relative_path TEXT NOT NULL,
  size_bytes INTEGER,
  modified_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attachments_customer ON attachments(customer_slug);
`;

/**
 * Opens (creating if needed) the local SQLite index. This database is a derived,
 * disposable cache — see research.md §5 — never the source of truth for customer
 * data, and safe to delete at any time (it will be rebuilt from customers/ on the
 * next scan).
 */
export function openDb(dbPath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export function upsertCustomer(db, customer) {
  db.prepare(
    `INSERT INTO customers (slug, display_name, has_program, has_notes, program_goal, last_feedback_date, program_mtime, feedback_mtime, notes_mtime)
     VALUES (@slug, @display_name, @has_program, @has_notes, @program_goal, @last_feedback_date, @program_mtime, @feedback_mtime, @notes_mtime)
     ON CONFLICT(slug) DO UPDATE SET
       display_name=excluded.display_name,
       has_program=excluded.has_program,
       has_notes=excluded.has_notes,
       program_goal=excluded.program_goal,
       last_feedback_date=excluded.last_feedback_date,
       program_mtime=excluded.program_mtime,
       feedback_mtime=excluded.feedback_mtime,
       notes_mtime=excluded.notes_mtime`
  ).run(customer);
}

export function getCustomerRow(db, slug) {
  return db.prepare('SELECT * FROM customers WHERE slug = ?').get(slug);
}

export function listCustomerRows(db) {
  return db.prepare('SELECT * FROM customers ORDER BY display_name').all();
}

export function replaceFeedbackEntries(db, slug, entries) {
  const del = db.prepare('DELETE FROM feedback_entries WHERE customer_slug = ?');
  const insert = db.prepare(
    `INSERT INTO feedback_entries (customer_slug, entry_date, label, felt, completed, difficulty, notes, raw_matched, sort_order)
     VALUES (@customer_slug, @entry_date, @label, @felt, @completed, @difficulty, @notes, @raw_matched, @sort_order)`
  );
  db.exec('BEGIN');
  try {
    del.run(slug);
    for (const row of entries) {
      insert.run({
        customer_slug: slug,
        entry_date: row.entry_date,
        label: row.label,
        felt: row.felt,
        completed: row.completed == null ? null : row.completed ? 1 : 0,
        difficulty: row.difficulty,
        notes: row.notes,
        raw_matched: row.raw_matched ? 1 : 0,
        sort_order: row.sort_order,
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function listFeedbackEntries(db, slug) {
  return db
    .prepare('SELECT * FROM feedback_entries WHERE customer_slug = ? ORDER BY sort_order')
    .all(slug);
}

export function replaceAttachments(db, slug, attachments) {
  const del = db.prepare('DELETE FROM attachments WHERE customer_slug = ?');
  const insert = db.prepare(
    `INSERT INTO attachments (customer_slug, relative_path, size_bytes, modified_at)
     VALUES (@customer_slug, @relative_path, @size_bytes, @modified_at)`
  );
  db.exec('BEGIN');
  try {
    del.run(slug);
    for (const row of attachments) insert.run({ customer_slug: slug, ...row });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function listAttachments(db, slug) {
  return db
    .prepare('SELECT relative_path, size_bytes, modified_at FROM attachments WHERE customer_slug = ?')
    .all(slug);
}

const DIFFICULTY_SCORE = { 'fácil': 1, facil: 1, easy: 1, 'moderada': 2, moderate: 2, 'difícil': 3, dificil: 3, hard: 3, brutal: 4 };

/**
 * Computes the completion-rate and difficulty/energy trend from a customer's
 * indexed feedback entries (research.md §8 / data-model.md Feedback Entry).
 */
export function getFeedbackTrend(db, slug) {
  const rows = listFeedbackEntries(db, slug).filter((r) => r.raw_matched);
  const withCompleted = rows.filter((r) => r.completed != null);
  const completionRate = withCompleted.length
    ? withCompleted.filter((r) => r.completed === 1).length / withCompleted.length
    : null;
  const points = rows.map((r) => ({
    date: r.entry_date,
    completed: r.completed == null ? null : !!r.completed,
    difficulty: r.difficulty,
    difficultyScore: r.difficulty ? DIFFICULTY_SCORE[r.difficulty.trim().toLowerCase()] ?? null : null,
  }));
  return { completionRate, points };
}
