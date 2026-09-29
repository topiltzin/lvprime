import { loadCustomers } from '../components/sidebar.js';
import { renderCustomerCard } from '../components/customer-card.js';
import { deriveStatus, STATUS_RANK } from '../lib/status.js';
import { icon } from '../lib/icons.js';
import { FILTERS, countByFilter, filterClients } from '../lib/client-filter.js';
import { renderNewClientControl } from '../components/new-client-form.js';

// User Story 1: a single screen listing every client sorted by urgency, so a coach
// knows who needs attention within seconds (FR-001, FR-002, FR-003, FR-004).
function sortByUrgency(customers) {
  return [...customers].sort((a, b) => {
    // A client with a pain/"brutal" flag from a recent session comes first.
    const flagA = a.signals?.flags?.length ? 0 : 1;
    const flagB = b.signals?.flags?.length ? 0 : 1;
    if (flagA !== flagB) return flagA - flagB;

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
    const emptyHeader = renderPageHeader(container);
    emptyHeader.appendChild(renderNewClientControl());

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
  container.insertBefore(renderNewClientControl(), header.nextSibling);
  container.appendChild(renderScoreboard(sorted));

  const list = document.createElement('div');
  list.className = 'customer-list';
  const cards = new Map();
  for (const customer of sorted) {
    const card = renderCustomerCard(customer);
    cards.set(customer.slug, card);
    list.appendChild(card);
  }

  // Filter chips + search work together. State survives opening a client and coming back.
  const state = loadFilterState();
  const bar = document.createElement('div');
  bar.className = 'filter-bar';
  const chipGroup = document.createElement('div');
  chipGroup.className = 'filter-chips';
  chipGroup.setAttribute('role', 'group');
  chipGroup.setAttribute('aria-label', 'Filter clients');
  const chips = new Map();
  const totals = countByFilter(sorted);
  for (const { id, label } of FILTERS) {
    // "No feedback yet" only appears when someone is in that state, like the scoreboard.
    if (id === 'no-feedback' && !totals[id]) continue;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.dataset.filter = id;
    const text = document.createElement('span');
    text.textContent = label;
    const count = document.createElement('span');
    count.className = 'filter-chip-count';
    chip.append(text, count);
    chip.addEventListener('click', () => {
      state.filter = id;
      update();
    });
    chips.set(id, { chip, count });
    chipGroup.appendChild(chip);
  }
  if (!chips.has(state.filter)) state.filter = 'all';
  const status = document.createElement('p');
  status.className = 'filter-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  bar.append(chipGroup, status);
  container.appendChild(bar);
  container.appendChild(list);

  const noResults = document.createElement('div');
  noResults.className = 'empty-state-card empty-state-with-cta filter-empty';
  noResults.hidden = true;
  const noResultsText = document.createElement('p');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'empty-state-cta';
  clear.textContent = 'Show all clients';
  noResults.append(noResultsText, clear);
  container.appendChild(noResults);

  const searchInput = header.querySelector('.client-search');
  searchInput.value = state.query;

  function update() {
    const visible = new Set(filterClients(sorted, state).map((c) => c.slug));
    for (const [slug, card] of cards) card.hidden = !visible.has(slug);

    const counts = countByFilter(sorted, state.query);
    for (const [id, { chip, count }] of chips) {
      count.textContent = String(counts[id]);
      chip.setAttribute('aria-pressed', String(id === state.filter));
    }

    const filterLabel = FILTERS.find((f) => f.id === state.filter).label;
    const searching = state.query.trim().length > 0;
    status.textContent = visible.size === sorted.length
      ? `${sorted.length} ${sorted.length === 1 ? 'client' : 'clients'}`
      : `Showing ${visible.size} of ${sorted.length} clients`;

    noResults.hidden = visible.size > 0;
    if (visible.size === 0) {
      noResultsText.textContent = state.filter === 'flagged' && !searching
        ? 'No client has a pain or "brutal" flag in their last sessions.'
        : searching
          ? `No clients match "${state.query.trim()}"${state.filter === 'all' ? '' : ` under ${filterLabel}`}.`
          : `No clients under ${filterLabel} right now.`;
    }
    saveFilterState(state);
  }

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    update();
  });
  clear.addEventListener('click', () => {
    state.filter = 'all';
    state.query = '';
    searchInput.value = '';
    update();
    searchInput.focus();
  });
  update();
}

const FILTER_STORAGE_KEY = 'lvprime.overview.filter';

// Per-viewer convenience only; the overview works the same when storage is unavailable.
function loadFilterState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY) || '{}');
    return {
      filter: FILTERS.some((f) => f.id === saved.filter) ? saved.filter : 'all',
      query: typeof saved.query === 'string' ? saved.query : '',
    };
  } catch {
    return { filter: 'all', query: '' };
  }
}

function saveFilterState(state) {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore: private mode or blocked storage
  }
}
