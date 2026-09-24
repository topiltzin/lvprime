import { renderOverview } from './views/overview-view.js';
import { renderCustomer } from './views/customer-view.js';
import { renderLogin } from './views/login-view.js';
import { setUnauthorizedHandler } from './api-client.js';
import { renderSidebar } from './components/sidebar.js';

const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');

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
  // After the view, so an expired session shows one login screen, not two requests racing.
  await renderSidebar(sidebar, route.name === 'customer' ? route.slug : null);
  document.body.classList.toggle('has-sidebar', !sidebar.hidden);
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
