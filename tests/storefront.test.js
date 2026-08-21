const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');

async function withServer(callback) {
  const server = app.listen(0);
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('storefront serves the existing static UI files', async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/store/`);
    const appScript = await fetch(`${baseUrl}/store/app.js`);
    const styles = await fetch(`${baseUrl}/store/styles.css`);
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /NOVENDIGIT Store/);
    assert.match(html, /\/store\/app\.js/);
    assert.equal(appScript.status, 200);
    assert.equal(styles.status, 200);
  });
});

test('existing admin and health routes remain available', async () => {
  await withServer(async (baseUrl) => {
    const admin = await fetch(`${baseUrl}/admin/`);
    const health = await fetch(`${baseUrl}/health`);
    const products = await fetch(`${baseUrl}/api/products`);

    assert.equal(admin.status, 200);
    assert.equal(health.status, 200);
    assert.equal(products.status, 200);
  });
});