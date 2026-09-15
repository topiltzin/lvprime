import { getCustomers } from '../api-client.js';
import { renderCustomerCard } from '../components/customer-card.js';
import { deriveStatus, STATUS_RANK } from '../lib/status.js';

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

export async function renderOverview(container) {
  container.innerHTML = '';

  let data;
  try {
    data = await getCustomers();
  } catch (err) {
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = '<h1>Clients</h1>';
    container.appendChild(header);
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message || 'Failed to load clients.';
    container.appendChild(banner);
    return;
  }

  if (!data.customers.length) {
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = '<h1>Clients</h1>';
    container.appendChild(header);

    const empty = document.createElement('div');
    empty.className = 'empty-state-card';
    empty.innerHTML = '<p>Add your first client to start building their program.</p>';
    container.appendChild(empty);
    return;
  }

  const sorted = sortByUrgency(data.customers);

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header-title">
      <h1>Clients</h1>
      <span class="count-badge">${sorted.length}</span>
    </div>
    <input type="search" class="client-search" placeholder="Search clients" aria-label="Search clients">
  `;
  container.appendChild(header);

  const list = document.createElement('div');
  list.className = 'customer-list';
  for (const customer of sorted) {
    list.appendChild(renderCustomerCard(customer));
  }
  container.appendChild(list);

  const searchInput = header.querySelector('.client-search');
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    for (const card of list.children) {
      const name = card.querySelector('h2')?.textContent.toLowerCase() || '';
      card.hidden = query.length > 0 && !name.includes(query);
    }
  });
}
