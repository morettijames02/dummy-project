import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import swaggerUiDist from 'swagger-ui-dist';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openApiPath = path.join(__dirname, 'openapi.json');
const usersPath = path.join(__dirname, 'data', 'users.json');
const swaggerUiPath = swaggerUiDist.getAbsoluteFSPath();
const openApiDocument = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
const dummyUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendFile(res, filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const extension = path.extname(filePath);
    const contentTypes = {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.map': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.txt': 'text/plain; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'not_found' });
  }
}

function renderDocsHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dummy Project API Docs</title>
    <link rel="stylesheet" href="/docs/swagger-ui.css" />
    <link rel="icon" type="image/png" href="/docs/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="/docs/favicon-16x16.png" sizes="16x16" />
    <style>
      html { box-sizing: border-box; overflow-y: scroll; }
      *, *:before, *:after { box-sizing: inherit; }
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/swagger-ui-bundle.js"></script>
    <script src="/docs/swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout'
      });
    </script>
  </body>
</html>`;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifyPassword(password, passwordRecord) {
  if (!passwordRecord || passwordRecord.algorithm !== 'scrypt') {
    return false;
  }

  const keylen = Number(passwordRecord.keylen);
  const expectedHash = Buffer.from(passwordRecord.hash, 'hex');
  const actualHash = scryptSync(password, passwordRecord.salt, keylen);

  if (expectedHash.length !== actualHash.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHash);
}

function buildPublicUser(user) {
  return {
    email: user.email,
    name: user.name
  };
}

function extractBearerToken(req) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== 'string') {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function createAuthStore() {
  const activeTokens = new Map();

  return {
    issue(user) {
      const token = randomBytes(24).toString('hex');
      activeTokens.set(token, buildPublicUser(user));
      return token;
    },
    get(token) {
      return activeTokens.get(token) ?? null;
    },
    revoke(token) {
      return activeTokens.delete(token);
    }
  };
}

async function handleLogin(req, res, authStore) {
  let rawBody;

  try {
    rawBody = await readRequestBody(req);
  } catch {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }

  let body;

  try {
    body = JSON.parse(rawBody);
  } catch {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }

  if (
    !body ||
    typeof body !== 'object' ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string' ||
    body.email.length === 0 ||
    body.password.length === 0
  ) {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }

  const user = dummyUsers.find((candidate) => candidate.email === body.email);

  if (!user || !verifyPassword(body.password, user.password)) {
    sendJson(res, 401, { error: 'invalid_credentials' });
    return;
  }

  const token = authStore.issue(user);

  sendJson(res, 200, {
    success: true,
    token,
    user: buildPublicUser(user)
  });
}

function authenticateRequest(req, authStore) {
  const token = extractBearerToken(req);

  if (!token) {
    return null;
  }

  const user = authStore.get(token);

  if (!user) {
    return null;
  }

  return { token, user };
}

export function createServer(options = {}) {
  const authStore = options.authStore ?? createAuthStore();

  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/login') {
      await handleLogin(req, res, authStore);
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/me') {
      const session = authenticateRequest(req, authStore);

      if (!session) {
        sendJson(res, 401, { error: 'unauthorized' });
        return;
      }

      sendJson(res, 200, { user: session.user });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/logout') {
      const session = authenticateRequest(req, authStore);

      if (!session) {
        sendJson(res, 401, { error: 'unauthorized' });
        return;
      }

      authStore.revoke(session.token);
      sendJson(res, 200, { success: true });
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/openapi.json') {
      sendJson(res, 200, openApiDocument);
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/docs') {
      sendHtml(res, 200, renderDocsHtml());
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname.startsWith('/docs/')) {
      const assetName = path.basename(requestUrl.pathname);
      const assetPath = path.join(swaggerUiPath, assetName);

      if (!assetPath.startsWith(swaggerUiPath)) {
        sendJson(res, 404, { error: 'not_found' });
        return;
      }

      sendFile(res, assetPath);
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3000;
  const server = createServer();
  server.listen(port, () => {
    console.log(`Dummy Project listening on :${port}`);
  });
}
