# Dummy Project

Integration test repo for the multi-agent delivery workflow.

## Install

```bash
npm install
```

## Run the app

```bash
npm start
```

The app starts on `http://localhost:3000` by default.

## Available routes

- Health check: `GET http://localhost:3000/health`
- Login: `POST http://localhost:3000/login`
- Current user: `GET http://localhost:3000/me`
- Product list: `GET http://localhost:3000/products`
- Logout: `POST http://localhost:3000/logout`
- OpenAPI spec: `GET http://localhost:3000/openapi.json`
- Swagger UI docs: `GET http://localhost:3000/docs`

## Demo users

All demo users use the same password: `dummy-password`

- `dummy@example.com` → has two products
- `owner-b@example.com` → has one product
- `empty@example.com` → has no products

## Verify locally

1. Start the app with `npm start`
2. Open `http://localhost:3000/docs` in a browser to view Swagger UI
3. Open `http://localhost:3000/openapi.json` to inspect the raw OpenAPI document
4. Verify health:

```bash
curl http://localhost:3000/health
```

5. Log in and capture the bearer token:

```bash
TOKEN=$(curl -s http://localhost:3000/login \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"dummy@example.com","password":"dummy-password"}' \
  | node -e "process.stdin.on('data', d => process.stdout.write(JSON.parse(d).token))")
```

6. Call the protected routes with the token:

```bash
curl http://localhost:3000/me \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN"
```

7. Log out with the same token:

```bash
curl http://localhost:3000/logout \
  -X POST \
  -H "Authorization: Bearer $TOKEN"
```

8. Confirm the token is now invalidated for protected routes:

```bash
curl -i http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN"
```

The final request should return `401` with `{ "error": "unauthorized" }`.

## Run tests

```bash
npm test
```
