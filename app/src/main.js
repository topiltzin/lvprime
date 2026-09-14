import { renderOverview } from './views/overview-view.js';
import { renderCustomer } from './views/customer-view.js';

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

window.addEventListener('hashchange', render);
render();
