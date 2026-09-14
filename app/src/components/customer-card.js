// Renders one customer's overview card (User Story 1).
export function renderCustomerCard(customer) {
  const a = document.createElement('a');
  a.className = 'customer-card';
  a.href = `#/customers/${encodeURIComponent(customer.slug)}`;

  const h2 = document.createElement('h2');
  h2.textContent = customer.displayName;
  a.appendChild(h2);

  const goalLine = document.createElement('p');
  goalLine.className = 'summary-line';
  if (customer.hasProgram && customer.programGoal) {
    goalLine.textContent = `Goal: ${customer.programGoal}`;
  } else if (customer.hasProgram) {
    goalLine.textContent = 'Program: present';
  } else {
    goalLine.innerHTML = '<span class="badge missing">program not yet created</span>';
  }
  a.appendChild(goalLine);

  const feedbackLine = document.createElement('p');
  feedbackLine.className = 'summary-line';
  feedbackLine.textContent = customer.lastFeedbackDate
    ? `Last feedback: ${customer.lastFeedbackDate}`
    : 'No feedback logged yet';
  a.appendChild(feedbackLine);

  if (!customer.hasNotes) {
    const notesLine = document.createElement('p');
    notesLine.className = 'summary-line';
    notesLine.innerHTML = '<span class="badge missing">notes not yet created</span>';
    a.appendChild(notesLine);
  }

  return a;
}
