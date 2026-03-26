import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

test('GET /health returns 200 and status ok', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: 'ok' });

  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});
