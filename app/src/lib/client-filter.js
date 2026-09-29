import { deriveStatus } from './status.js';

// Overview filters. Pure, so the counts on the chips and the visible cards can never disagree.
export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'needs-checkin', label: 'Needs check-in' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'week-due', label: 'New week due' },
  { id: 'no-feedback', label: 'No feedback yet' },
];

const matchers = {
  all: () => true,
  'needs-checkin': (c, now) => deriveStatus(c.lastFeedbackDate, now) === 'needs-checkin',
  flagged: (c) => (c.signals?.flags?.length || 0) > 0,
  'week-due': (c) => !!c.signals?.weekDue,
  'no-feedback': (c, now) => deriveStatus(c.lastFeedbackDate, now) === 'no-feedback',
};

export function matchesFilter(customer, filterId, now = new Date()) {
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
