// Storefront settings (colors + contact) now live on the server via
// GET /api/settings, not localStorage or fixed presets — that's what
// makes them consistent across every visitor's device (desktop, phone,
// tablet), not just the one browser an admin happened to change them
// from. Because this now needs a network round trip, there's a brief
// moment on first paint before colors are applied — see
// loadStoreSettings(), called first thing in boot().
const SETTINGS_DEFAULTS = {
  contactEmail: 'namire345729@gmail.com',
  contactInstagram: 'https://instagram.com/novendigit',
  customColors: { bg: '#0a0a0a', surface: '#141414', border: '#c5a059', accent: '#c5a059', text: '#ffffff', mutedText: '#a9a6a0' },
};
let storeSettings = { ...SETTINGS_DEFAULTS };

// --- Small color-math helpers, used to derive hover/glow/border-alpha
// shades from the six base colors an admin picks, without needing a
// picker for every single shade.
function hexToRgb(hex) {
  const clean = (hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16) || 0;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}
function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

// --- Storefront settings: custom colors + contact ---------------------------

function applyCustomColors(colors) {
  const root = document.documentElement.style;
  root.setProperty('--bg', colors.bg);
  root.setProperty('--surface', colors.surface);
  root.setProperty('--border', hexToRgba(colors.border, 0.35));
  root.setProperty('--border-strong', hexToRgba(colors.border, 0.55));
  root.setProperty('--text', colors.text);
  root.setProperty('--text-muted', colors.mutedText);
  root.setProperty('--text-faint', darken(colors.mutedText, 0.35));
  root.setProperty('--primary', colors.accent);
  root.setProperty('--primary-light', lighten(colors.accent, 0.35));
  root.setProperty('--primary-dim', darken(colors.accent, 0.35));
  root.setProperty('--glow', `0 0 32px ${hexToRgba(colors.accent, 0.22)}`);
}

async function loadStoreSettings() {
  try {
    storeSettings = await api('/api/settings');
  } catch (error) {
    storeSettings = { ...SETTINGS_DEFAULTS };
  }
  applyCustomColors(storeSettings.customColors || SETTINGS_DEFAULTS.customColors);
  applyContactLinks();
}

function applyContactLinks() {
  const emailLink = document.querySelector('#footerEmailLink');
  const instagramLink = document.querySelector('#footerInstagramLink');
  if (emailLink) emailLink.href = `mailto:${storeSettings.contactEmail}`;
  if (instagramLink) instagramLink.href = storeSettings.contactInstagram;
}

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
    stopAccountPolling();
    await openSheet(decodeURIComponent(hash.slice(8)));
    return;
  }
  closeSheet();
  if (hash === 'login') { showView('login'); stopAccountPolling(); return; }
  if (hash === 'register') { showView('register'); stopAccountPolling(); return; }
  if (hash === 'account') {
    showView('account');
    await loadAccount();
    startAccountPolling();
    return;
  }
  showView('store');
  stopAccountPolling();
  if (!state.products.length) await loadProducts();
}

function licenseCardMarkup(license) {
  const keyMarkup = license.licenseKey
    ? `<div class="license-key-row">
         <code class="license-key">${escapeAttribute(license.licenseKey)}</code>
         <button type="button" class="button small secondary copy-key-button" data-key="${escapeAttribute(license.licenseKey)}">Copy</button>
       </div>`
    : `<p class="license-key-unavailable">Key unavailable — contact support to retrieve it.</p>`;
  const revokedNote = license.status === 'REVOKED' ? '<p class="license-revoked-note">This license has been revoked.</p>' : '';
  return `<article class="license-card glass">
    <h3>${escapeAttribute(license.product_name)}</h3>
    ${keyMarkup}
    ${revokedNote}
  </article>`;
}

function renderLicenseList(licenses) {
  const licenseList = document.querySelector('#licenseList');
  const licenseStatus = document.querySelector('#licenseStatus');
  licenseList.innerHTML = licenses.length
    ? licenses.map(licenseCardMarkup).join('')
    : '<p class="empty">You don\u2019t have any licenses yet. Once a product is activated for your account, its key will appear here.</p>';
  setStatus(licenseStatus, licenses.length ? `${licenses.length} license${licenses.length === 1 ? '' : 's'} on file` : '');
}

document.querySelector('#licenseList').addEventListener('click', async (event) => {
  const button = event.target.closest('.copy-key-button');
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.key);
    const original = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => { button.textContent = original; }, 1500);
  } catch (error) {
    button.textContent = 'Copy failed';
    setTimeout(() => { button.textContent = 'Copy'; }, 1500);
  }
});

async function loadAccount() {
  const accountEmail = document.querySelector('#accountEmail');
  const licenseStatus = document.querySelector('#licenseStatus');
  setStatus(licenseStatus, 'Loading your licenses...');
  try {
    const user = await api('/api/auth/me');
    if (!user || !user.email) throw new Error('Not authenticated.');
    state.user = user;
    accountEmail.textContent = state.user.email;
    const licenses = await api('/api/licenses/mine');
    renderLicenseList(licenses);
  } catch (error) {
    state.user = null;
    accountEmail.textContent = '';
    document.querySelector('#licenseList').innerHTML = '';
    setStatus(licenseStatus, 'Your session has expired. Please log in again.', 'error');
    stopAccountPolling();
    forgetGateUnlocked();
    openGate();
  }
}

document.querySelector('#logoutButton').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // Even if the request fails (e.g. offline), still lock the store back
    // up below — the cookie will simply expire naturally on its own.
  }
  state.user = null;
  stopAccountPolling();
  forgetGateUnlocked();
  openGate();
});

