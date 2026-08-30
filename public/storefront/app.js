/**
 * NOVENDIGIT — Store frontend (store/app.js)
 * ============================================================
 * Wires the storefront's "welcome" screen and "My Account" section to
 * the backend customer-auth + license endpoints:
 *
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 *   GET  /api/licenses/mine
 *
 * ASSUMPTION: no existing storefront HTML/JS was found in the upload
 * (novendigit-productivity-dashboard.html is the *product* itself —
 * a self-contained, no-account browser app — not the store around it).
 * This file is written to be dropped into a storefront page that
 * contains the element ids listed in `SELECTORS` below. Adjust the
 * ids/markup to match your real storefront template; the logic
 * (auth state, form handling, rendering) stays the same.
 *
 * Sessions are stored in an httpOnly cookie set by the backend
 * (`novendigit_session`), so this file never touches localStorage or
 * handles the JWT directly — every request just needs
 * `credentials: 'include'`.
 * ============================================================
 */

(function () {
  'use strict';

  // ----------------------------------------------------------
  // Config
  // ----------------------------------------------------------
  // Point this at your API origin. If the store is served from the
  // same origin as the API (recommended in production, via a reverse
  // proxy), this can simply be '/api'.
  const API_BASE = window.NOVENDIGIT_API_BASE || 'http://localhost:4000/api';

  // Expected DOM hooks — update these to match your actual storefront markup.
  const SELECTORS = {
    welcomeScreen: '#welcomeScreen',       // the welcome / splash container
    accountSection: '#accountSection',     // the "My Account" container
    loginForm: '#loginForm',
    loginEmail: '#loginEmail',
    loginPassword: '#loginPassword',
    loginError: '#loginError',
    registerForm: '#registerForm',
    registerEmail: '#registerEmail',
    registerPassword: '#registerPassword',
    registerError: '#registerError',
    accountEmail: '#accountEmail',
    licensesList: '#licensesList',
    logoutBtn: '#logoutBtn',
    guestView: '#guestView',               // shown in welcome screen when logged out
    loggedInView: '#loggedInView',          // shown in welcome screen when logged in
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  // ----------------------------------------------------------
  // API helpers
  // ----------------------------------------------------------
  async function apiRequest(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      const message = body?.error?.message || 'Something went wrong. Please try again.';
      const error = new Error(message);
      error.code = body?.error?.code;
      error.status = res.status;
      throw error;
    }
    return body?.data;
  }

  const api = {
    register: (email, password) =>
      apiRequest('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email, password) =>
      apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => apiRequest('/auth/me', { method: 'GET' }),
    myLicenses: () => apiRequest('/licenses/mine', { method: 'GET' }),
  };

  // ----------------------------------------------------------
  // App state / rendering
  // ----------------------------------------------------------
  const state = { user: null, licenses: [] };

  function setError(selector, message) {
    const el = $(selector);
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function renderLoggedOut() {
    toggle(SELECTORS.guestView, true);
    toggle(SELECTORS.loggedInView, false);
    toggle(SELECTORS.accountSection, false);
  }

  function renderLoggedIn() {
    toggle(SELECTORS.guestView, false);
    toggle(SELECTORS.loggedInView, true);
    toggle(SELECTORS.accountSection, true);

    const emailEl = $(SELECTORS.accountEmail);
    if (emailEl && state.user) emailEl.textContent = state.user.email;

    renderLicenses();
  }

  function renderLicenses() {
    const list = $(SELECTORS.licensesList);
    if (!list) return;
    list.innerHTML = '';

    if (state.licenses.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'subtle';
      empty.textContent = 'No licenses linked to your account yet.';
      list.appendChild(empty);
      return;
    }

    state.licenses.forEach((license) => {
      const row = document.createElement('div');
      row.className = 'license-row';
      row.innerHTML = `
        <div class="license-product">${escapeHtml(license.product_name)}</div>
        <div class="license-status license-status--${license.status.toLowerCase()}">${license.status}</div>
        <div class="license-meta subtle mono">
          ${license.activated_at ? 'Activated ' + formatDate(license.activated_at) : 'Not yet activated'}
        </div>
      `;
      list.appendChild(row);
    });
  }

  function toggle(selector, show) {
    const el = $(selector);
    if (!el) return;
    el.style.display = show ? '' : 'none';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  }

  // ----------------------------------------------------------
  // Session bootstrap — checks the existing cookie session (if any)
  // and shows the right welcome-screen / account state automatically.
  // ----------------------------------------------------------
  async function loadSession() {
    try {
      const { user } = await api.me();
      state.user = user;
      const { licenses } = await tryLoadLicenses();
      state.licenses = licenses;
      renderLoggedIn();
    } catch {
      state.user = null;
      state.licenses = [];
      renderLoggedOut();
    }
  }

  async function tryLoadLicenses() {
    try {
      const licenses = await api.myLicenses();
      return { licenses };
    } catch {
      return { licenses: [] };
    }
  }

  // ----------------------------------------------------------
  // Form handlers
  // ----------------------------------------------------------
  function wireRegisterForm() {
    const form = $(SELECTORS.registerForm);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError(SELECTORS.registerError, '');
      const email = $(SELECTORS.registerEmail)?.value.trim();
      const password = $(SELECTORS.registerPassword)?.value;
      try {
        const { user } = await api.register(email, password);
        state.user = user;
        state.licenses = (await tryLoadLicenses()).licenses;
        renderLoggedIn();
        form.reset();
      } catch (err) {
        setError(SELECTORS.registerError, err.message);
      }
    });
  }

  function wireLoginForm() {
    const form = $(SELECTORS.loginForm);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError(SELECTORS.loginError, '');
      const email = $(SELECTORS.loginEmail)?.value.trim();
      const password = $(SELECTORS.loginPassword)?.value;
      try {
        const { user } = await api.login(email, password);
        state.user = user;
        state.licenses = (await tryLoadLicenses()).licenses;
        renderLoggedIn();
        form.reset();
      } catch (err) {
        setError(SELECTORS.loginError, err.message);
      }
    });
  }

  function wireLogout() {
    const btn = $(SELECTORS.logoutBtn);
    if (!btn) return;
    btn.addEventListener('click', () => {
      // The session cookie is httpOnly, so it can't be cleared from JS.
      // Point this at a POST /api/auth/logout endpoint on the backend
      // that clears the cookie server-side (not included in this
      // request's scope) — for now this just resets the local UI state.
      state.user = null;
      state.licenses = [];
      renderLoggedOut();
    });
  }

  // ----------------------------------------------------------
  // Init
  // ----------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    wireRegisterForm();
    wireLoginForm();
    wireLogout();
    loadSession();
  });
})();
