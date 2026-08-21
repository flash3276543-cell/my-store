const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const pool = require('../src/database/pool');
const config = require('../src/config');

const adminId = '33333333-3333-4333-8333-333333333333';
const customerId = '11111111-1111-4111-8111-111111111111';
const otherCustomerId = '22222222-2222-4222-8222-222222222222';
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

async function withStubbedQuery(query, callback) {
  const originalQuery = pool.query;
  pool.query = query;
  try {
    return await callback();
  } finally {
    pool.query = originalQuery;
  }
}

function fileRow(filePath) {
  return { rows: [{ file_path: filePath }] };
}

test('unauthenticated download returns 401', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/products/${productId}/download`);
    assert.equal(response.status, 401);
  });
});

test('customer without a license returns 403', async () => {
  await withStubbedQuery(async () => ({ rows: [] }), async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/products/${productId}/download`, {
        headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
      });
      assert.equal(response.status, 403);
    });
  });
});

test('customer with another customer license returns 403', async () => {
  await withStubbedQuery(async (sql, params) => {
    assert.deepEqual(params, [productId, customerId]);
    return { rows: [] };
  }, async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/products/${productId}/download`, {
        headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
      });
      assert.equal(response.status, 403);
    });
  });
});

test('valid licensed customer receives the product file', async () => {
  const filePath = path.join(os.tmpdir(), `novendigit-download-${Date.now()}.txt`);
  await fs.writeFile(filePath, 'licensed product content');
  try {
    await withStubbedQuery(async () => fileRow(filePath), async () => {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/products/${productId}/download`, {
          headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
        });
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'licensed product content');
      });
    });
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test('admin receives an active product file', async () => {
  const filePath = path.join(os.tmpdir(), `novendigit-admin-download-${Date.now()}.txt`);
  await fs.writeFile(filePath, 'admin product content');
  try {
    await withStubbedQuery(async (sql, params) => {
      assert.deepEqual(params, [productId]);
      return fileRow(filePath);
    }, async () => {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/products/${productId}/download`, {
          headers: { authorization: `Bearer ${tokenFor(adminId, 'admin')}` },
        });
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'admin product content');
      });
    });
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test('missing product file returns 404', async () => {
  await withStubbedQuery(async () => fileRow(path.join(os.tmpdir(), 'novendigit-does-not-exist.bin')), async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/products/${productId}/download`, {
        headers: { authorization: `Bearer ${tokenFor(customerId, 'customer')}` },
      });
      assert.equal(response.status, 404);
    });
  });
});