// appendFeedbackEntry/getFeedbackTemplate (fs.readFileSync/writeFileSync
// against feedback.md) were removed here as part of specs/006-customer-data-
// storage: superseded by app/server/lib/customer-data.js's addFeedbackEntry/
// getCustomerFeedback, which do the same thing against Supabase. This file
// now only holds the pure validation function, which has no fs dependency.

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
