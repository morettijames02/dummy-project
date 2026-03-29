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

async function login(baseUrl, credentials = { email: 'dummy@example.com', password: 'dummy-password' }) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });

  return {
    response,
    body: await response.json()
  };
}

test('POST /login returns 200 for valid dummy credentials with bearer token', async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await login(baseUrl);

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(typeof body.token, 'string');
    assert.ok(body.token.length >= 32);
    assert.deepEqual(body.user, {
      id: 'user-1',
      email: 'dummy@example.com',
      name: 'Dummy User'
    });
  });
});

test('POST /login returns 401 for unknown email', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.com', password: 'dummy-password' })
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'invalid_credentials' });
  });
});

test('POST /login returns 401 for wrong password', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dummy@example.com', password: 'wrong-password' })
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'invalid_credentials' });
  });
});

test('POST /login returns 400 when required fields are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dummy@example.com' })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: 'invalid_request' });
  });
});

test('POST /login returns 400 for invalid JSON', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":"dummy@example.com"'
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: 'invalid_request' });
  });
});

test('GET /me returns authenticated user for valid bearer token', async () => {
  await withServer(async (baseUrl) => {
    const { body: loginBody } = await login(baseUrl);

    const response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      user: {
        id: 'user-1',
        email: 'dummy@example.com',
        name: 'Dummy User'
      }
    });
  });
});

test('GET /me returns 401 for invalid token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'unauthorized' });
  });
});

test('POST /logout returns 401 without auth', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/logout`, {
      method: 'POST'
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'unauthorized' });
  });
});

test('POST /logout revokes token and invalidates subsequent GET /me', async () => {
  await withServer(async (baseUrl) => {
    const { body: loginBody } = await login(baseUrl);
    const authHeader = { Authorization: `Bearer ${loginBody.token}` };

    const logoutResponse = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: authHeader
    });
    const logoutBody = await logoutResponse.json();

    assert.equal(logoutResponse.status, 200);
    assert.deepEqual(logoutBody, { success: true });

    const meResponse = await fetch(`${baseUrl}/me`, {
      headers: authHeader
    });
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 401);
    assert.deepEqual(meBody, { error: 'unauthorized' });
  });
});
