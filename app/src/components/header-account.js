import { getSession, logout } from '../api-client.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';

// Header account area: the signed-in user's role and email and a Sign out button. When the
// gate is disabled (local dev) it keeps the static "Coach workspace" label.
export async function renderHeaderAccount(el, knownSession = null) {
  let session = knownSession;
  if (!session) {
    try {
      session = await getSession();
    } catch {
      return;
    }
  }
  if (!session.email) return;

  el.innerHTML = '';
  const email = document.createElement('span');
  email.className = 'header-email';
  email.textContent = session.email;
  email.title = session.email;
  if (session.role) {
    const role = document.createElement('span');
    role.className = 'header-role';
    role.textContent = t(`role.${session.role}`);
    el.appendChild(role);
  }
  el.appendChild(email);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sign-out-button';
  button.appendChild(icon('sign-out'));
  const label = document.createElement('span');
  label.textContent = t('account.signOut');
  button.appendChild(label);
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await logout();
    } finally {
      // Back to the overview; its first request answers 401 and shows sign-in.
      window.location.hash = '#/';
      window.location.reload();
    }
  });
  el.appendChild(button);
}
