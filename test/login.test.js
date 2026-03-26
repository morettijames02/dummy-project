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

test('POST /login returns 200 for valid dummy credentials', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dummy@example.com', password: 'dummy-password' })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      user: {
        email: 'dummy@example.com',
        name: 'Dummy User'
      }
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