// --- Live updates: while "My Account" is open, quietly re-check for new
// licenses every few seconds so a key the admin just issued shows up
// without the customer having to refresh the page. Stops automatically
// the moment the visitor navigates away, and stays silent on transient
// errors (a missed poll shouldn't kick the customer back to the gate).

const ACCOUNT_POLL_INTERVAL_MS = 4000;
let accountPollTimer = null;

function startAccountPolling() {
  stopAccountPolling();
  accountPollTimer = setInterval(async () => {
    if (document.hidden || window.location.hash.slice(1) !== 'account') {
      stopAccountPolling();
      return;
    }
    try {
      const licenses = await api('/api/licenses/mine');
      renderLicenseList(licenses);
    } catch (error) {
      // Silent: a single failed poll isn't worth disrupting the view for.
    }
  }, ACCOUNT_POLL_INTERVAL_MS);
}

function stopAccountPolling() {
  if (accountPollTimer) {
    clearInterval(accountPollTimer);
    accountPollTimer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAccountPolling();
  else if (window.location.hash.slice(1) === 'account') startAccountPolling();
});

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

// --- Welcome gate: the store can't be browsed until the visitor is signed in
//
// IMPORTANT: this gate deliberately does NOT trust a background call to
// /api/auth/me to decide whether to unlock the store. Some backends return
// a "successful" (200) response for anonymous/guest visitors too, which
// would silently open the store for everyone. Instead, the gate only opens
// as the direct result of a login/register form being submitted
// successfully right here, right now. The unlocked state is remembered in
// sessionStorage so the visitor isn't asked again on every reload within
// the same browser tab, but a brand new tab/visit always starts locked.

const GATE_SESSION_KEY = 'nd-gate-unlocked';

function isGateUnlockedThisSession() {
  try {
    return sessionStorage.getItem(GATE_SESSION_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function rememberGateUnlocked() {
  try {
    sessionStorage.setItem(GATE_SESSION_KEY, '1');
  } catch (error) {
    // Private-browsing modes can block sessionStorage; the gate will simply
    // re-appear on the next reload, which is safe (fails closed, not open).
  }
}

function forgetGateUnlocked() {
  try {
    sessionStorage.removeItem(GATE_SESSION_KEY);
  } catch (error) {
    // no-op
  }
}

const welcomeBackdrop = document.querySelector('#welcomeBackdrop');
const welcomeModal = document.querySelector('#welcomeModal');
const gateLoginForm = document.querySelector('#gateLoginForm');
const gateRegisterForm = document.querySelector('#gateRegisterForm');
const gateLoginSubmit = document.querySelector('#gateLoginSubmit');
const gateRegisterSubmit = document.querySelector('#gateRegisterSubmit');

function setGateTab(name) {
  document.querySelectorAll('.welcome-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.gateTab === name));
  gateLoginForm.classList.toggle('hidden', name !== 'login');
  gateRegisterForm.classList.toggle('hidden', name !== 'register');
}

document.querySelectorAll('.welcome-tab').forEach((tab) => {
  tab.addEventListener('click', () => setGateTab(tab.dataset.gateTab));
});

function openGate() {
  forgetGateUnlocked();
  document.body.classList.add('gate-active');
  appShell.setAttribute('inert', '');
  appShell.setAttribute('aria-hidden', 'true');
  welcomeBackdrop.hidden = false;
  welcomeModal.classList.remove('hidden');
}

function closeGate() {
  rememberGateUnlocked();
  document.body.classList.remove('gate-active');
  appShell.removeAttribute('inert');
  appShell.removeAttribute('aria-hidden');
  welcomeBackdrop.hidden = true;
  welcomeModal.classList.add('hidden');
}

async function onGateSuccess() {
  closeGate();
  if (!window.location.hash || window.location.hash === '#') window.location.hash = '#products';
  await route();
}

gateLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#gateLoginStatus');
  setButtonBusy(gateLoginSubmit, true, 'Log in', 'Logging in');
  setStatus(status, 'Logging in...');
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#gateLoginEmail').value, password: document.querySelector('#gateLoginPassword').value }) });
    await onGateSuccess();
  } catch (error) {
    setStatus(status, error.message, 'error');
  } finally {
    setButtonBusy(gateLoginSubmit, false, 'Log in', 'Logging in');
  }
});

gateRegisterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#gateRegisterStatus');
  setButtonBusy(gateRegisterSubmit, true, 'Create account', 'Creating account');
  setStatus(status, 'Creating account...');
  try {
    await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#gateRegisterEmail').value, password: document.querySelector('#gateRegisterPassword').value }) });
    await onGateSuccess();
  } catch (error) {
    setStatus(status, error.message, 'error');
  } finally {
    setButtonBusy(gateRegisterSubmit, false, 'Create account', 'Creating account');
  }
});

async function boot() {
  await loadStoreSettings();
  // Now that /api/auth/me is backed by a real requireAuth check (401 when
  // there's no valid session), it's safe to trust it again: a returning,
  // already-logged-in customer skips the gate immediately instead of
  // having to log in on every new tab.
  try {
    const user = await api('/api/auth/me');
    if (user && user.email) {
      state.user = user;
      rememberGateUnlocked();
      closeGate();
      await route();
      return;
    }
  } catch (error) {
    // Not authenticated (or the request failed) — fall through below.
  }
  if (isGateUnlockedThisSession()) {
    closeGate();
    await route();
    return;
  }
  openGate();
}

boot();
