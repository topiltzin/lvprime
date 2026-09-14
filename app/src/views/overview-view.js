import { getCustomers } from '../api-client.js';
import { renderCustomerCard } from '../components/customer-card.js';

// User Story 1: a single screen listing every customer's status.
export async function renderOverview(container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = '<h1>Customers</h1>';
  container.appendChild(header);

  let data;
  try {
    data = await getCustomers();
  } catch (err) {
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message || 'Failed to load customers.';
    container.appendChild(banner);
    return;
  }

  if (!data.customers.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No customers found under customers/.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'customer-list';
  for (const customer of data.customers) {
    list.appendChild(renderCustomerCard(customer));
  }
  container.appendChild(list);
}
