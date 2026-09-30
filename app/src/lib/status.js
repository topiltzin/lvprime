// Client urgency/status derivation (data-model.md → Status, FR-002). Pure function of the
// customer summary's lastFeedbackDate and "now" — no new data source, see research.md §2.

import { t } from './i18n.js';

const NEEDS_CHECKIN_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {string|null} lastFeedbackDate - ISO date string (YYYY-MM-DD) or null
 * @param {Date} [now] - injectable for testing; defaults to the current time
 * @returns {"no-feedback"|"needs-checkin"|"on-track"}
 */
export function deriveStatus(lastFeedbackDate, now = new Date()) {
  if (!lastFeedbackDate) return 'no-feedback';

  const last = new Date(`${lastFeedbackDate}T00:00:00`);
  if (Number.isNaN(last.getTime())) return 'no-feedback';

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSince = Math.floor((today.getTime() - last.getTime()) / MS_PER_DAY);

  return daysSince > NEEDS_CHECKIN_THRESHOLD_DAYS ? 'needs-checkin' : 'on-track';
}

export const STATUS_RANK = { 'no-feedback': 0, 'needs-checkin': 1, 'on-track': 2 };

/** Display label for a deriveStatus() value, in the interface language. */
export function statusLabel(status) {
  return t(`status.${status}`);
}

/**
 * Relative "last check-in" phrase for an overview card (FR-002).
 * @param {string|null} lastFeedbackDate
 * @param {Date} [now]
 */
export function formatRelativeCheckIn(lastFeedbackDate, now = new Date()) {
  if (!lastFeedbackDate) return t('rel.never');

  const last = new Date(`${lastFeedbackDate}T00:00:00`);
  if (Number.isNaN(last.getTime())) return t('rel.never');

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSince = Math.floor((today.getTime() - last.getTime()) / MS_PER_DAY);

  if (daysSince <= 0) return t('rel.today');
  if (daysSince === 1) return t('rel.yesterday');
  return t('rel.daysAgo', { n: daysSince });
}
