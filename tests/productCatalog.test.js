const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const pool = require('../src/database/pool');
const config = require('../src/config');

const adminId = '33333333-3333-4333-8333-333333333333';
const customerId = '11111111-1111-4111-8111-111111111111';
const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function tokenFor(sub, role) {
  return jwt.sign({ sub, email: `${role}@example.com`, role }, config.jwtSecret);
}

async function withServer(callback) {
  const server = app.listen(0);
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

function product(overrides = {}) {
  return {
    id: productId,
    slug: 'dashboard',
    name: 'Dashboard',
    short_description: 'A dashboard',
    description: null,
    price_cents: 1000,
    currency: 'USD',
    version: '1.0',
    is_active: true,
    image_url: null,
    created_at: '2026-08-19T00:00:00.000Z',
    updated_at: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

test('public listing returns only active products and excludes private file paths', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /WHERE is_active = true/);
    assert.deepEqual(params, undefined);
    assert.doesNotMatch(sql, /file_path/);
    return { rows: [product()] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/products`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].is_active, true);
      assert.equal(body.data[0].file_path, undefined);
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('unauthorized users cannot create products', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/products`, { method: 'POST' });
    assert.equal(response.status, 401);
  });
});

test('customers cannot manage products', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/products`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
    });
    assert.equal(response.status, 403);
  });
});

test('admin can create a product', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO products/);
    assert.deepEqual(params, ['dashboard', 'Dashboard', 'A dashboard', null, 1000, 'USD', '1.0', null]);
    return { rows: [product()] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/products`, {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenFor(adminId, 'admin')}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'dashboard',
          name: 'Dashboard',
          shortDescription: 'A dashboard',
          priceCents: 1000,
          currency: 'usd',
          version: '1.0',
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.data.slug, 'dashboard');
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('admin can update and deactivate a product', async () => {
  const originalQuery = pool.query;
  let call = 0;
  pool.query = async (sql, params) => {
    call += 1;
    if (call === 1) {
      assert.match(sql, /UPDATE products/);
      assert.deepEqual(params, ['Updated dashboard', productId]);
      return { rows: [product({ name: 'Updated dashboard' })] };
    }
    assert.match(sql, /SET is_active = false/);
    assert.deepEqual(params, [productId]);
    return { rows: [product({ is_active: false })] };
  };

  try {
    await withServer(async (baseUrl) => {
      const headers = { authorization: `Bearer ${tokenFor(adminId, 'admin')}`, 'content-type': 'application/json' };
      const update = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
        method: 'PATCH', headers, body: JSON.stringify({ name: 'Updated dashboard' }),
      });
      const deactivate = await fetch(`${baseUrl}/api/admin/products/${productId}/deactivate`, {
        method: 'POST', headers,
      });
      assert.equal(update.status, 200);
      assert.equal(deactivate.status, 200);
      assert.equal((await deactivate.json()).data.is_active, false);
    });
  } finally {
    pool.query = originalQuery;
  }
});