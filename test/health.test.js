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

test('GET /health returns 200 and status ok', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok' });
  });
});

test('GET /openapi.json returns OpenAPI JSON with auth and product routes', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/openapi.json`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.openapi, '3.0.3');
    assert.ok(body.paths);
    assert.ok(body.paths['/health']);
    assert.ok(body.paths['/login']);
    assert.ok(body.paths['/me']);
    assert.ok(body.paths['/products']);
    assert.ok(body.paths['/logout']);
    assert.equal(body.components.securitySchemes.bearerAuth.scheme, 'bearer');
  });
});

test('GET /docs returns Swagger UI HTML', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/docs`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(html, /swagger-ui/i);
    assert.match(html, /openapi\.json/);
    assert.match(html, /SwaggerUIBundle/);
  });
});
