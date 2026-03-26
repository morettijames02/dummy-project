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

- Health check: `http://localhost:3000/health`
- OpenAPI spec: `http://localhost:3000/openapi.json`
- Swagger UI docs: `http://localhost:3000/docs`

## Verify locally

1. Start the app with `npm start`
2. Open `http://localhost:3000/docs` in a browser to view Swagger UI
3. Open `http://localhost:3000/openapi.json` to inspect the raw OpenAPI document
4. Open `http://localhost:3000/health` to verify the live health endpoint returns `{ "status": "ok" }`

## Run tests

```bash
npm test
```
