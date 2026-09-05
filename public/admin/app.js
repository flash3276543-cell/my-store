const state = { products: [], customers: [], orders: [] };
const loginRoot = document.querySelector('#loginRoot');
const appRoot = document.querySelector('#appRoot');
const loginForm = document.querySelector('#loginForm');
const loginMessage = document.querySelector('#loginMessage');
const productMessage = document.querySelector('#productMessage');
const productModal = document.querySelector('#productModal');
const productForm = document.querySelector('#productForm');
const customerSelect = document.querySelector('#customerSelect');
const productSelect = document.querySelector('#productSelect');
const licenseForm = document.querySelector('#licenseForm');
const licenseMessage = document.querySelector('#licenseMessage');
const keyBox = document.querySelector('#keyBox');

// --- Storefront settings (now backed by the server, not localStorage) -----
// GET /api/settings is public and read by the storefront on every page
// load; PUT /api/admin/settings is protected by requireAdmin. This is what
// makes color/contact changes show up on every device, not just the
// browser where the admin last changed them.
const DEFAULT_CONTACT = { email: 'namire345729@gmail.com', instagram: 'https://instagram.com/novendigit' };

// Six user-pickable colors. Keys match exactly what the backend
// (src/routes/settings.js) validates and stores under customColors.
const COLOR_FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'border', label: 'Border' },
  { key: 'accent', label: 'Accent' },
  { key: 'text', label: 'Text' },
  { key: 'mutedText', label: 'Muted Text' },
];
const DEFAULT_COLORS = { bg: '#0a0a0a', surface: '#141414', border: '#c5a059', accent: '#c5a059', text: '#ffffff', mutedText: '#a9a6a0' };

let settingsCache = null;

const colorFieldsContainer = document.querySelector('#colorFields');
const colorMessage = document.querySelector('#colorMessage');
const resetColorsButton = document.querySelector('#resetColorsButton');
const contactForm = document.querySelector('#contactForm');
const contactEmail = document.querySelector('#contactEmail');
const contactInstagram = document.querySelector('#contactInstagram');
const contactMessage = document.querySelector('#contactMessage');
const contactPreview = document.querySelector('#contactPreview');

function message(element, text, type = '') {
  element.textContent = text;
  element.className = `message ${type}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Request failed.');
  return body.data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function setSection(section) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${section}Section`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.section === section));
  document.querySelector('#pageTitle').textContent = section[0].toUpperCase() + section.slice(1);
}

function productCard(product) {
  return `<article class="panel product-card"><span class="badge">${product.is_active ? 'Active' : 'Inactive'}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.short_description || product.description || 'No description')}</p><p>v${escapeHtml(product.version)} · ${escapeHtml(product.currency)} ${(product.price_cents / 100).toFixed(2)}</p><div class="card-actions"><button class="button secondary edit-product" data-id="${product.id}">Edit</button>${product.is_active ? `<button class="button danger deactivate-product" data-id="${product.id}">Deactivate</button>` : ''}</div></article>`;
}

function renderProducts() {
  const cards = state.products.map(productCard).join('') || '<p class="empty">No products found.</p>';
  document.querySelector('#productCards').innerHTML = cards;
  document.querySelector('#dashboardProducts').innerHTML = state.products.filter((product) => product.is_active).slice(0, 3).map(productCard).join('') || '<p class="empty">No active products.</p>';
  document.querySelector('#productCount').textContent = state.products.length;
  document.querySelector('#activeProductCount').textContent = state.products.filter((product) => product.is_active).length;
  productSelect.innerHTML = '<option value="">Select an active product</option>' + state.products.filter((product) => product.is_active).map((product) => `<option value="${product.id}">${escapeHtml(product.name)} · v${escapeHtml(product.version)}</option>`).join('');
}

function renderCustomers() {
  document.querySelector('#customerCount').textContent = state.customers.length;
  document.querySelector('#customerRows').innerHTML = state.customers.map((customer) => `<tr><td><strong>${escapeHtml(customer.email)}</strong></td><td>${new Date(customer.created_at).toLocaleDateString()}</td><td><button class="button secondary choose-customer" data-id="${customer.id}">Use customer</button></td></tr>`).join('') || '<tr><td colspan="3">No customers found.</td></tr>';
  customerSelect.innerHTML = '<option value="">Select a customer</option>' + state.customers.map((customer) => `<option value="${customer.id}" data-email="${escapeHtml(customer.email)}">${escapeHtml(customer.email)}</option>`).join('');
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
}

