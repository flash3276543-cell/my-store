// Storefront settings
const SETTINGS_DEFAULTS = { theme: '', contactEmail: 'namire345729@gmail.com', contactInstagram: 'https://instagram.com/novendigit' };
let storeSettings = { ...SETTINGS_DEFAULTS };

const state = { products: [], user: null };

const views = {
  store: document.querySelector('#products'),
  login: document.querySelector('#loginView'),
  register: document.querySelector('#registerView'),
  account: document.querySelector('#accountView'),
};
const appShell = document.querySelector('#appShell');
const productGrid = document.querySelector('#productGrid');
const storeStatus = document.querySelector('#storeStatus');
const loginSubmit = document.querySelector('#loginSubmit');
const registerSubmit = document.querySelector('#registerSubmit');

const sheet = document.querySelector('#productSheet');
const sheetBackdrop = document.querySelector('#sheetBackdrop');
const sheetContent = document.querySelector('#sheetContent');
const sheetClose = document.querySelector('#sheetClose');

// --- Storefront settings: theme + contact ----------------------------------

async function loadStoreSettings() {
  try {
    storeSettings = await api('/api/settings');
  } catch (error) {
    storeSettings = { ...SETTINGS_DEFAULTS };
  }
  if (storeSettings && storeSettings.theme) document.documentElement.setAttribute('data-theme', storeSettings.theme);
  else document.documentElement.removeAttribute('data-theme');
  applyContactLinks();
}

function applyContactLinks() {
  const emailLink = document.querySelector('#footerEmailLink');
  const instagramLink = document.querySelector('#footerInstagramLink');
  if (emailLink) emailLink.href = `mailto:${storeSettings.contactEmail}`;
  if (instagramLink) instagramLink.href = storeSettings.contactInstagram;
}

function setStatus(element, message, type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `status ${type}`;
  if (type === 'error') {
    element.classList.remove('status-shake');
    requestAnimationFrame(() => element.classList.add('status-shake'));
  }
}

function setButtonBusy(button, busy, idleLabel, busyLabel) {
  if (!button) return;
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
  if (!response.ok) throw new Error(body.error?.message || body.message || 'Something went wrong.');
  return body.data !== undefined ? body.data : body;
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
    const res = await api('/api/products');
    state.products = Array.isArray(res) ? res : (res.products || []);
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
    <a class="contact-row" href="mailto:${escapeAttribute(storeSettings.contactEmail)}?subject=${subject}"><span class="bn-icon">✉</span> Email</a>
    <a class="contact-row" href="${escapeAttribute(storeSettings.contactInstagram)}" target="_blank" rel="noreferrer"><span class="bn-icon">◎</span> Instagram</a>
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

if (productGrid) {
  productGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.product-card');
    if (!card) return;
    window.location.hash = `#product/${encodeURIComponent(card.dataset.slug)}`;
  });
}
if (sheetClose) sheetClose.addEventListener('click', closeSheet);
if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSheet);
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
  Object.values(views).forEach((view) => view && view.classList.add('hidden'));
  const view = views[name] || views.store;
  if (view) {
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
    if (state.user) {
      await loadAccount();
    } else {
      openGate();
    }
    return;
  }
  showView('store');
  if (!state.products.length) await loadProducts();
}

function formatLicenseStatus(status) {
  const labels = { active: 'Active', revoked: 'Revoked', suspended: 'Suspended', pending: 'Pending' };
  if (labels[status]) return labels[status];
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
}

async function loadAccount() {
  const accountEmail = document.querySelector('#accountEmail');
  const licenseList = document.querySelector('#licenseList');
  const licenseStatus = document.querySelector('#licenseStatus');
  setStatus(licenseStatus, 'Loading your licenses...');

  try {
    const res = await api('/api/auth/me');
    const user = res.data || res.user || res;
    
    if (!user || (!user.email && !user.id)) {
      throw new Error('Not authenticated.');
    }
    
    state.user = user;
    closeGate();

    if (accountEmail) accountEmail.textContent = state.user.email || 'Customer';

    try {
      const lRes = await api('/api/licenses/mine');
      const licenses = Array.isArray(lRes) ? lRes : (lRes.data || lRes.licenses || []);
      
      if (licenseList) {
        licenseList.innerHTML = licenses.length
          ? licenses.map((license) => {
              const productName = license.product_name || license.productName || license.product_slug || 'License Key';
              const keyText = license.license_key || license.key || license.code || 'No Key Displayed';
              const statusText = formatLicenseStatus(license.status || 'active');

              return `
                <article class="license-card glass" style="display:flex; justify-content:space-between; align-items:center; padding: 12px 16px; margin-bottom:10px; border-radius:8px; background: rgba(255,255,255,0.05);">
                  <div>
                    <h3 style="margin:0 0 4px 0; font-size:1rem;">${escapeAttribute(productName)}</h3>
                    <code style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size:0.9rem; color:#4ade80; user-select:all;">${escapeAttribute(keyText)}</code>
                  </div>
                  <span class="license-state license-state-${escapeAttribute(license.status)}" style="font-size:0.85rem; padding: 2px 8px; border-radius: 4px;">${escapeAttribute(statusText)}</span>
                </article>
              `;
            }).join('')
          : '<p class="empty">You don’t have any licenses yet.</p>';
      }
      setStatus(licenseStatus, licenses.length ? `${licenses.length} license(s) on file` : '');
    } catch (licErr) {
      if (licenseList) licenseList.innerHTML = '<p class="empty">No active licenses found.</p>';
      setStatus(licenseStatus, '');
    }

  } catch (error) {
    state.user = null;
    if (accountEmail) accountEmail.textContent = '';
    if (licenseList) licenseList.innerHTML = '';
    setStatus(licenseStatus, 'Your session has expired. Please log in again.', 'error');
    openGate();
  }
}

