const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const pool = require('../src/database/pool');
const config = require('../src/config');

const adminId = '33333333-3333-4333-8333-333333333333';
const customerId = '11111111-1111-4111-8111-111111111111';
const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

function requestBody(overrides = {}) {
  return {
    productId,
    customerEmail: 'customer@example.com',
    userId: customerId,
    ...overrides,
  };
}

test('manual license creation requires an authenticated admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/licenses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody()),
    });
    assert.equal(response.status, 401);
  });
});

test('admin manual sale assigns a license to an existing customer and active product', async () => {
  const originalQuery = pool.query;
  let call = 0;
  pool.query = async (sql, params) => {
    call += 1;
    if (call === 1) {
      assert.match(sql, /products WHERE id = \$1 AND is_active = true/);
      assert.deepEqual(params, [productId]);
      return { rows: [{ id: productId }] };
    }
    if (call === 2) {
      assert.match(sql, /SELECT id, email, role FROM users WHERE id = \$1/);
      assert.deepEqual(params, [customerId]);
      return { rows: [{ id: customerId, email: 'customer@example.com', role: 'customer' }] };
    }
    assert.match(sql, /INSERT INTO licenses/);
    assert.deepEqual(params.slice(0, 4), [productId, null, customerId, 'customer@example.com']);
    return {
      rows: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', product_id: productId, order_id: null, status: 'UNACTIVATED', created_at: '2026-08-19T00:00:00.000Z' }],
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/licenses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify(requestBody()),
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.data.license.status, 'UNACTIVATED');
      assert.match(body.data.licenseKey, /^NVD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('manual license creation rejects inactive products', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.deepEqual(params, [productId]);
    return { rows: [] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/licenses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify(requestBody()),
      });
      const body = await response.json();
      assert.equal(response.status, 404);
      assert.equal(body.error.code, 'PRODUCT_NOT_FOUND_OR_INACTIVE');
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('manual license creation rejects non-customer accounts', async () => {
  const originalQuery = pool.query;
  let call = 0;
  pool.query = async (sql, params) => {
    call += 1;
    if (call === 1) return { rows: [{ id: productId }] };
    assert.deepEqual(params, [customerId]);
    return { rows: [{ id: customerId, email: 'admin@example.com', role: 'admin' }] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/licenses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify(requestBody()),
      });
      const body = await response.json();
      assert.equal(response.status, 404);
      assert.equal(body.error.code, 'CUSTOMER_NOT_FOUND');
    });
  } finally {
    pool.query = originalQuery;
  }
});