import { login } from '../api-client.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// On-light LvPrime lock-up (specs/011 contracts/header-lockup.md "Sign-in view").
// Same mark geometry and classes as the header SVG in index.html.
function renderBrand() {
  const brand = document.createElement('div');
  brand.className = 'login-brand';

  const mark = document.createElementNS(SVG_NS, 'svg');
  mark.setAttribute('class', 'logo-mark login-mark');
  mark.setAttribute('viewBox', '0 0 64 64');
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('focusable', 'false');
  const tile = document.createElementNS(SVG_NS, 'rect');
  for (const [k, v] of Object.entries({ class: 'mark-tile', x: 1, y: 1, width: 62, height: 62, rx: 14 })) {
    tile.setAttribute(k, v);
  }
  mark.appendChild(tile);
  const strokes = document.createElementNS(SVG_NS, 'g');
  for (const [k, v] of Object.entries({ 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })) {
    strokes.setAttribute(k, v);
  }
  for (const [cls, d] of [['mark-ink', 'M18 16V46H34'], ['mark-ink', 'M25 26L34 46'], ['mark-rise', 'M34 46L47 16']]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', cls);
    path.setAttribute('d', d);
    strokes.appendChild(path);
  }
  mark.appendChild(strokes);
  brand.appendChild(mark);

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

// Coach password screen, shown when the API answers 401 (server/auth.js).
// Resolves once the session cookie is set so the caller can retry its request.
export function renderLogin(container) {
  return new Promise((resolve) => {
    container.removeAttribute('aria-busy');
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'log-session-form-wrap login-wrap';
    wrap.appendChild(renderBrand());

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
