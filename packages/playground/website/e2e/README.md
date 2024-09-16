# E2E tests

**Note:** We are currently migrating the e2e tests to [Playwright](https://playwright.dev/) from Cypress.

## Run tests

Runs the end-to-end tests.

```bash
npx playwright test
```

Starts the interactive UI mode.

```bash
npx playwright test --ui
```

Runs the tests only on Desktop Chrome.

```bash
npx playwright test --project=chromium
```

Runs the tests in a specific file.

```bash
npx playwright test example
```

Runs the tests in debug mode.

```bash
  npx playwright test --debug
```