// --- Welcome gate logic ----------------------------------------------------

const welcomeBackdrop = document.querySelector('#welcomeBackdrop');
const welcomeModal = document.querySelector('#welcomeModal');
const gateLoginForm = document.querySelector('#gateLoginForm');
const gateRegisterForm = document.querySelector('#gateRegisterForm');
const gateLoginSubmit = document.querySelector('#gateLoginSubmit');
const gateRegisterSubmit = document.querySelector('#gateRegisterSubmit');

function setGateTab(name) {
  document.querySelectorAll('.welcome-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.gateTab === name));
  if (gateLoginForm) gateLoginForm.classList.toggle('hidden', name !== 'login');
  if (gateRegisterForm) gateRegisterForm.classList.toggle('hidden', name !== 'register');
}

document.querySelectorAll('.welcome-tab').forEach((tab) => {
  tab.addEventListener('click', () => setGateTab(tab.dataset.gateTab));
});

function openGate() {
  document.body.classList.add('gate-active');
  if (appShell) {
    appShell.setAttribute('inert', '');
    appShell.setAttribute('aria-hidden', 'true');
  }
  if (welcomeBackdrop) welcomeBackdrop.hidden = false;
  if (welcomeModal) welcomeModal.classList.remove('hidden');
}

function closeGate() {
  document.body.classList.remove('gate-active');
  if (appShell) {
    appShell.removeAttribute('inert');
    appShell.removeAttribute('aria-hidden');
  }
  if (welcomeBackdrop) welcomeBackdrop.hidden = true;
  if (welcomeModal) welcomeModal.classList.add('hidden');
}

async function onGateSuccess() {
  closeGate();
  if (!window.location.hash || window.location.hash === '#') window.location.hash = '#products';
  await route();
}

if (gateLoginForm) {
  gateLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#gateLoginStatus');
    setButtonBusy(gateLoginSubmit, true, 'Log in', 'Logging in');
    setStatus(status, 'Logging in...');
    try {
      await api('/api/auth/login', { 
        method: 'POST', 
        body: JSON.stringify({ 
          email: document.querySelector('#gateLoginEmail').value, 
          password: document.querySelector('#gateLoginPassword').value 
        }) 
      });
      await onGateSuccess();
    } catch (error) {
      setStatus(status, error.message, 'error');
    } finally {
      setButtonBusy(gateLoginSubmit, false, 'Log in', 'Logging in');
    }
  });
}

if (gateRegisterForm) {
  gateRegisterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#gateRegisterStatus');
    setButtonBusy(gateRegisterSubmit, true, 'Create account', 'Creating account');
    setStatus(status, 'Creating account...');
    try {
      await api('/api/auth/register', { 
        method: 'POST', 
        body: JSON.stringify({ 
          email: document.querySelector('#gateRegisterEmail').value, 
          password: document.querySelector('#gateRegisterPassword').value 
        }) 
      });
      await onGateSuccess();
    } catch (error) {
      setStatus(status, error.message, 'error');
    } finally {
      setButtonBusy(gateRegisterSubmit, false, 'Create account', 'Creating account');
    }
  });
}

document.querySelectorAll('.auth-trigger').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openView(trigger.dataset.view);
  });
});

window.addEventListener('hashchange', route);

// --- Boot System -----------------------------------------------------------

async function boot() {
  await loadStoreSettings();
  
  try {
    const res = await api('/api/auth/me');
    const user = res.data || res.user || res;
    
    if (user && (user.email || user.id)) {
      state.user = user;
      closeGate();
    } else {
      state.user = null;
      openGate();
    }
  } catch (e) {
    state.user = null;
    openGate();
  }

  if (!state.products.length) await loadProducts();
}

// بدء التشغيل
boot();
