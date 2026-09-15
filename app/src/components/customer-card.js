import { deriveStatus, STATUS_LABEL, formatRelativeCheckIn } from '../lib/status.js';

// Renders one client's overview card (User Story 1, FR-002).
export function renderCustomerCard(customer) {
  const a = document.createElement('a');
  a.className = 'customer-card';
  a.href = `#/customers/${encodeURIComponent(customer.slug)}`;

  const h2 = document.createElement('h2');
  h2.textContent = customer.displayName;
  a.appendChild(h2);

  const goalLine = document.createElement('p');
  goalLine.className = 'summary-line goal-line';
  if (customer.hasProgram && customer.programGoal) {
    goalLine.textContent = customer.programGoal;
  } else if (customer.hasProgram) {
    goalLine.textContent = 'Program in progress';
  } else {
    goalLine.innerHTML = '<span class="badge missing">No program yet</span>';
  }
  a.appendChild(goalLine);

  const footer = document.createElement('div');
  footer.className = 'customer-card-footer';

  const checkIn = document.createElement('span');
  checkIn.className = 'check-in-date';
  checkIn.textContent = `Last check-in · ${formatRelativeCheckIn(customer.lastFeedbackDate)}`;
  footer.appendChild(checkIn);

  const status = deriveStatus(customer.lastFeedbackDate);
  const pill = document.createElement('span');
  pill.className = `status-pill status-${status}`;
  pill.textContent = STATUS_LABEL[status];
  footer.appendChild(pill);

  a.appendChild(footer);

  return a;
}
