# Integration Testing and Continuous Deployment Simulation Report

## 1. Introduction
The purpose of this exercise is to verify that the major modules of a backend API work together and to demonstrate how automated checks can be connected to a continuous integration and deployment workflow.

## 2. Application Components
The sample application uses Node.js, Express.js, SQLite, bcryptjs, and JSON Web Tokens. The authentication module registers users and verifies login credentials. The data-management module supports creating, listing, updating, and deleting posts. Middleware validates bearer tokens and enforces record ownership. The database layer stores users and posts with a foreign-key relationship.

## 3. Integration Testing Strategy
The test suite uses Node's built-in test runner and Supertest. Each test receives a fresh in-memory SQLite database. This keeps tests isolated, repeatable, and independent of any local development data.

The tests exercise interactions across HTTP routes, authentication middleware, password hashing, JWT verification, SQL persistence, validation, and authorization. They cover:
- Health check response.
- Registration input validation and password hashing.
- Duplicate email conflict handling.
- Successful login and incorrect-password rejection.
- Missing and malformed bearer-token rejection.
- Authenticated post creation, listing, updating, and deletion.
- Ownership enforcement between two different users.
- Invalid post data and missing-resource responses.
- Pagination metadata and bounded page size.
- SQL-like query input handled as data rather than executable SQL.

## 4. Continuous Integration Workflow
The GitHub Actions workflow is stored at `.github/workflows/ci-cd.yml`. It triggers on pushes and pull requests targeting the main or master branch, and also supports manual execution.

The integration job checks out the repository, configures Node.js 20, installs dependencies, checks JavaScript syntax, and runs the integration suite. A failed test causes the job to fail and prevents the deployment stage from running.

## 5. Simulated Continuous Deployment
The simulated deployment job depends on successful completion of the integration job. For push and manual workflow events, it installs dependencies, prepares a `dist/` build artifact, creates a deployment manifest, and uploads the artifact using GitHub Actions artifact storage.

This demonstrates a gated release process without connecting to a real server or requiring production credentials. The uploaded artifact is evidence of a successful build-and-package stage, not a live production deployment.

## 6. Local Verification Instructions
Run:
1. `npm install`
2. `npm run check`
3. `npm run test:integration`
4. `npm run build`
5. `npm run deploy:simulate`

After the build and simulation commands, inspect `dist/deployment-manifest.json`. For GitHub Actions verification, push the repository to GitHub and inspect the Actions tab. A green integration job should be required before the simulated deployment job can run on a push.

## 7. Security and Reliability Considerations
Passwords are hashed with bcryptjs, authentication uses signed JWTs, SQL statements are parameterized, request payload size is limited, and post operations enforce ownership. Tests use an isolated in-memory database. The example test secret is not suitable for production. A production pipeline should use a committed lockfile and `npm ci`, protected repository secrets, dependency scanning, environment approvals, health checks, and a rollback plan.

## 8. Results and Limitations
The repository contains the integration suite and workflow configuration, but test execution and GitHub Actions status must be verified in the user's environment. No green CI status or successful deployment is claimed before the workflow has actually run. The deployment step is intentionally simulated and produces an artifact rather than deploying to a live hosting provider.

## 9. Conclusion
This task demonstrates how integration tests can verify the complete path between API routes, authentication, database operations, and error handling. It also shows how automated testing can act as a release gate: the simulated deployment stage proceeds only after the integration job succeeds.
