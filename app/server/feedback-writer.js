import fs from 'node:fs';
import { extractFeedbackTemplate, formatFeedbackEntry, parseFeedbackEntries } from './markdown-parser.js';
import { customerPaths } from './customers-repo.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isCompletedLikeField(fieldLabel) {
  return /^complet/i.test(fieldLabel.trim());
}

/**
 * Validates a feedback submission against the template extracted from that
 * customer's own feedback.md (or the fallback template if the file doesn't
 * exist yet). Returns { valid: true, template } or { valid: false, fields }.
 * No file/DB write happens here (constitution Principle II — verify before save).
 */
export function validateFeedbackSubmission(template, body) {
  const fields = {};
  const values = body && typeof body.fields === 'object' && body.fields ? body.fields : {};

  if (!body || !body.date || !isValidIsoDate(body.date)) {
    fields.date = 'required (YYYY-MM-DD)';
  }

  for (const fieldLabel of template.fields) {
    const value = values[fieldLabel];
    if (value == null || String(value).trim() === '') {
      fields[fieldLabel] = 'required';
      continue;
    }
    if (isCompletedLikeField(fieldLabel) && !/^(s[ií]|yes|no)/i.test(String(value).trim())) {
      fields[fieldLabel] = 'must be Yes/No (or Sí/No)';
    }
  }

  if (Object.keys(fields).length > 0) {
    return { valid: false, fields };
  }
  return { valid: true };
}

/**
 * Appends a validated feedback entry to customers/:slug/feedback.md, matching
 * that file's own existing entry template exactly (spec FR-008). Creates the
 * file with a minimal header if it does not exist yet (spec edge case).
 */
export function appendFeedbackEntry(slug, displayName, { date, label, fields }) {
  const { feedback: feedbackPath } = customerPaths(slug);
  let existingText = '';
  try {
    existingText = fs.readFileSync(feedbackPath, 'utf8');
  } catch {
    existingText = '';
  }

  const template = extractFeedbackTemplate(existingText);
  const entryText = formatFeedbackEntry(template, { date, label, fieldValues: fields });

  let newText;
  if (existingText.trim() === '') {
    newText = `# ${displayName} - Feedback & Progress Log\n\n${entryText}\n`;
  } else {
    const separator = existingText.endsWith('\n\n')
      ? ''
      : existingText.endsWith('\n')
        ? '\n'
        : '\n\n';
    newText = `${existingText}${separator}${entryText}\n`;
  }

  fs.writeFileSync(feedbackPath, newText, 'utf8');

  const parsed = parseFeedbackEntries(newText);
  return parsed[parsed.length - 1];
}

export function getFeedbackTemplate(slug) {
  const { feedback: feedbackPath } = customerPaths(slug);
  let text = '';
  try {
    text = fs.readFileSync(feedbackPath, 'utf8');
  } catch {
    text = '';
  }
  return extractFeedbackTemplate(text);
}
