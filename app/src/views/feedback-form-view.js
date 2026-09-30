import { submitFeedback, ApiError } from '../api-client.js';
// Local calendar date, so "today" matches the Program tab's "Mark done" (specs/012).
import { todayIso } from '../lib/day-completion.js';
import { hasString, t } from '../lib/i18n.js';
import { fieldInputSpec, fieldLabelKey } from '../lib/feedback-fields.js';

// User Story 3: a form built dynamically from the customer's own feedback.md
// template (research.md §4/§5 — templates differ per customer). Calls
// onSuccess(newEntry) after a successful submit so the caller can refresh the
// feedback list/trend in place without a page reload.
// Only "Completed" is required; each other field's input comes from its example value
// in the template (feedback-fields.js), and a blank one is saved as "not reported".

function selectInput(options) {
  const select = document.createElement('select');
  for (const [value, text] of options) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    select.appendChild(o);
  }
  return select;
}

function fieldInput(spec) {
  if (spec.kind === 'scale') {
    const steps = [];
    for (let n = spec.min; n <= spec.max; n++) steps.push([String(n), String(n)]);
    return selectInput([['', t('logForm.skip')], ...steps]);
  }
  if (spec.kind === 'choice') {
    return selectInput([['', t('logForm.skip')], ...spec.options.map((o) => [o, o])]);
  }
  const textarea = document.createElement('textarea');
  textarea.rows = 2;
  textarea.placeholder = spec.placeholder;
  return textarea;
}

export function renderFeedbackForm(slug, template, onSuccess) {
  const wrap = document.createElement('div');
  wrap.className = 'card log-session-form-wrap';

  const heading = document.createElement('h3');
  heading.textContent = t('logForm.title');
  wrap.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'form-intro';
  intro.textContent = t('logForm.intro');
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
  dateLabel.textContent = t('common.date');
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
  labelLabel.textContent = t('logForm.label');
  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.name = 'label';
  labelInput.placeholder = t('logForm.labelPlaceholder');
  labelLabel.appendChild(labelInput);
  metaRow.appendChild(labelLabel);

  const fieldInputs = {};
  const fieldErrors = {};
  for (const fieldName of template.fields) {
    const label = document.createElement('label');
    const labelKey = fieldLabelKey(fieldName);
    label.textContent = hasString(labelKey) ? t(labelKey) : fieldName;
    // Same test as the server's isCompletedLikeField ("Completed", "Completó"; not "Exercises completed").
    const isCompleted = /^complet/i.test(fieldName.trim());
    let input;
    if (isCompleted) {
      // Values stay Yes/No (what the server and feedback.md expect); only the text is translated.
      input = selectInput([['', t('logForm.select')], ['Yes', t('logForm.yes')], ['No', t('logForm.no')]]);
      input.required = true;
    } else {
      input = fieldInput(fieldInputSpec(template.hints?.[fieldName]));
    }
    input.name = fieldName;
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
  submitBtn.textContent = t('logForm.submit');
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
      dateError.textContent = t('common.required');
      hasClientError = true;
    }
    for (const [fieldName, input] of Object.entries(fieldInputs)) {
      if (input.required && !input.value.trim()) {
        fieldErrors[fieldName].textContent = t('common.required');
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
        formError.textContent = err.message || t('logForm.failed');
      }
    } finally {
      submitBtn.disabled = false;
    }
  });

  wrap.appendChild(form);

  // "Add details" from a Program day card (specs/012): same date + label enriches that
  // session on save instead of adding a second one.
  wrap.prefill = ({ date, label }) => {
    clearErrors();
    dateInput.value = date || todayIso();
    labelInput.value = label || '';
  };
  wrap.focusFirstField = () => Object.values(fieldInputs)[0]?.focus();
  return wrap;
}
