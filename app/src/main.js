import { renderOverview } from './views/overview-view.js';
import { renderCustomer } from './views/customer-view.js';
import { renderLogin } from './views/login-view.js';
import { renderChangePassword } from './views/change-password-view.js';
import { renderResetPassword } from './views/reset-password-view.js';
import { getSession, logout, setPasswordRequiredHandler, setUnauthorizedHandler } from './api-client.js';
import { t } from './lib/i18n.js';
import { renderSidebar } from './components/sidebar.js';
import { renderHeaderAccount } from './components/header-account.js';
import { mountChatPanel } from './components/chat-panel.js';
import { renderLangSwitch, translateShell } from './components/lang-switch.js';

const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');

// Before the first view, so nothing renders in the wrong language (src/lib/i18n.js).
translateShell();
renderLangSwitch(document.getElementById('header-lang'));

// Who is signed in: { role: 'coach' | 'customer', slug, mustChangePassword } or null.
// A customer only ever sees their own page, so their route is fixed to it.
let session = null;
const isCustomer = () => session?.role === 'customer';

function currentRoute() {
  if (isCustomer()) return { name: 'customer', slug: session.slug };
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const customerMatch = hash.match(/^\/customers\/([^/]+)\/?$/);
  if (customerMatch) return { name: 'customer', slug: decodeURIComponent(customerMatch[1]) };
  return { name: 'overview' };
}

async function render() {
  const route = currentRoute();
  if (route.name === 'customer') {
    await renderCustomer(app, route.slug, { role: session?.role || 'coach' });
  } else {
    await renderOverview(app);
  }
  // After the view, so an expired session shows one login screen, not two requests racing.
  if (isCustomer()) {
    sidebar.hidden = true;
  } else {
    await renderSidebar(sidebar, route.name === 'customer' ? route.slug : null);
  }
  document.body.classList.toggle('has-sidebar', !sidebar.hidden);
}

// The login screen replaces whatever view was mid-render, so after sign-in reload
// (same hash) instead of resuming the interrupted request into a detached DOM.
setUnauthorizedHandler(async () => {
  await renderLogin(app);
  window.location.reload();
  await new Promise(() => {});
});

// A customer on the coach's default password must replace it before anything else.
setPasswordRequiredHandler(async () => {
  await renderChangePassword(app);
  window.location.reload();
  await new Promise(() => {});
});

window.addEventListener('hashchange', render);

async function start() {
  // The emailed link (#/reset-password?token=…) works signed out and replaces the app.
  const resetMatch = window.location.hash.match(/^#\/reset-password\?token=(.+)$/);
  if (resetMatch) {
    await renderResetPassword(app, decodeURIComponent(resetMatch[1]));
    window.location.hash = '#/';
    window.location.reload();
    return;
  }

  try {
    session = await getSession();
  } catch {
    session = null; // unreachable server: the first view reports it
  }

  if (session?.disabled) {
    // An archived customer: end the session and say why.
    await logout().catch(() => {});
    await renderLogin(app, { notice: t('login.accountDisabled') });
    window.location.reload();
    return;
  }
  if (session?.mustChangePassword) {
    await renderChangePassword(app);
    window.location.reload();
    return;
  }
  if (!session?.authenticated) session = null;

  // Once per page load, after the first view has passed the sign-in gate.
  await render();
  renderHeaderAccount(document.getElementById('header-account'), session);
  // The assistant is for the coach and customers alike (each has their own memory).
  // Signed in by now (the login screen reloads the page), so never on the sign-in page.
  mountChatPanel(document.body);
}

start();
