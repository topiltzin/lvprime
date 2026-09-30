import { createCustomer, ApiError } from '../api-client.js';
import { invalidateSidebar } from './sidebar.js';
import { t } from '../lib/i18n.js';

/** "Add client" button that opens an inline name form; on success opens the new client. */
export function renderNewClientControl() {
  const wrap = document.createElement('div');
  wrap.className = 'new-client';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pdf-download-button';
  button.textContent = t('newClient.button');
  wrap.appendChild(button);

  const form = document.createElement('form');
  form.className = 'feedback-form card new-client-form';
  form.hidden = true;
  const label = document.createElement('label');
  label.textContent = t('newClient.label');
  const input = document.createElement('input');
  input.type = 'text';
  input.required = true;
  input.maxLength = 255;
  input.autocomplete = 'off';
  input.placeholder = t('newClient.placeholder');
  label.appendChild(input);
  const error = document.createElement('div');
  error.className = 'field-error';
  error.setAttribute('role', 'alert');
  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pdf-download-button';
  cancel.textContent = t('common.cancel');
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = t('newClient.submit');
  actions.append(error, cancel, submit);
  form.append(label, actions);
  wrap.appendChild(form);

  const close = () => {
    form.hidden = true;
    button.hidden = false;
    error.textContent = '';
    input.value = '';
  };
  button.addEventListener('click', () => {
    form.hidden = false;
    button.hidden = true;
    input.focus();
  });
  cancel.addEventListener('click', close);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    try {
      const created = await createCustomer(input.value);
      invalidateSidebar();
      window.location.hash = `#/customers/${encodeURIComponent(created.slug)}`;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        error.textContent = t('newClient.exists');
      } else if (err instanceof ApiError && err.fields?.name) {
        error.textContent = err.fields.name;
      } else {
        error.textContent = err.message || t('newClient.failed');
      }
    } finally {
      submit.disabled = false;
    }
  });

  return wrap;
}
