# E2E tests

The website E2E tests use [Playwright](https://playwright.dev/).

## Install Playwright

You first need to install Playwright to run the tests below:

```bash
npx playwright install --with-deps
```

## Run tests

Runs the end-to-end tests. `npx nx e2e playground-website` is an alias for this command.

```bash
npx nx run playground-website:e2e:playwright
```

Starts the interactive UI mode.

```bash
npx nx run playground-website:e2e:playwright -- --ui
```

Runs the tests only on Desktop Chrome.

```bash
npx nx run playground-website:e2e:playwright -- --project=chromium
```

Runs the tests in a specific file.

```bash
npx nx run playground-website:e2e:playwright -- example
```

Runs the tests in debug mode.

```bash
npx nx run playground-website:e2e:playwright -- --debug
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

## CI

The existing Playwright CI jobs run all website E2E tests. ZIP imports create
saved sites, so those tests use the `@storage` tag and run in the single-worker
storage lane. ZIP exports and query API tests run in the regular shards.

After building the app, run both groups against the preview server:

```bash
npx nx run playground-website:e2e:playwright:ci
```

The CI preview server binds to port 80 for WordPress multisite support.

## Deployment tests

### Setup

Deployment tests require a old and new version of Playground to be built.
This is done by running the following script:

```bash
npx nx run playground-website:e2e:playwright:prepare-app-deploy-and-offline-mode
```

### Run

```bash
npx nx run playground-website:e2e:playwright:deployment
```
