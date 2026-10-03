import { ApiError, changePassword } from '../api-client.js';
import { t } from '../lib/i18n.js';
import { field, passwordToggle, renderBrand } from './login-view.js';

const STRONG = (value) => value.length >= 8 && /\p{L}/u.test(value) && /\d/.test(value);

// Shown to a customer signing in with the coach's default password (specs/015 US3).
// Nothing else is reachable until it succeeds; resolves once the password is saved so
// the caller can reload into the customer's page.
export function renderChangePassword(container) {
  return new Promise((resolve) => {
    document.body.classList.add('is-login');
    container.removeAttribute('aria-busy');
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'login-wrap';
    const panel = document.createElement('aside');
    panel.className = 'login-panel';
    panel.appendChild(renderBrand());
    wrap.appendChild(panel);

    const formSide = document.createElement('div');
    formSide.className = 'login-form-side';
    wrap.appendChild(formSide);

    const heading = document.createElement('h1');
    heading.textContent = t('password.title');
    formSide.appendChild(heading);
    const intro = document.createElement('p');
    intro.className = 'login-intro';
    intro.textContent = `${t('password.intro')} ${t('password.rules')}`;
    formSide.appendChild(intro);

    const form = document.createElement('form');
    form.className = 'feedback-form login-form';
    form.noValidate = true;

    const current = field({ label: t('password.current'), type: 'password', name: 'current', autocomplete: 'current-password' });
    const next = field({ label: t('password.new'), type: 'password', name: 'new', autocomplete: 'new-password' });
    const confirm = field({ label: t('password.confirm'), type: 'password', name: 'confirm', autocomplete: 'new-password' });
    for (const f of [current, next, confirm]) f.control.appendChild(passwordToggle(f.input));
    form.append(current.wrap, next.wrap, confirm.wrap);

    const formError = document.createElement('p');
    formError.className = 'field-error login-form-error';
    formError.setAttribute('role', 'alert');
    form.appendChild(formError);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = t('password.save');
    form.appendChild(submit);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      for (const f of [current, next, confirm]) f.setError('');
      formError.textContent = '';

      // The server makes the same checks; these catch most mistakes without a request.
      let invalid = null;
      if (!current.input.value) {
        current.setError(t('password.noCurrent'));
        invalid ??= current.input;
      }
      if (!STRONG(next.input.value)) {
        next.setError(t('password.tooWeak'));
        invalid ??= next.input;
      } else if (next.input.value === current.input.value) {
        next.setError(t('password.same'));
        invalid ??= next.input;
      }
      if (confirm.input.value !== next.input.value) {
        confirm.setError(t('password.mismatch'));
        invalid ??= confirm.input;
      }
      if (invalid) {
        invalid.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = t('password.saving');
      try {
        await changePassword({
          currentPassword: current.input.value,
          newPassword: next.input.value,
          confirmPassword: confirm.input.value,
        });
        resolve();
      } catch (err) {
        if (err instanceof ApiError && err.status === 422 && err.fields) {
          if (err.fields.currentPassword) current.setError(err.fields.currentPassword);
          if (err.fields.newPassword) next.setError(err.fields.newPassword);
          if (err.fields.confirmPassword) confirm.setError(err.fields.confirmPassword);
        } else {
          formError.textContent = err.message || t('password.failed');
        }
        submit.disabled = false;
        submit.textContent = t('password.save');
      }
    });

    formSide.appendChild(form);
    container.appendChild(wrap);
    current.input.focus();
  });
}
