import { getCustomers } from '../api-client.js';
import { deriveStatus, STATUS_LABEL } from '../lib/status.js';
import { initials } from '../lib/format.js';
import { icon } from '../lib/icons.js';

// Desktop client switcher (hidden below the sidebar breakpoint in CSS). Rendered after
// the main view so a 401 is handled once by the view's own request, not raced here.
let customersPromise = null;

function loadCustomers() {
  if (!customersPromise) {
    customersPromise = getCustomers().catch((err) => {
      customersPromise = null;
      throw err;
    });
  }
  return customersPromise;
}

/** Drops the cached list so the next render refetches (e.g. after a new check-in). */
export function invalidateSidebar() {
  customersPromise = null;
}

export async function renderSidebar(el, activeSlug) {
  let data;
  try {
    data = await loadCustomers();
  } catch {
    el.hidden = true;
    return;
  }

  el.innerHTML = '';

  const all = document.createElement('a');
  all.href = '#/';
  all.className = 'sidebar-home';
  all.appendChild(icon('users'));
  const allText = document.createElement('span');
  allText.textContent = 'All clients';
  all.appendChild(allText);
  const count = document.createElement('span');
  count.className = 'sidebar-count';
  count.textContent = String(data.customers.length);
  all.appendChild(count);
  if (!activeSlug) all.setAttribute('aria-current', 'page');
  el.appendChild(all);

  const list = document.createElement('ul');
  list.className = 'sidebar-list';
  const sorted = [...data.customers].sort((a, b) => a.displayName.localeCompare(b.displayName));
  for (const customer of sorted) {
    const status = deriveStatus(customer.lastFeedbackDate);
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = `sidebar-client sidebar-client--${status}`;
    link.href = `#/customers/${encodeURIComponent(customer.slug)}`;
    if (customer.slug === activeSlug) link.setAttribute('aria-current', 'page');

    const avatar = document.createElement('span');
    avatar.className = 'sidebar-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = initials(customer.displayName);
    link.appendChild(avatar);

    const text = document.createElement('span');
    text.className = 'sidebar-client-text';
    const name = document.createElement('span');
    name.className = 'sidebar-client-name';
    name.textContent = customer.displayName;
    const meta = document.createElement('span');
    meta.className = 'sidebar-client-status';
    meta.textContent = STATUS_LABEL[status];
    text.append(name, meta);
    link.appendChild(text);

    li.appendChild(link);
    list.appendChild(li);
  }
  el.appendChild(list);
  el.hidden = false;
}
