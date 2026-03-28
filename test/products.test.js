import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function login(baseUrl, email, password = 'dummy-password') {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  return {
    response,
    body: await response.json()
  };
}

test('GET /products returns only User A products', async () => {
  await withServer(async (baseUrl) => {
    const { body: loginBody } = await login(baseUrl, 'dummy@example.com');

    const response = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      products: [
        {
          id: 'prod_001',
          name: 'Alpha Gadget',
          description: 'Primary demo product for Dummy User'
        },
        {
          id: 'prod_002',
          name: 'Beta Widget',
          description: 'Secondary demo product for Dummy User'
        }
      ]
    });
  });
});

test('GET /products returns only User B products', async () => {
  await withServer(async (baseUrl) => {
    const { body: loginBody } = await login(baseUrl, 'owner-b@example.com');

    const response = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      products: [
        {
          id: 'prod_003',
          name: 'Gamma Tool',
          description: 'Demo product owned by Owner B'
        }
      ]
    });
  });
});

test('GET /products returns empty list for valid user with no products', async () => {
  await withServer(async (baseUrl) => {
    const { body: loginBody } = await login(baseUrl, 'empty@example.com');

    const response = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { products: [] });
  });
});

test('GET /products returns 401 without bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/products`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'unauthorized' });
  });
});

test('GET /products returns 401 for invalid token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'unauthorized' });
  });
});

test('GET /products returns 401 for revoked token', async () => {
  await withServer(async (baseUrl) => {
    const { body: loginBody } = await login(baseUrl, 'dummy@example.com');
    const headers = { Authorization: `Bearer ${loginBody.token}` };

    const logoutResponse = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers
    });

    assert.equal(logoutResponse.status, 200);

    const response = await fetch(`${baseUrl}/products`, { headers });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'unauthorized' });
  });
});
