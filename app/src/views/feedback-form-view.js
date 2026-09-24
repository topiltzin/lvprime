import { submitFeedback, ApiError } from '../api-client.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// User Story 3: a form built dynamically from the customer's own feedback.md
// template (research.md §4/§5 — templates differ per customer). Calls
// onSuccess(newEntry) after a successful submit so the caller can refresh the
// feedback list/trend in place without a page reload.
export function renderFeedbackForm(slug, template, onSuccess) {
  const wrap = document.createElement('div');
  wrap.className = 'card log-session-form-wrap';

  const heading = document.createElement('h3');
  heading.textContent = 'Log a new session';
  wrap.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'form-intro';
  intro.textContent = 'Saved entries appear under Feedback, newest first.';
  wrap.appendChild(intro);

  const form = document.createElement('form');
  form.className = 'feedback-form';

  // Date + label side by side, template fields in a two-column grid (one column on phones).
  const metaRow = document.createElement('div');
  metaRow.className = 'form-row';
  form.appendChild(metaRow);
  const fieldGrid = document.createElement('div');
  fieldGrid.className = 'form-grid';

  const dateLabel = document.createElement('label');
  dateLabel.textContent = 'Date';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.name = 'date';
  dateInput.value = todayIso();
  dateInput.required = true;
  dateLabel.appendChild(dateInput);
  metaRow.appendChild(dateLabel);
  const dateError = document.createElement('div');
  dateError.className = 'field-error';
  dateLabel.appendChild(dateError);

  const labelLabel = document.createElement('label');
  labelLabel.textContent = 'Session label (optional)';
  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.name = 'label';
  labelInput.placeholder = 'e.g. Lunes - Piernas A';
  labelLabel.appendChild(labelInput);
  metaRow.appendChild(labelLabel);

  const fieldInputs = {};
  const fieldErrors = {};
  for (const fieldName of template.fields) {
    const label = document.createElement('label');
    label.textContent = fieldName;
    const isCompleted = /complet/i.test(fieldName);
    let input;
    if (isCompleted) {
      input = document.createElement('select');
      ['', 'Yes', 'No'].forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt || 'Select…';
        input.appendChild(o);
      });
    } else {
      input = document.createElement('textarea');
      input.rows = 2;
    }
    input.name = fieldName;
    input.required = true;
    label.appendChild(input);
    const err = document.createElement('div');
    err.className = 'field-error';
    label.appendChild(err);
    fieldGrid.appendChild(label);
    fieldInputs[fieldName] = input;
    fieldErrors[fieldName] = err;
  }

  form.appendChild(fieldGrid);

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const formError = document.createElement('div');
  formError.className = 'field-error';
  actions.appendChild(formError);
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Save entry';
  actions.appendChild(submitBtn);
  form.appendChild(actions);

  function clearErrors() {
    dateError.textContent = '';
    formError.textContent = '';
    for (const err of Object.values(fieldErrors)) err.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    // Client-side required-field check before hitting the server (spec FR-007).
    let hasClientError = false;
    if (!dateInput.value) {
      dateError.textContent = 'required';
      hasClientError = true;
    }
    for (const [fieldName, input] of Object.entries(fieldInputs)) {
      if (!input.value.trim()) {
        fieldErrors[fieldName].textContent = 'required';
        hasClientError = true;
      }
    }
    if (hasClientError) return;

    submitBtn.disabled = true;
    try {
      const fields = {};
      for (const [name, input] of Object.entries(fieldInputs)) fields[name] = input.value.trim();
      const created = await submitFeedback(slug, {
        date: dateInput.value,
        label: labelInput.value.trim() || null,
        fields,
      });
      form.reset();
      dateInput.value = todayIso();
      onSuccess(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.fields) {
        for (const [key, message] of Object.entries(err.fields)) {
          if (key === 'date') dateError.textContent = message;
          else if (fieldErrors[key]) fieldErrors[key].textContent = message;
          else formError.textContent = `${key}: ${message}`;
        }
      } else {
        formError.textContent = err.message || 'Failed to save entry.';
      }
    } finally {
      submitBtn.disabled = false;
    }
  });

  wrap.appendChild(form);
  return wrap;
}
