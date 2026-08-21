const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const storefrontScript = fs.readFileSync(path.join(__dirname, '../public/storefront/app.js'), 'utf8');
const storefrontMarkup = fs.readFileSync(path.join(__dirname, '../public/storefront/index.html'), 'utf8');

test('auth controls target both forms and route reveals the selected view', () => {
  assert.match(storefrontMarkup, /class="button button-outline small auth-trigger" data-view="login" href="#login">Login/);
  assert.match(storefrontMarkup, /class="button small auth-trigger" data-view="register" href="#register">Register/);
  assert.match(storefrontMarkup, /id="loginView"[^>]*class="account-view page-section narrow hidden"/);
  assert.match(storefrontMarkup, /id="registerView"[^>]*class="account-view page-section narrow hidden"/);
  assert.match(storefrontScript, /document\.querySelectorAll\('\.auth-trigger'\)/);
  assert.match(storefrontScript, /view\.classList\.remove\('hidden'\)/);
  assert.match(storefrontScript, /view\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(storefrontScript, /setButtonBusy\(loginSubmit, true/);
  assert.match(storefrontScript, /setButtonBusy\(registerSubmit, true/);
  assert.match(storefrontScript, /status-shake/);
});

test('auth forms retain their API submit handlers and cookie credentials', () => {
  assert.match(storefrontScript, /api\('\/api\/auth\/login'/);
  assert.match(storefrontScript, /api\('\/api\/auth\/register'/);
  assert.match(storefrontScript, /credentials: 'include'/);
});

test('storefront stylesheet includes motion and reduced-motion protection', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../public/storefront/styles.css'), 'utf8');
  assert.match(styles, /@keyframes view-enter/);
  assert.match(styles, /@keyframes status-shake/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /\.button:active/);
});