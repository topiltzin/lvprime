import { renderOverview } from './views/overview-view.js';
import { renderCustomer } from './views/customer-view.js';
import { renderLogin } from './views/login-view.js';
import { setUnauthorizedHandler } from './api-client.js';

const app = document.getElementById('app');

function currentRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const customerMatch = hash.match(/^\/customers\/([^/]+)\/?$/);
  if (customerMatch) return { name: 'customer', slug: decodeURIComponent(customerMatch[1]) };
  return { name: 'overview' };
}

async function render() {
  const route = currentRoute();
  if (route.name === 'customer') {
    await renderCustomer(app, route.slug);
  } else {
    await renderOverview(app);
  }
}

// The login screen replaces whatever view was mid-render, so after sign-in reload
// (same hash) instead of resuming the interrupted request into a detached DOM.
setUnauthorizedHandler(async () => {
  await renderLogin(app);
  window.location.reload();
  await new Promise(() => {});
});

window.addEventListener('hashchange', render);
render();
