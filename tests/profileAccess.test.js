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

function mockUser(id, role) {
  return {
    id,
    email: `${role}@example.com`,
    role,
    created_at: '2026-08-19T00:00:00.000Z',
    updated_at: '2026-08-19T00:00:00.000Z',
  };
}

test('profile rejects unauthenticated requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(response.status, 401);
  });
});

test('customer profile is selected using the authenticated user id', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /SELECT id, email, role, created_at, updated_at/);
    assert.match(sql, /WHERE id = \$1/);
    assert.deepEqual(params, [customerId]);
    return { rows: [mockUser(customerId, 'customer')] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me?userId=${otherCustomerId}`, {
        headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.id, customerId);
      assert.equal(body.data.email, 'customer@example.com');
      assert.equal(body.data.password_hash, undefined);
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('customer cannot select another user profile by changing a request id', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.deepEqual(params, [customerId]);
    return { rows: [mockUser(customerId, 'customer')] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me/${otherCustomerId}`, {
        headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
      });
      assert.equal(response.status, 404);
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('admin profile access returns the authenticated admin profile', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.deepEqual(params, [adminId]);
    return { rows: [mockUser(adminId, 'admin')] };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { authorization: `Bearer ${tokenFor(adminId, 'admin')}` },
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.id, adminId);
      assert.equal(body.data.role, 'admin');
    });
  } finally {
    pool.query = originalQuery;
  }
});