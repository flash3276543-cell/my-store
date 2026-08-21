const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const pool = require('../src/database/pool');
const config = require('../src/config');

const adminId = '33333333-3333-4333-8333-333333333333';

function adminToken() {
  return jwt.sign({ sub: adminId, email: 'admin@example.com', role: 'admin' }, config.jwtSecret);
}

async function withServer(callback) {
  const server = app.listen(0);
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('admin page is served by the backend', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Assign license/);
    assert.match(html, /\/api\/admin\/licenses/);
  });
});

test('customer listing rejects unauthenticated requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/customers`);
    assert.equal(response.status, 401);
  });
});

test('admin customer listing returns only customer-safe fields', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /WHERE role = 'customer'/);
    assert.doesNotMatch(sql, /password_hash/);
    assert.equal(params, undefined);
    return { rows: [{ id: '11111111-1111-4111-8111-111111111111', email: 'customer@example.com', created_at: '2026-08-19T00:00:00.000Z' }] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/customers`, {
        headers: { authorization: `Bearer ${adminToken()}` },
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].email, 'customer@example.com');
      assert.equal(body.data[0].password_hash, undefined);
    });
  } finally {
    pool.query = originalQuery;
  }
});