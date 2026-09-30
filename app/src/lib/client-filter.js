import { deriveStatus } from './status.js';

// Overview filters. Pure, so the counts on the chips and the visible cards can never disagree.
// Archived clients only ever match the 'archived' filter; every other filter covers
// active clients. Labels come from i18n ('filter.<id>').
export const FILTERS = [
  { id: 'all' },
  { id: 'needs-checkin' },
  { id: 'flagged' },
  { id: 'week-due' },
  { id: 'no-feedback' },
  { id: 'archived' },
];

const matchers = {
  all: () => true,
  'needs-checkin': (c, now) => deriveStatus(c.lastFeedbackDate, now) === 'needs-checkin',
  flagged: (c) => (c.signals?.flags?.length || 0) > 0,
  'week-due': (c) => !!c.signals?.weekDue,
  'no-feedback': (c, now) => deriveStatus(c.lastFeedbackDate, now) === 'no-feedback',
};

export function isArchived(customer) {
  return !!customer.archivedAt;
}

export function matchesFilter(customer, filterId, now = new Date()) {
  if (filterId === 'archived') return isArchived(customer);
  if (isArchived(customer)) return false;
  return (matchers[filterId] || matchers.all)(customer, now);
}

export function matchesQuery(customer, query) {
  const q = String(query || '').trim().toLowerCase();
  return !q || customer.displayName.toLowerCase().includes(q);
}

/** Customers passing both the chip filter and the name search. */
export function filterClients(customers, { filter = 'all', query = '' } = {}, now = new Date()) {
  return customers.filter((c) => matchesFilter(c, filter, now) && matchesQuery(c, query));
}

/** Chip counts, computed against the name search so they always match what a click would show. */
export function countByFilter(customers, query = '', now = new Date()) {
  const counts = {};
  for (const { id } of FILTERS) {
    counts[id] = customers.filter((c) => matchesFilter(c, id, now) && matchesQuery(c, query)).length;
  }
  return counts;
}
