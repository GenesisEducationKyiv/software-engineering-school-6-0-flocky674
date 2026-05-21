# Testing

## Prerequisites

Install project dependencies once:

```sh
npm ci
```

The integration tests require Docker. The test database is started from scratch with `docker compose` and removed after the test run.

The E2E command installs the required Playwright Chromium browser automatically on the first run.

## Run All Tests

```sh
npm run test:all
```

## Run Tests Separately

Unit tests:

```sh
npm run test:unit
```

Integration tests:

```sh
npm run test:integration
```

E2E tests:

```sh
npm run test:e2e
```

## CI Pipelines

The repository has separate GitHub Actions workflows for each test type:

- `.github/workflows/unit-tests.yml`
- `.github/workflows/integration-tests.yml`
- `.github/workflows/e2e-tests.yml`

Linting is handled separately in `.github/workflows/lint.yml`.
