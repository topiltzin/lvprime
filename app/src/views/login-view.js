import { login, ApiError } from '../api-client.js';
import { icon } from '../lib/icons.js';

// LvPrime lock-up for the sign-in brand panel. The mark is cloned from the header
// SVG in index.html, so its geometry lives in one place.
function renderBrand() {
  const brand = document.createElement('div');
  brand.className = 'login-brand';

  const headerMark = document.querySelector('.app-header .logo-mark');
  if (headerMark) {
    const mark = headerMark.cloneNode(true);
    mark.classList.add('login-mark');
    brand.appendChild(mark);
  }

  const wordmark = document.createElement('p');
  wordmark.className = 'login-wordmark';
  wordmark.append('Lv');
  const prime = document.createElement('em');
  prime.textContent = 'Prime';
  wordmark.appendChild(prime);
  brand.appendChild(wordmark);

  const tagline = document.createElement('p');
  tagline.className = 'login-tagline';
  tagline.textContent = 'Strength for the decades ahead.';
  brand.appendChild(tagline);

  return brand;
}

// One labelled field: label above, input, error below (announced on change).
function field({ label, type, name, autocomplete }) {
  const wrap = document.createElement('div');
  wrap.className = 'login-field';

  const id = `login-${name}`;
  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  wrap.appendChild(labelEl);

  const control = document.createElement('div');
  control.className = 'login-control';
  const input = document.createElement('input');
  Object.assign(input, { id, type, name, autocomplete, required: true, spellcheck: false });
  control.appendChild(input);
  wrap.appendChild(control);

  const error = document.createElement('p');
  error.className = 'field-error';
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  wrap.appendChild(error);
  input.setAttribute('aria-describedby', error.id);

  const setError = (message) => {
    error.textContent = message || '';
    input.toggleAttribute('aria-invalid', !!message);
  };
  return { wrap, control, input, setError };
}

// Show/hide toggle, so a 40+ audience can check what they typed on a phone.
function passwordToggle(input) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'password-toggle';
  const render = () => {
    const shown = input.type === 'text';
    button.replaceChildren(icon(shown ? 'eye-slash' : 'eye'));
    button.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(shown));
  };
  button.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    render();
    input.focus();
  });
  render();
  return button;
}

// Coach sign-in page, shown when the API answers 401 (server/auth.js). Email and
// password are checked against the project's Supabase Auth users. Resolves once the
// session cookie is set so the caller can reload into the app.
export function renderLogin(container) {
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
    heading.textContent = 'Sign in';
    formSide.appendChild(heading);
    const intro = document.createElement('p');
    intro.className = 'login-intro';
    intro.textContent = 'Use your LvPrime coach account.';
    formSide.appendChild(intro);

    const form = document.createElement('form');
    form.className = 'feedback-form login-form';
    form.noValidate = true;

    const email = field({ label: 'Email', type: 'email', name: 'email', autocomplete: 'username' });
    email.input.inputMode = 'email';
    const password = field({ label: 'Password', type: 'password', name: 'password', autocomplete: 'current-password' });
    password.control.appendChild(passwordToggle(password.input));
    form.append(email.wrap, password.wrap);

    const formError = document.createElement('p');
    formError.className = 'field-error login-form-error';
    formError.setAttribute('role', 'alert');
    form.appendChild(formError);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Sign in';
    form.appendChild(submit);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      email.setError('');
      password.setError('');
      formError.textContent = '';

      // Same checks the server makes, so most mistakes never leave the page.
      let invalid = null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.input.value.trim())) {
        email.setError('Enter a valid email address.');
        invalid ??= email.input;
      }
      if (!password.input.value) {
        password.setError('Enter your password.');
        invalid ??= password.input;
      }
      if (invalid) {
        invalid.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Signing in…';
      try {
        await login(email.input.value.trim(), password.input.value);
        resolve();
      } catch (err) {
        if (err instanceof ApiError && err.status === 422 && err.fields) {
          if (err.fields.email) email.setError(err.fields.email);
          if (err.fields.password) password.setError(err.fields.password);
        } else {
          formError.textContent = err.message || 'Sign-in failed. Try again.';
          password.input.select();
        }
        submit.disabled = false;
        submit.textContent = 'Sign in';
      }
    });

    formSide.appendChild(form);
    container.appendChild(wrap);
    email.input.focus();
  });
}