function renderOrders() {
  document.querySelector('#orderRows').innerHTML = state.orders.map((order) => `<tr><td>${escapeHtml(order.id.slice(0, 8))}</td><td>${escapeHtml(order.customer_email)}</td><td>${escapeHtml(order.product_name)}</td><td>${escapeHtml(order.currency)} ${(order.total_cents / 100).toFixed(2)}</td><td>${escapeHtml(capitalize(order.payment_status))}${order.payment_method ? ` · ${escapeHtml(order.payment_method)}` : ''}</td><td>${escapeHtml(capitalize(order.order_status))}</td><td>${new Date(order.created_at).toLocaleDateString()}</td></tr>`).join('') || '<tr><td colspan="7">No orders found.</td></tr>';
}

async function loadData() {
  const [products, customers, orders] = await Promise.all([api('/api/products'), api('/api/admin/customers'), api('/api/admin/orders')]);
  state.products = products;
  state.customers = customers;
  state.orders = orders;
  renderProducts();
  renderCustomers();
  renderOrders();
}

function openProduct(product = null) {
  productModal.classList.remove('hidden');
  document.querySelector('#modalTitle').textContent = product ? 'Edit product' : 'Add product';
  document.querySelector('#editingProductId').value = product?.id || '';
  document.querySelector('#productSlug').value = product?.slug || '';
  document.querySelector('#productName').value = product?.name || '';
  document.querySelector('#productPrice').value = product?.price_cents ?? '';
  document.querySelector('#productCurrency').value = product?.currency || 'USD';
  document.querySelector('#productVersion').value = product?.version || '1.0';
  document.querySelector('#productImage').value = product?.image_url || '';
  document.querySelector('#productShort').value = product?.short_description || '';
  document.querySelector('#productDescription').value = product?.description || '';
}

// --- Small color-math helpers: <input type="color"> only gives a solid
// hex value, but the admin's existing CSS uses translucent rgba() for
// --line (border), so we derive that alpha version from the picked hex
// instead of asking for a 7th "border opacity" field.
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
function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- Storefront custom colors ----------------------------------------------

async function loadSettings() {
  try {
    settingsCache = await api('/api/settings');
  } catch (error) {
    settingsCache = { contactEmail: DEFAULT_CONTACT.email, contactInstagram: DEFAULT_CONTACT.instagram, customColors: DEFAULT_COLORS };
  }
  renderColorFields();
  applyAdminColors(settingsCache?.customColors || DEFAULT_COLORS);
  loadContactForm();
}

function renderColorFields() {
  const colors = settingsCache?.customColors || DEFAULT_COLORS;
  colorFieldsContainer.innerHTML = COLOR_FIELDS.map(
    (field) => `
    <label class="field">${escapeHtml(field.label)}
      <input type="color" class="color-input" data-color-key="${field.key}" value="${escapeHtml(colors[field.key] || DEFAULT_COLORS[field.key])}">
    </label>`
  ).join('');
}

function collectColorFieldValues() {
  const colors = {};
  colorFieldsContainer.querySelectorAll('.color-input').forEach((input) => {
    colors[input.dataset.colorKey] = input.value;
  });
  return colors;
}

// Maps the 6 generic color keys onto the admin panel's OWN CSS variable
// names (defined in the <style> block of admin/index.html), applying
// them live so the admin sees the result immediately, on this same page.
function applyAdminColors(colors) {
  const root = document.documentElement.style;
  root.setProperty('--black', colors.bg);
  root.setProperty('--panel', colors.surface);
  root.setProperty('--panel-2', lighten(colors.surface, 0.08));
  root.setProperty('--line', hexToRgba(colors.border, 0.25));
  root.setProperty('--gold', colors.accent);
  root.setProperty('--gold-light', lighten(colors.accent, 0.25));
  root.setProperty('--cream', colors.text);
  root.setProperty('--muted', colors.mutedText);
}

async function saveColors() {
  const customColors = collectColorFieldValues();
  try {
    settingsCache = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ customColors }) });
    applyAdminColors(settingsCache.customColors);
    message(colorMessage, 'Colors saved. The storefront will use them right away.', 'success');
  } catch (error) {
    message(colorMessage, error.message, 'error');
  }
}

colorFieldsContainer.addEventListener('input', (event) => {
  // Live-preview on the admin panel itself as colors are picked, without
  // saving yet — saving only happens on the explicit Save Colors click.
  if (!event.target.classList.contains('color-input')) return;
  applyAdminColors(collectColorFieldValues());
});

document.querySelector('#saveColorsButton').addEventListener('click', saveColors);

