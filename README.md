# Week 5 – Integration Testing and Continuous Deployment Simulation

## Overview
This repository contains a Node.js/Express backend API, an integration test suite using Node's built-in test runner and Supertest, and a GitHub Actions workflow that runs tests and then creates a simulated deployment artifact.

## Requirements
- Node.js 20 recommended (18+ should work)
- npm
- Git (for the GitHub Actions workflow)

## Run locally
```bash
npm install
npm run check
npm run test:integration
```
Start the API (PowerShell):
```powershell
$env:JWT_SECRET="a-long-local-development-secret"
npm start
```
The server uses a local SQLite database at `data/app.db`.

## CI/CD simulation
The workflow is `.github/workflows/ci-cd.yml`.
- On pushes and pull requests to `main`/`master`, GitHub Actions installs dependencies, checks syntax, and runs integration tests.
- On pushes to `main`/`master` (and manual workflow dispatch), a second job runs only after the integration job succeeds. It builds a `dist/` artifact, writes a deployment manifest, and uploads the artifact.
- This is a simulated deployment only. It does not connect to a cloud host or use production credentials.

## API routes
- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/posts` (authenticated)
- `POST /api/posts` (authenticated)
- `PATCH /api/posts/:id` (authenticated, owner only)
- `DELETE /api/posts/:id` (authenticated, owner only)

## Test coverage
Registration validation and password hashing, duplicate registration, login failure, missing/invalid tokens, post create/list/update/delete flow, user ownership, validation errors, missing resources, pagination, and SQL-like query input.

## Notes
Tests use a fresh in-memory SQLite database for each test, so test cases are isolated and do not modify the local development database. The JWT secret in tests is a test-only value; configure a secure secret for local runtime. For a real deployment, use `npm ci` with a committed lockfile, protected secrets, environment-specific configuration, health checks, rollback strategy, and an actual deployment target.
