const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const pool = require('../src/database/pool');
const config = require('../src/config');

const customerId = '11111111-1111-4111-8111-111111111111';
const otherCustomerId = '22222222-2222-4222-8222-222222222222';
const adminId = '33333333-3333-4333-8333-333333333333';

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

function mockLicense(id, ownerId) {
  return {
    id,
    status: 'ACTIVE',
    installation_id: 'installation-1234',
    activated_at: null,
    last_verified_at: null,
    revoked_at: null,
    product_name: 'Dashboard',
    product_slug: 'productivity-dashboard',
    owner_id: ownerId,
  };
}

test('license list rejects unauthenticated requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/licenses/mine`);
    assert.equal(response.status, 401);
  });
});

test('customer license list returns only the authenticated customer licenses', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /WHERE l\.user_id = \$1/);
    assert.deepEqual(params, [customerId]);
    return { rows: [mockLicense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', customerId)] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/licenses/mine`, {
        headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].owner_id, customerId);
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('customer cannot access another customer license by changing an id', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /WHERE l\.id = \$1 AND l\.user_id = \$2/);
    assert.deepEqual(params, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', customerId]);
    return { rows: [] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/licenses/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/status`,
        { headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` } }
      );
      assert.equal(response.status, 404);
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('admin license list is not restricted to a customer owner', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.doesNotMatch(sql, /WHERE l\.user_id = \$1/);
    assert.deepEqual(params, []);
    return { rows: [mockLicense('cccccccc-cccc-4ccc-8ccc-cccccccccccc', otherCustomerId)] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/licenses/mine`, {
        headers: { authorization: `Bearer ${tokenFor(adminId, 'admin')}` },
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].owner_id, otherCustomerId);
    });
  } finally {
    pool.query = originalQuery;
  }
});