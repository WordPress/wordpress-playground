# E2E tests

**Note:** We are currently migrating the e2e tests to [Playwright](https://playwright.dev/) from Cypress.

## Install Playwright

You first need to install Playwright to run the tests below:

```bash
npx playwright install --with-deps
```

Run this after `npm ci` or whenever the Playwright package version changes.
Browser binaries cached for a different Playwright version are not reused.

## Run tests

Runs the end-to-end tests.

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

By default, the local Playwright target starts its own website dev server. To
intentionally attach to a server you already started on port 5400, set:

```bash
PLAYWRIGHT_REUSE_EXISTING_SERVER=1 npx nx run playground-website:e2e:playwright
```

Without `PLAYWRIGHT_REUSE_EXISTING_SERVER=1`, the target fails early if any of
the website dev-server ports are already in use. This prevents a fresh website
server from proxying `remote.html` to a stale server from another branch or
worktree.

Local runs use one Playwright worker because concurrent dev-mode WASM boots
contend heavily for the development server on macOS and can leave a remote
iframe stuck before its worker starts. CI uses its built preview server and
continues to use three workers.

Every collected test runs twice, and failed tests are not retried. This makes
either failed sample fail the command instead of allowing a later retry to hide
an intermittent failure. Playwright records traces during both samples but
deletes successful traces, retaining only the exact failing execution. Expect
the repeated suite to take roughly twice as long as a single sample.

The Playwright-managed development servers direct each Vite HMR client to the
port of the server that injected it. The website proxies remote and
website-extras HTTP traffic through port 5400, but it does not proxy their HMR
WebSockets. Letting Vite first try the HTTP-facing port and then fall back to
ports 4400 or 6400 can trip browser-driver network errors during iframe boot.
The regular `npm run dev` server keeps its existing HMR configuration.

The local Playwright dev servers mock Vite's internal HMR sockets at runtime in
Firefox. Playwright's Firefox network adapter can terminate a test when an HMR
request finishes after the socket-open event. Chromium and WebKit still use the
native Vite HMR sockets. Application WebSockets are also unaffected, and CI
uses the built preview server without this local server guard.

Because Vite HMR is mocked in Firefox, a Firefox page that remains open in UI
or debug mode does not pick up source changes. Reload the page or restart the
test after making a change. Regular `npm run dev` sessions retain native HMR in
Firefox.

On macOS, the local Chromium project uses Playwright's full bundled Chromium;
the headless shell crashes after repeated PHP-WASM contexts. Linux CI keeps its
existing browser choice.

The local macOS WebKit run executes each spec in a separate project and browser.
Repeated PHP-WASM contexts can terminate WebKit's Networking process even
though the current assertion completes, poisoning a later file's navigation.
The partitions share the `webkit` project name, so selecting
`--project=webkit` still runs the full WebKit suite. CI keeps the single WebKit
project.

### Multisite tests

The front-end `My Sites` assertion does not work with a URL that includes an
explicit port, so it is skipped with the default local URL. Other multisite
tests still run. To include that assertion, set `PLAYWRIGHT_TEST_BASE_URL` to a
website-server URL without a port.

You can use [this guide to set up a local Multisite.](https://wordpress.github.io/wordpress-playground/contributing/code#running-a-local-multisite)

```bash
PLAYWRIGHT_TEST_BASE_URL='https://playground.test/website-server/' npx nx run playground-website:e2e:playwright
```

### Direct CURLFile upload test

The route-backed direct CURLFile upload test is skipped on macOS because
Chromium does not expose its nested worker request to Playwright's page route.
Linux CI runs that assertion. The separate CORS proxy upload regression test
continues to run locally on macOS.

## Deployment tests

### Setup

Deployment tests require a old and new version of Playground to be built.
This is done by running the following script:

```bash
npx nx run playground-website:e2e:playwright:prepare-app-deploy-and-offline-mode
```

### Run

The deployment target runs the preparation target automatically before the
spec:

```bash
npx nx run playground-website:e2e:playwright:deployment
```

The screenshot assertions use Linux baselines. On other platforms, the
deployment tests still run their behavioral assertions, but their names include
`[WITHOUT SCREENSHOT COMPARE]` and the test prints a warning instead of
generating local platform snapshots.
