const state = { products: [], user: null };

const views = {
  store: document.querySelector('#products'),
  detail: document.querySelector('#detailView'),
  login: document.querySelector('#loginView'),
  register: document.querySelector('#registerView'),
  account: document.querySelector('#accountView'),
};
const productGrid = document.querySelector('#productGrid');
const storeStatus = document.querySelector('#storeStatus');
const detail = document.querySelector('#productDetail');
const authNav = document.querySelector('#authNav');
const menuButton = document.querySelector('#menuButton');
const mainNav = document.querySelector('#mainNav');
const loginSubmit = document.querySelector('#loginSubmit');
const registerSubmit = document.querySelector('#registerSubmit');

function setStatus(element, message, type = '') {
  element.textContent = message;
  element.className = `status ${type}`;
  if (type === 'error') {
    element.classList.remove('status-shake');
    requestAnimationFrame(() => element.classList.add('status-shake'));
  }
}

function setButtonBusy(button, busy, idleLabel, busyLabel) {
  button.disabled = busy;
  button.classList.toggle('is-loading', busy);
  button.textContent = busy ? busyLabel : idleLabel;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Something went wrong.');
  return body.data;
}

function imageMarkup(url, alt) {
  if (url) return `<img class="product-image" src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}">`;
  return '<div class="product-image placeholder" aria-hidden="true">N</div>';
}

function escapeAttribute(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function productCard(product) {
  const description = product.short_description || product.description || 'A NOVENDIGIT digital tool.';
  return `<article class="product-card"><a class="card-link" href="#product/${encodeURIComponent(product.slug)}">${imageMarkup(product.image_url, product.name)}<div class="product-card-body"><h3>${escapeAttribute(product.name)}</h3><p class="product-description">${escapeAttribute(description)}</p><div class="product-meta"><span>v${escapeAttribute(product.version)}</span><span class="product-price">${escapeAttribute(product.currency)} ${Number(product.price_cents / 100).toFixed(2)}</span></div></div></a></article>`;
}

async function loadProducts() {
  setStatus(storeStatus, 'Loading products...');
  try {
    state.products = await api('/api/products');
    productGrid.innerHTML = state.products.length ? state.products.map(productCard).join('') : '<p class="empty">No products are available right now.</p>';
    setStatus(storeStatus, `${state.products.length} available product${state.products.length === 1 ? '' : 's'}`);
  } catch (error) {
    productGrid.innerHTML = '<p class="empty">Products could not be loaded.</p>';
    setStatus(storeStatus, error.message, 'error');
  }
}

async function showProduct(slug) {
  detail.innerHTML = '<p class="empty">Loading product...</p>';
  try {
    const product = await api(`/api/products/${encodeURIComponent(slug)}`);
    detail.innerHTML = `<div>${product.image_url ? `<img class="detail-media" src="${escapeAttribute(product.image_url)}" alt="${escapeAttribute(product.name)}">` : '<div class="detail-media placeholder" aria-hidden="true">N</div>'}</div><div class="detail-copy"><p class="eyebrow">NOVENDIGIT product</p><h1 id="detailTitle">${escapeAttribute(product.name)}</h1><p class="detail-description">${escapeAttribute(product.description || product.short_description || 'A NOVENDIGIT digital tool.')}</p><dl class="detail-facts"><div><dt>Version</dt><dd>${escapeAttribute(product.version)}</dd></div><div><dt>Price</dt><dd>${escapeAttribute(product.currency)} ${Number(product.price_cents / 100).toFixed(2)}</dd></div></dl><p class="lede">Purchases are arranged manually. Contact the administrator to purchase this product and receive your license key in person.</p></div>`;
  } catch (error) {
    detail.innerHTML = `<p class="empty">${escapeAttribute(error.message)}</p>`;
  }
}

function showView(name) {
  Object.values(views).forEach((view) => view.classList.add('hidden'));
  const view = views[name] || views.store;
  view.classList.remove('hidden');
  const detailView = document.querySelector('#detailView');
  if (name === 'detail') detailView.classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${name === 'detail' ? 'products' : name}`));
  if (mainNav) mainNav.classList.remove('open');
  if (name === 'login' || name === 'register' || name === 'account') {
    view.classList.remove('view-enter');
    requestAnimationFrame(() => {
      view.classList.add('view-enter');
      view.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

function openView(name) {
  window.location.hash = `#${name}`;
  route();
}

async function route() {
  const hash = window.location.hash.slice(1) || 'store';
  if (hash.startsWith('product/')) {
    Object.values(views).forEach((view) => view.classList.add('hidden'));
    document.querySelector('#detailView').classList.remove('hidden');
    await showProduct(decodeURIComponent(hash.slice(8)));
    return;
  }
  if (hash === 'login') { showView('login'); return; }
  if (hash === 'register') { showView('register'); return; }
  if (hash === 'account') {
    showView('account');
    await loadAccount();
    return;
  }
  showView('store');
  if (!state.products.length) await loadProducts();
}

async function loadAccount() {
  const accountEmail = document.querySelector('#accountEmail');
  const licenseList = document.querySelector('#licenseList');
  const licenseStatus = document.querySelector('#licenseStatus');
  setStatus(licenseStatus, 'Loading licenses...');
  try {
    state.user = await api('/api/auth/me');
    accountEmail.textContent = `${state.user.email} · ${state.user.role}`;
    const licenses = await api('/api/licenses/mine');
    licenseList.innerHTML = licenses.length ? licenses.map((license) => `<article class="license-card"><div><h3>${escapeAttribute(license.product_name)}</h3><p>Version access · ${escapeAttribute(license.product_slug)}</p></div><span class="license-state">${escapeAttribute(license.status)}</span></article>`).join('') : '<p class="empty">No licenses are assigned to this account yet.</p>';
    setStatus(licenseStatus, `${licenses.length} license${licenses.length === 1 ? '' : 's'}`);
    if (authNav) {
      authNav.textContent = 'Account';
      authNav.href = '#account';
    }
  } catch (error) {
    state.user = null;
    accountEmail.textContent = '';
    licenseList.innerHTML = '';
    setStatus(licenseStatus, 'Please log in to view your account.', 'error');
    if (authNav) {
      authNav.textContent = 'Login / Register';
      authNav.href = '#login';
    }
  }
}

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#loginStatus');
  setButtonBusy(loginSubmit, true, 'Log in', 'Logging in');
  setStatus(status, 'Logging in...');
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#loginEmail').value, password: document.querySelector('#loginPassword').value }) });
    window.location.hash = '#account';
  } catch (error) {
    setStatus(status, error.message, 'error');
    setButtonBusy(loginSubmit, false, 'Log in', 'Logging in');
  }
});

document.querySelector('#registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#registerStatus');
  setButtonBusy(registerSubmit, true, 'Create account', 'Creating account');
  setStatus(status, 'Creating account...');
  try {
    await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#registerEmail').value, password: document.querySelector('#registerPassword').value }) });
    window.location.hash = '#account';
  } catch (error) {
    setStatus(status, error.message, 'error');
    setButtonBusy(registerSubmit, false, 'Create account', 'Creating account');
  }
});

document.querySelectorAll('.auth-trigger').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openView(trigger.dataset.view);
  });
});

window.addEventListener('hashchange', route);
if (menuButton) menuButton.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
loadProducts();
route();
