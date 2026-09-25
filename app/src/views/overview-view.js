import { loadCustomers } from '../components/sidebar.js';
import { renderCustomerCard } from '../components/customer-card.js';
import { deriveStatus, STATUS_RANK } from '../lib/status.js';
import { icon } from '../lib/icons.js';

// User Story 1: a single screen listing every client sorted by urgency, so a coach
// knows who needs attention within seconds (FR-001, FR-002, FR-003, FR-004).
function sortByUrgency(customers) {
  return [...customers].sort((a, b) => {
    const rankA = STATUS_RANK[deriveStatus(a.lastFeedbackDate)];
    const rankB = STATUS_RANK[deriveStatus(b.lastFeedbackDate)];
    if (rankA !== rankB) return rankA - rankB;

    if (a.lastFeedbackDate && b.lastFeedbackDate) {
      if (a.lastFeedbackDate !== b.lastFeedbackDate) {
        return a.lastFeedbackDate < b.lastFeedbackDate ? -1 : 1;
      }
    } else if (a.lastFeedbackDate !== b.lastFeedbackDate) {
      // One has a date and the other doesn't, but both fell into the same status
      // bucket (shouldn't normally happen) — keep it deterministic.
      return a.lastFeedbackDate ? -1 : 1;
    }

    return a.displayName.localeCompare(b.displayName);
  });
}

// Scoreboard counts come from the same status the cards show; no-feedback only
// appears when someone is in that state.
function renderScoreboard(customers) {
  const counts = { 'needs-checkin': 0, 'on-track': 0, 'no-feedback': 0 };
  for (const c of customers) counts[deriveStatus(c.lastFeedbackDate)] += 1;

  const items = [
    ['Clients', customers.length, ''],
    ['Need a check-in', counts['needs-checkin'], counts['needs-checkin'] ? 'is-warning' : ''],
    ['On track', counts['on-track'], 'is-good'],
  ];
  if (counts['no-feedback']) items.push(['No feedback yet', counts['no-feedback'], '']);

  const board = document.createElement('dl');
  board.className = 'scoreboard';
  for (const [label, value, tone] of items) {
    const item = document.createElement('div');
    item.className = `scoreboard-item ${tone}`.trim();
    const dd = document.createElement('dd');
    dd.className = 'scoreboard-value';
    dd.textContent = String(value);
    const dt = document.createElement('dt');
    dt.className = 'scoreboard-label';
    dt.textContent = label;
    item.append(dt, dd); // dt first for valid <dl>; CSS shows the number on top
    board.appendChild(item);
  }
  return board;
}

function renderOverviewSkeleton(container) {
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `
    <div class="loading-skeleton" aria-hidden="true">
      <div class="skeleton-block skeleton-header"></div>
      <div class="customer-list">
        <div class="skeleton-block skeleton-card"></div>
        <div class="skeleton-block skeleton-card"></div>
        <div class="skeleton-block skeleton-card"></div>
      </div>
    </div>
  `;
}

function renderPageHeader(container, extraHtml = '') {
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `<h1>Clients</h1>${extraHtml}`;
  container.appendChild(header);
  return header;
}

export async function renderOverview(container) {
  renderOverviewSkeleton(container);

  let data;
  try {
    data = await loadCustomers({ fresh: true });
  } catch (err) {
    container.removeAttribute('aria-busy');
    container.innerHTML = '';
    renderPageHeader(container);
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message || 'Failed to load clients.';
    container.appendChild(banner);
    return;
  }

  container.removeAttribute('aria-busy');
  container.innerHTML = '';

  if (!data.customers.length) {
    renderPageHeader(container);

    const empty = document.createElement('div');
    empty.className = 'empty-state-card';
    empty.innerHTML = '<p>Add your first client to start building their program.</p>';
    container.appendChild(empty);
    return;
  }

  const sorted = sortByUrgency(data.customers);

  const header = renderPageHeader(
    container,
    `
    <label class="client-search-wrap">
      <input type="search" class="client-search" placeholder="Search by name" aria-label="Search clients">
    </label>
  `
  );
  header.querySelector('.client-search-wrap').prepend(icon('magnifying-glass', 'client-search-icon'));
  container.appendChild(renderScoreboard(sorted));

  const list = document.createElement('div');
  list.className = 'customer-list';
  for (const customer of sorted) {
    list.appendChild(renderCustomerCard(customer));
  }
  container.appendChild(list);

  const noResults = document.createElement('div');
  noResults.className = 'no-search-results';
  noResults.setAttribute('aria-hidden', 'true');
  noResults.setAttribute('role', 'status');
  noResults.textContent = 'No clients match your search.';
  container.appendChild(noResults);

  const searchInput = header.querySelector('.client-search');
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    let visible = 0;
    for (const card of list.children) {
      const name = card.querySelector('h2')?.textContent.toLowerCase() || '';
      const match = query.length === 0 || name.includes(query);
      card.hidden = !match;
      if (match) visible += 1;
    }
    const showEmpty = query.length > 0 && visible === 0;
    noResults.setAttribute('aria-hidden', showEmpty ? 'false' : 'true');
  });
}
