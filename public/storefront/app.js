// Theme bootstrap — reads a stored theme name so the admin panel can control
// the palette later just by writing to localStorage('nd-theme') or by
// rendering the page with a data-theme attribute already set server-side.
(function applyStoredTheme() {
  const stored = localStorage.getItem('nd-theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);
})();

const state = { products: [], user: null };

const views = {
  store: document.querySelector('#products'),
  login: document.querySelector('#loginView'),
  register: document.querySelector('#registerView'),
  account: document.querySelector('#accountView'),
};
const productGrid = document.querySelector('#productGrid');
const storeStatus = document.querySelector('#storeStatus');
const loginSubmit = document.querySelector('#loginSubmit');
const registerSubmit = document.querySelector('#registerSubmit');

const sheet = document.querySelector('#productSheet');
const sheetBackdrop = document.querySelector('#sheetBackdrop');
const sheetContent = document.querySelector('#sheetContent');
const sheetClose = document.querySelector('#sheetClose');

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

function escapeAttribute(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function imageMarkup(url, alt, className = 'product-image') {
  if (url) return `<img class="${className}" src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}">`;
  return `<div class="${className} placeholder" aria-hidden="true">N</div>`;
}

function productCard(product) {
  return `<article class="product-card glass" data-slug="${escapeAttribute(product.slug)}">
    ${imageMarkup(product.image_url, product.name)}
    <div class="product-card-body">
      <h3>${escapeAttribute(product.name)}</h3>
      <span class="product-price">${escapeAttribute(product.currency)} ${Number(product.price_cents / 100).toFixed(2)}</span>
    </div>
  </article>`;
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

// --- Product bottom sheet -------------------------------------------------

function contactMarkup(productName) {
  const subject = encodeURIComponent(`طلب مفتاح تفعيل - ${productName}`);
  return `<div class="sheet-contact">
    <p class="sheet-contact-label">Contact us to get your key</p>
    <a class="contact-row" href="mailto:namire345729@gmail.com?subject=${subject}"><span class="bn-icon">✉</span> Email</a>
    <a class="contact-row" href="https://instagram.com/novendigit" target="_blank" rel="noreferrer"><span class="bn-icon">◎</span> Instagram</a>
  </div>`;
}

function renderSheet(product) {
  sheetContent.innerHTML = `
    ${imageMarkup(product.image_url, product.name, 'sheet-media')}
    <h2 id="sheetTitle">${escapeAttribute(product.name)}</h2>
    <div class="sheet-meta">
      <span>v${escapeAttribute(product.version)}</span>
      <span class="product-price">${escapeAttribute(product.currency)} ${Number(product.price_cents / 100).toFixed(2)}</span>
    </div>
    <button id="requestCodeButton" class="button sheet-cta" type="button">طلب كود التفعيل</button>
    <div id="sheetContactSlot"></div>
  `;
  document.querySelector('#requestCodeButton').addEventListener('click', (event) => {
    event.currentTarget.remove();
    document.querySelector('#sheetContactSlot').innerHTML = contactMarkup(product.name);
  });
}

async function openSheet(slug) {
  sheet.hidden = false;
  sheetBackdrop.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    sheet.classList.add('open');
    sheetBackdrop.classList.add('open');
  });
  sheetContent.innerHTML = '<p class="empty">Loading...</p>';
  try {
    let product = state.products.find((item) => item.slug === slug);
    if (!product) product = await api(`/api/products/${encodeURIComponent(slug)}`);
    renderSheet(product);
  } catch (error) {
    sheetContent.innerHTML = `<p class="empty">${escapeAttribute(error.message)}</p>`;
  }
}

function closeSheet() {
  sheet.classList.remove('open');
  sheetBackdrop.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  setTimeout(() => { sheet.hidden = true; sheetBackdrop.hidden = true; }, 220);
  if (window.location.hash.startsWith('#product/')) window.location.hash = '#products';
}

productGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.product-card');
  if (!card) return;
  window.location.hash = `#product/${encodeURIComponent(card.dataset.slug)}`;
});
sheetClose.addEventListener('click', closeSheet);
sheetBackdrop.addEventListener('click', closeSheet);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !sheet.hidden) closeSheet();
});

// --- View routing ----------------------------------------------------------

function setActiveNav(name) {
  document.querySelectorAll('.nav-link, .bottom-nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === name);
  });
}

function showView(name) {
  Object.values(views).forEach((view) => view.classList.add('hidden'));
  const view = views[name] || views.store;
  view.classList.remove('hidden');
  setActiveNav(name === 'store' ? 'products' : name);
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
  const hash = window.location.hash.slice(1) || 'products';
  if (hash.startsWith('product/')) {
    showView('store');
    await openSheet(decodeURIComponent(hash.slice(8)));
    return;
  }
  closeSheet();
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
    licenseList.innerHTML = licenses.length ? licenses.map((license) => `<article class="license-card glass"><div><h3>${escapeAttribute(license.product_name)}</h3><p>${escapeAttribute(license.product_slug)}</p></div><span class="license-state">${escapeAttribute(license.status)}</span></article>`).join('') : '<p class="empty">No licenses are assigned to this account yet.</p>';
    setStatus(licenseStatus, `${licenses.length} license${licenses.length === 1 ? '' : 's'}`);
  } catch (error) {
    state.user = null;
    accountEmail.textContent = '';
    licenseList.innerHTML = '';
    setStatus(licenseStatus, 'Please log in to view your account.', 'error');
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
route();
