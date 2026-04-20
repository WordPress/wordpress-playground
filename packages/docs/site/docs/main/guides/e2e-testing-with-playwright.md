---
title: E2E Testing with Playwright and WordPress Playground
slug: /guides/e2e-testing-with-playwright
description: Set up end-to-end tests for WordPress plugins and themes using Playwright and the Playground CLI.
sidebar_class_name: navbar-build-item
---

End-to-end testing verifies that your WordPress plugin or theme works correctly from a user's perspective — clicking buttons, filling forms, and navigating pages in a real browser. This guide shows how to combine [Playwright](https://playwright.dev/) with the [WordPress Playground CLI](/developers/local-development/wp-playground-cli) to write reliable E2E tests without Docker, databases, or manual setup.

:::info
This guide assumes familiarity with WordPress plugin or theme development. For an introduction to using Playground in your development workflow, see [WordPress Playground for Plugin Developers](/guides/for-plugin-developers). For Blueprint configuration details, see [Blueprints Getting Started](/blueprints/getting-started).
:::

## Prerequisites

- **Node.js 20+** and up
- A WordPress plugin/theme or an entire WordPress site to test
- **Recommended:** enable the `@typescript-eslint/no-floating-promises` ESLint rule to catch missing `await` on async Playwright calls

## Project setup

### Install dependencies

From your plugin or theme root directory:

```bash
npm init -y
npm install --save-dev @playwright/test @wp-playground/cli
npx playwright install chromium
```

This installs Playwright as the test runner, the Playground CLI for creating WordPress instances, and the Chromium browser for test execution.

### Configure Playwright