resetColorsButton.addEventListener('click', async () => {
  try {
    settingsCache = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ customColors: DEFAULT_COLORS }) });
    renderColorFields();
    applyAdminColors(settingsCache.customColors);
    message(colorMessage, 'Colors reset to the default Black & Gold palette.', 'success');
  } catch (error) {
    message(colorMessage, error.message, 'error');
  }
});

// --- Storefront contact details --------------------------------------------

function renderContactPreview(email) {
  contactPreview.textContent = `mailto:${email || DEFAULT_CONTACT.email}?subject=طلب مفتاح تفعيل - {product name}`;
}

function loadContactForm() {
  contactEmail.value = settingsCache?.contactEmail || DEFAULT_CONTACT.email;
  contactInstagram.value = settingsCache?.contactInstagram || DEFAULT_CONTACT.instagram;
  renderContactPreview(contactEmail.value);
}

contactEmail.addEventListener('input', () => renderContactPreview(contactEmail.value));

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    settingsCache = await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ contactEmail: contactEmail.value.trim(), contactInstagram: contactInstagram.value.trim() }),
    });
    renderContactPreview(settingsCache.contactEmail);
    message(contactMessage, 'Contact details saved. The storefront will use them right away.', 'success');
  } catch (error) {
    message(contactMessage, error.message, 'error');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  message(loginMessage, 'Signing in...');
  try {
    const data = await api('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#loginEmail').value,
        password: document.querySelector('#loginPassword').value,
      }),
    });
    if (data.user.role !== 'admin') throw new Error('Admin access required.');
    loginRoot.classList.add('hidden');
    appRoot.classList.remove('hidden');
    document.querySelector('#adminIdentity').textContent = data.user.email;
    await loadSettings();
    await loadData();
  } catch (error) {
    message(loginMessage, error.message, 'error');
  }
});

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => setSection(item.dataset.section)));
document.querySelectorAll('[data-section-jump]').forEach((item) => item.addEventListener('click', () => setSection(item.dataset.sectionJump)));
document.querySelector('#addProductButton').addEventListener('click', () => openProduct());
document.querySelector('#closeModal').addEventListener('click', () => productModal.classList.add('hidden'));

document.querySelector('#productCards').addEventListener('click', async (event) => {
  const id = event.target.dataset.id;
  const product = state.products.find((item) => item.id === id);
  if (event.target.classList.contains('edit-product')) openProduct(product);
  if (event.target.classList.contains('deactivate-product')) {
    try {
      await api(`/api/admin/products/${id}/deactivate`, { method: 'POST' });
      await loadData();
      message(productMessage, 'Product deactivated.', 'success');
    } catch (error) {
      message(productMessage, error.message, 'error');
    }
  }
});

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.querySelector('#editingProductId').value;
  const payload = {
    slug: document.querySelector('#productSlug').value,
    name: document.querySelector('#productName').value,
    priceCents: Number(document.querySelector('#productPrice').value),
    currency: document.querySelector('#productCurrency').value,
    version: document.querySelector('#productVersion').value,
    imageUrl: document.querySelector('#productImage').value || null,
    shortDescription: document.querySelector('#productShort').value || null,
    description: document.querySelector('#productDescription').value || null,
  };
  try {
    await api(id ? `/api/admin/products/${id}` : '/api/admin/products', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    productModal.classList.add('hidden');
    await loadData();
    message(productMessage, id ? 'Product updated.' : 'Product created.', 'success');
  } catch (error) {
    message(document.querySelector('#productFormMessage'), error.message, 'error');
  }
});

document.querySelector('#customerRows').addEventListener('click', (event) => {
  if (event.target.classList.contains('choose-customer')) {
    setSection('licenses');
    customerSelect.value = event.target.dataset.id;
  }
});

licenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  keyBox.classList.add('hidden');
  message(licenseMessage, 'Generating...');
  const customer = customerSelect.selectedOptions[0];
  try {
    const data = await api('/api/admin/licenses', { method: 'POST', body: JSON.stringify({ productId: productSelect.value, userId: customerSelect.value, customerEmail: customer.dataset.email }) });
    keyBox.textContent = data.licenseKey;
    keyBox.classList.remove('hidden');
    message(licenseMessage, `License assigned to ${customer.dataset.email}.`, 'success');
  } catch (error) {
    message(licenseMessage, error.message, 'error');
  }
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // Even if the request fails (e.g. offline), still hide the admin UI —
    // the cookie will simply expire naturally on its own.
  }
  appRoot.classList.add('hidden');
  loginRoot.classList.remove('hidden');
});
