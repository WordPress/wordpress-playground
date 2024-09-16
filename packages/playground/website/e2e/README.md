# E2E tests

**Note:** We are currently migrating the e2e tests to [Playwright](https://playwright.dev/) from Cypress.

## Run tests

Runs the end-to-end tests.

```bash
npx nx run playground-website:e2e:playwright
```

Starts the interactive UI mode.

```bash
npx nx run playground-website:e2e:playwright --ui
```

Runs the tests only on Desktop Chrome.

```bash
npx nx run playground-website:e2e:playwright --project=chromium
```

Runs the tests in a specific file.

```bash
npx nx run playground-website:e2e:playwright example
```

Runs the tests in debug mode.

```bash
npx nx run playground-website:e2e:playwright --debug
```