Create a `playwright.config.ts` file in your project root:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
});
```

WordPress Playground needs more time to start than a typical web app. The 120-second test timeout and 30-second assertion timeout account for WordPress boot time and page loads. Setting `workers: 1` prevents port conflicts when multiple tests share a Playground server.

:::tip[Using baseURL with dynamic ports]
By default, Playground will sign the port `9400`. If you want to select a different port, pass `port: [NEW_PORT_NUMBER]` in the `runCLI` options to select a different port:

```typescript
const cli = await runCLI({ command: "server", port: 9500, blueprint });
```

Then add `baseURL: "http://localhost:9500"` to the `use` section above. Note that `testMatch` defaults to `**/*.spec.ts` — customize it if your test files use a different naming pattern.
:::

:::tip
The WordPress Playground project uses even longer timeouts (300s test, 60s assertion) for its own tests. Start with the values above and increase if your CI environment is slower.
:::

### First test file

Create `tests/e2e/plugin.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { runCLI } from "@wp-playground/cli";

let cli: Awaited<ReturnType<typeof runCLI>>;

test.beforeAll(async () => {
  cli = await runCLI({
    command: "server",
    blueprint: {
      preferredVersions: { php: "8.3", wp: "latest" },
      login: true,
    },
  });
});

test.afterAll(async () => {
  await cli?.server?.close();
});

test("WordPress dashboard loads", async ({ page }) => {
  await page.goto(`${cli.serverUrl}/wp-admin/`);
  // WordPress core admin elements lack ARIA roles — CSS selectors are acceptable here
  await expect(page.locator("#wpbody-content")).toBeVisible();
  await expect(page).toHaveTitle(/Dashboard/);
});
```

Run the test:

```bash
npx playwright test
```

## Choosing locators

Playwright provides several ways to find elements on the page. Prefer locators that reflect how users see the page, falling back to CSS selectors only when necessary.

**Locator priority** (most to least preferred):

1. `page.getByRole()` — buttons, headings, links, form controls
2. `page.getByLabel()` — form inputs with associated labels
3. `page.getByText()` — visible text content
4. `page.getByTestId()` — elements with `data-testid` attributes you add to your plugin
5. `page.locator()` — CSS or XPath selectors as a last resort

### WordPress-specific guidance

In the WordPress admin, some core elements (admin bar, meta boxes) rely on IDs and CSS classes rather than ARIA roles. However, many elements work well with semantic locators. This means:

- **Use semantic locators** for buttons, headings, links, form fields, and admin menu items — WordPress renders standard `<button>`, `<input>`, `<a>`, and `<h1>` elements that `getByRole` and `getByLabel` can find.
- **Use `data-testid`** for your own plugin markup — you control the HTML, so add testable attributes.
- **Use CSS selectors** for WordPress core layout elements like `#wpadminbar` or `#wpbody-content` — these lack ARIA alternatives.

### Same element, three approaches

```typescript
// ✅ Preferred: semantic locator (works because WP renders a real <button>)
await page.getByRole("button", { name: "Save Changes" }).click();

// ⚠️ Acceptable: test ID you added to your plugin markup
await page.getByTestId("save-settings").click();

// ❌ Avoid: brittle CSS selector tied to WordPress markup
await page.locator("#submit").click();
```

:::tip[Generate locators automatically]
Run `npx playwright codegen localhost:9400/wp-admin/` to open a browser and record interactions. Playwright generates locator code as you click, helping you discover which semantic locators work for each element.
:::

## Auto-waiting and web-first assertions

Playwright locators wait automatically for elements to appear, become visible, and become actionable. You do not need manual `waitForSelector` calls in most cases.

### Web-first assertions

Web-first assertions auto-retry until the condition passes or the timeout expires. Always prefer them over manual checks:

```typescript
// ✅ Web-first assertion (auto-retries until visible or timeout)
await expect(page.getByText("Settings saved")).toBeVisible();

// ❌ Manual check (no retry — flaky if the element appears after a delay)
expect(await page.getByText("Settings saved").isVisible()).toBe(true);
```

### Soft assertions

Use `expect.soft()` to check multiple things on one page without stopping at the first failure. All failures appear in the test report:

```typescript
await expect.soft(page.getByLabel("API Key")).toHaveValue("test-key-123");
await expect.soft(page.getByText("Settings saved")).toBeVisible();
await expect.soft(page.getByRole("heading", { level: 1 })).toContainText("Settings");
```

## Writing tests

### Starting a Playground server

The `runCLI` function starts a local Playground server and returns an object with `serverUrl` (the URL string) and `server` (the HTTP server instance). Pass a Blueprint to configure the WordPress instance:

```typescript
const cli = await runCLI({
  command: "server",
  blueprint: {
    preferredVersions: { php: "8.3", wp: "latest" },
    login: true,
    steps: [
      {
        step: "installPlugin",
        pluginData: {
          resource: "wordpress.org/plugins",
          slug: "woocommerce",
        },
      },
    ],
  },
});
```

#### Server lifecycle: shared vs. per-test

**Shared server (`beforeAll`/`afterAll`)** — one Playground instance serves all tests in a describe block. Faster, but tests can affect each other:

```typescript
test.describe("Plugin settings", () => {
  test.beforeAll(async () => {
    cli = await runCLI({ command: "server", blueprint });
  });
  test.afterAll(async () => {
    await cli?.server?.close();
  });
  // Tests share the same WordPress instance
});
```

**Per-test server (`beforeEach`/`afterEach`)** — each test gets a fresh instance. Slower, but fully isolated:

```typescript
test.beforeEach(async () => {
  cli = await runCLI({ command: "server", blueprint });
});
test.afterEach(async () => {
  await cli?.server?.close();
});
```

Use shared servers when tests only read state (checking pages render). Use per-test servers when tests modify state (creating posts, changing settings).

### Using Blueprints as test fixtures

Blueprints define the WordPress state each test scenario needs. Here are common patterns:

#### Installing a plugin from wordpress.org

```typescript
const blueprint = {
  preferredVersions: { php: "8.3", wp: "latest" },
  login: true,
  steps: [
    {
      step: "installPlugin",
      pluginData: {
        resource: "wordpress.org/plugins",
        slug: "contact-form-7",
      },
    },
  ],
};
```

#### Installing a local plugin

Mount your local plugin directory into the Playground instance:

```typescript
const cli = await runCLI({
  command: "server",
  mount: {
    "./": "/wordpress/wp-content/plugins/my-plugin",
  },
  blueprint: {
    preferredVersions: { php: "8.3", wp: "latest" },
    login: true,
    steps: [
      {
        step: "activatePlugin",
        pluginPath: "my-plugin/my-plugin.php",
      },
    ],
  },
});
```

This maps your current directory to the plugin path inside WordPress, then activates the plugin. Changes to your local files are reflected immediately. The user can set the `autoMount` property to identify plugins and themes, but the `mount` property will provide more control to the user to set different folders in the project.

#### Setting options and creating content

```typescript
const blueprint = {
  login: true,
  steps: [
    {
      step: "setSiteOptions",
      options: {
        blogname: "Test Site",
        permalink_structure: "/%postname%/",
      },
    },
    {
      step: "runPHP",
      code: `<?php
        require '/wordpress/wp-load.php';
        wp_insert_post([
          'post_title' => 'Test Post',
          'post_content' => '<!-- wp:paragraph --><p>Hello World</p><!-- /wp:paragraph -->',
          'post_status' => 'publish',
        ]);
      `,
    },
  ],
};
```

:::tip
Use the [Playground Step Library](https://akirk.github.io/playground-step-library/) or [Pootle Playground](https://pootleplayground.com/) to prototype your Blueprint configuration visually before adding it to your test code.
:::

### Testing WordPress admin pages

Navigate to admin pages and interact with the WordPress UI:

```typescript
test("plugin settings page saves options", async ({ page }) => {
  await page.goto(`${cli.serverUrl}/wp-admin/options-general.php?page=my-plugin`);

  await page.getByLabel("API Key").fill("test-key-123");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByText("Settings saved")).toBeVisible();
  await expect(page.getByLabel("API Key")).toHaveValue("test-key-123");
});
```

#### Handling common admin UI elements

```typescript
// Dismiss WordPress admin notices (WP adds aria-label to dismiss buttons)
await page.getByRole("button", { name: "Dismiss this notice" }).first().click();

// Wait for admin bar to load — no ARIA role available, use locator
await page.locator("#wpadminbar").waitFor();

// Navigate via admin menu
await page.getByRole("link", { name: "My Plugin" }).first().click();
```

### Testing the front end

```typescript
test("plugin shortcode renders on front end", async ({ page }) => {
  // Navigate to a page with the shortcode
  await page.goto(`${cli.serverUrl}/?p=2`);

  // Recommend: add data-testid="my-plugin-widget" to your plugin markup
  await expect(page.getByTestId("my-plugin-widget")).toBeVisible();
  await expect(page.getByTestId("my-plugin-widget")).toContainText(
    "Expected content"
  );
  // Or use CSS if you don't control the markup:
  // await expect(page.locator(".my-plugin-widget")).toBeVisible();
});

test("theme displays post correctly", async ({ page }) => {
  await page.goto(`${cli.serverUrl}/test-post/`);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Test Post");
  await expect(page.getByText("Hello World", { exact: true })).toBeVisible();
});
```

## Page Object Model pattern

The Page Object Model (POM) wraps page interactions into reusable classes. This reduces duplication and makes tests easier to maintain when your plugin UI changes.

```typescript
// tests/e2e/pages/plugin-settings.ts
import { type Page, type Locator, expect } from "@playwright/test";

export class PluginSettingsPage {
  readonly page: Page;
  readonly apiKeyInput: Locator;
  readonly saveButton: Locator;
  readonly successNotice: Locator;

  constructor(page: Page) {
    this.page = page;
    this.apiKeyInput = page.getByLabel("API Key");
    this.saveButton = page.getByRole("button", { name: "Save Changes" });
    this.successNotice = page.getByText("Settings saved");
  }

  async goto(baseUrl: string) {
    await this.page.goto(
      `${baseUrl}/wp-admin/options-general.php?page=my-plugin`
    );
  }

  async setApiKey(key: string) {
    await this.apiKeyInput.fill(key);
    await this.saveButton.click();
  }

  async expectSaved() {
    await expect(this.successNotice).toBeVisible();
  }
}
```

Use the POM in tests:

```typescript
import { PluginSettingsPage } from "./pages/plugin-settings";

test("save plugin settings", async ({ page }) => {
  const settings = new PluginSettingsPage(page);
  await settings.goto(cli.serverUrl);
  await settings.setApiKey("test-key-123");
  await settings.expectSaved();
});
```

The Playground project uses this pattern with a `WebsitePage` class that provides methods like `goto()`, `wordpress()`, and `getSiteTitle()` — encapsulating navigation and WordPress-specific interactions.

## Testing across PHP and WordPress versions

Parameterized tests cover multiple version combinations without duplicating test code:

```typescript
const versionMatrix = [
  { php: "8.1", wp: "6.5" },
  { php: "8.2", wp: "6.7" },
  { php: "8.3", wp: "latest" },
];

for (const { php, wp } of versionMatrix) {
  test.describe(`PHP ${php} + WP ${wp}`, () => {
    let versionCli: Awaited<ReturnType<typeof runCLI>>;

    test.beforeAll(async () => {
      versionCli = await runCLI({
        command: "server",
        blueprint: {
          preferredVersions: { php, wp },
          login: true,
          steps: [
            {
              step: "activatePlugin",
              pluginPath: "my-plugin/my-plugin.php",
            },
          ],
        },
      });
    });

    test("admin page loads without errors", async ({ page }) => {
      await page.goto(
        `${versionCli.serverUrl}/wp-admin/options-general.php?page=my-plugin`
      );
      // WordPress core elements use CSS selectors — no ARIA roles available
      await expect(page.locator(".error")).not.toBeVisible();
      await expect(page.locator("#wpbody-content")).toBeVisible();
    });

    test("front-end output renders", async ({ page }) => {
      await page.goto(versionCli.serverUrl);
      await expect(page.getByTestId("my-plugin-widget")).toBeVisible();
    });

    test.afterAll(async () => {
      await versionCli?.server?.close();
    });
  });
}
```

The `preferredVersions` property in the Blueprint controls which PHP and WordPress versions the Playground instance uses. Supported ranges: PHP 7.4–8.5, WordPress 6.3–6.8+, plus `latest`, `nightly`, and `beta`. For type-safe PHP version values, use the `SupportedPHPVersion` type from `@php-wasm/universal`.

## Running tests in CI/CD

### GitHub Actions

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        id: playwright-cache
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ hashFiles('package-lock.json') }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install chromium --with-deps

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

This workflow installs dependencies, downloads Chromium, runs the tests, and uploads the HTML report as an artifact. The `--with-deps` flag installs system libraries Chromium needs on Ubuntu.

:::tip[Sharding for faster CI]
Split tests across multiple CI jobs with Playwright's built-in sharding:

```bash
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

Create three parallel jobs in your workflow matrix, each running a different shard. This reduces total CI time proportionally.
:::

:::info
For manual PR testing alongside automated E2E tests, see [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview).
:::

## Troubleshooting

**Timeout errors** — Increase `timeout` in `playwright.config.ts`. WordPress boot time varies by environment. CI runners often need 120–180 seconds.

**Port conflicts** — Let Playground auto-assign ports. Do not hardcode port numbers in your configuration. The `serverUrl` property returns the correct URL.

**Browser not found** — Run `npx playwright install chromium` to download the browser binary. On CI, add `--with-deps` for system libraries.

**WordPress not loading** — Check your Blueprint syntax against the [Blueprint schema](https://playground.wordpress.net/blueprint-schema.json). Invalid steps fail silently in some cases.

**Tests pass locally but fail in CI** — CI runners have less memory and CPU. Increase timeouts, reduce parallel workers, and ensure `workers: 1` in the config.

## Debugging tests

When a test fails, Playwright provides several tools to investigate:

**Playwright Inspector** — step through tests interactively with a built-in debugger:

```bash
npx playwright test --debug
```

**Trace viewer** — inspect a timeline of actions, DOM snapshots, and network requests from a failed test. The `trace: "on-first-retry"` setting in the config above captures traces automatically:

```bash
npx playwright show-trace test-results/plugin-spec-ts/trace.zip
```

**UI mode** — run tests in a visual interface where you can watch, filter, and re-run them:

```bash
npx playwright test --ui
```

**Screenshot on failure** — the `screenshot: "only-on-failure"` setting in the config saves a screenshot whenever a test fails. Find screenshots in the `test-results/` directory.

:::tip
Combine `--debug` with a specific test file to focus your investigation: `npx playwright test tests/e2e/settings.spec.ts --debug`
:::

## Next steps

- [WordPress Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference
- [Playwright documentation](https://playwright.dev/docs/intro) — test writing guide and API reference
- [Blueprints reference](/blueprints/steps) — all available Blueprint steps
- [Adding PR Preview Buttons](/guides/github-action-pr-preview) — combine automated tests with manual PR previews
