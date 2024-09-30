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

Open the [Playwright Inspector](https://playwright.dev/docs/debug#picking-locators).

```bash
npx playwright open https://playground.test/website-server/
```

### Multisite tests

Multisite tests don't work with URLs that include ports.
To run these tests, set the `PLAYWRIGHT_TEST_BASE_URL` environment variable to the base URL of the website server.

You can use [this guide to set up a local Multisite.](https://wordpress.github.io/wordpress-playground/contributing/code#running-a-local-multisite)

```bash
 PLAYWRIGHT_TEST_BASE_URL='https://playground.test/website-server/' npx nx run playground-website:e2e:playwright
```

## Deployment tests

### Setup

Deployment tests require a old and new version of Playground to be built.
This is done by running the following script:

```bash
./deploy_test_setup.sh
```

### Run

```bash
npx nx run playground-website:e2e:playwright:deployment
```
