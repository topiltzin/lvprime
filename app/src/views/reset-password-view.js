import { ApiError, requestPasswordReset, resetPasswordWithToken } from '../api-client.js';
import { t } from '../lib/i18n.js';
import { field, passwordToggle, renderBrand } from './login-view.js';

const STRONG = (value) => value.length >= 8 && /\p{L}/u.test(value) && /\d/.test(value);

// Same two-panel layout as the sign-in page.
function shell(container, title, introText) {
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
  const heading = document.createElement('h1');
  heading.textContent = title;
  formSide.appendChild(heading);
  const intro = document.createElement('p');
  intro.className = 'login-intro';
  intro.textContent = introText;
  formSide.appendChild(intro);
  wrap.appendChild(formSide);
  container.appendChild(wrap);
  return formSide;
}

function linkButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'login-link';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

// "Forgot your password?": asks for the email and says the same thing whether or not it
// belongs to a client. Resolves when the user goes back to sign-in.
export function renderForgotPassword(container, presetEmail = '') {
  return new Promise((resolve) => {
    const formSide = shell(container, t('forgot.title'), t('forgot.intro'));
    const form = document.createElement('form');
    form.className = 'feedback-form login-form';
    form.noValidate = true;

    const email = field({ label: t('login.email'), type: 'email', name: 'email', autocomplete: 'username' });
    email.input.inputMode = 'email';
    email.input.value = presetEmail;
    const status = document.createElement('p');
    status.className = 'login-intro';
    status.setAttribute('role', 'status');
    const formError = document.createElement('p');
    formError.className = 'field-error login-form-error';
    formError.setAttribute('role', 'alert');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = t('forgot.send');
    form.append(email.wrap, formError, status, submit, linkButton(t('forgot.back'), () => resolve()));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      email.setError('');
      formError.textContent = '';
      status.textContent = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.input.value.trim())) {
        email.setError(t('login.invalidEmail'));
        email.input.focus();
        return;
      }
      submit.disabled = true;
      submit.textContent = t('forgot.sending');
      try {
        await requestPasswordReset(email.input.value.trim());
        status.textContent = t('forgot.sent');
      } catch (err) {
        formError.textContent = err.message || t('forgot.failed');
      }
      submit.disabled = false;
      submit.textContent = t('forgot.send');
    });

    formSide.appendChild(form);
    email.input.focus();
  });
}

// The page behind the emailed link. Resolves once the password is saved.
export function renderResetPassword(container, token) {
  return new Promise((resolve) => {
    const formSide = shell(container, t('reset.title'), `${t('password.intro')} ${t('password.rules')}`);
    const form = document.createElement('form');
    form.className = 'feedback-form login-form';
    form.noValidate = true;

    const next = field({ label: t('password.new'), type: 'password', name: 'new', autocomplete: 'new-password' });
    const confirm = field({ label: t('password.confirm'), type: 'password', name: 'confirm', autocomplete: 'new-password' });
    for (const f of [next, confirm]) f.control.appendChild(passwordToggle(f.input));
    const formError = document.createElement('p');
    formError.className = 'field-error login-form-error';
    formError.setAttribute('role', 'alert');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = t('password.save');
    form.append(next.wrap, confirm.wrap, formError, submit);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      next.setError('');
      confirm.setError('');
      formError.textContent = '';
      let invalid = null;
      if (!STRONG(next.input.value)) {
        next.setError(t('password.tooWeak'));
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
        await resetPasswordWithToken({ token, newPassword: next.input.value, confirmPassword: confirm.input.value });
        formSide.replaceChildren();
        const done = document.createElement('p');
        done.className = 'login-intro';
        done.setAttribute('role', 'status');
        done.textContent = t('reset.done');
        formSide.append(done, linkButton(t('forgot.back'), () => resolve()));
      } catch (err) {
        if (err instanceof ApiError && err.status === 422 && err.fields) {
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
    next.input.focus();
  });
}
