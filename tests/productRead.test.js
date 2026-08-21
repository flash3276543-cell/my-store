const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const pool = require('../src/database/pool');

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function withServer(callback) {
  const server = app.listen(0);
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

function publicProduct(overrides = {}) {
  return {
    id: productId,
    slug: 'dashboard',
    name: 'Dashboard',
    short_description: 'A dashboard',
    description: 'A public product description.',
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

async function requestDetail(slug) {
  return withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/products/${slug}`);
    return { response, body: await response.json() };
  });
}

test('public product detail returns an active product without private fields', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /WHERE slug = \$1 AND is_active = true/);
    assert.doesNotMatch(sql, /file_path/);
    assert.deepEqual(params, ['dashboard']);
    return { rows: [publicProduct()] };
  };

  try {
    const { response, body } = await requestDetail('dashboard');
    assert.equal(response.status, 200);
    assert.equal(body.data.slug, 'dashboard');
    assert.equal(body.data.file_path, undefined);
  } finally {
    pool.query = originalQuery;
  }
});

test('missing public product returns 404', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.deepEqual(params, ['missing-product']);
    return { rows: [] };
  };

  try {
    const { response, body } = await requestDetail('missing-product');
    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  } finally {
    pool.query = originalQuery;
  }
});

test('deactivated product is not exposed by public detail lookup', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /is_active = true/);
    assert.deepEqual(params, ['retired-dashboard']);
    return { rows: [] };
  };

  try {
    const { response } = await requestDetail('retired-dashboard');
    assert.equal(response.status, 404);
  } finally {
    pool.query = originalQuery;
  }
});