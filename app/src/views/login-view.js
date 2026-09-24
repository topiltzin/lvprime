import { login } from '../api-client.js';

// Coach password screen, shown when the API answers 401 (server/auth.js).
// Resolves once the session cookie is set so the caller can retry its request.
export function renderLogin(container) {
  return new Promise((resolve) => {
    container.removeAttribute('aria-busy');
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'log-session-form-wrap login-wrap';

    const heading = document.createElement('h1');
    heading.textContent = 'Coach sign-in';
    wrap.appendChild(heading);

    const form = document.createElement('form');
    form.className = 'feedback-form';

    const label = document.createElement('label');
    label.textContent = 'Password';
    const input = document.createElement('input');
    input.type = 'password';
    input.name = 'password';
    input.autocomplete = 'current-password';
    input.required = true;
    label.appendChild(input);
    form.appendChild(label);

    const error = document.createElement('p');
    error.className = 'field-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    form.appendChild(error);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Sign in';
    form.appendChild(submit);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submit.disabled = true;
      error.hidden = true;
      try {
        await login(input.value);
        resolve();
      } catch (err) {
        error.textContent = err.status === 401 ? 'Wrong password.' : err.message;
        error.hidden = false;
        submit.disabled = false;
        input.select();
      }
    });

    wrap.appendChild(form);
    container.appendChild(wrap);
    input.focus();
  });
}
