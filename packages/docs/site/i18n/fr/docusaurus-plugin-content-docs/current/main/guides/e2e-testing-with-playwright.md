---
title: Tests E2E avec Playwright et WordPress Playground
slug: /guides/e2e-testing-with-playwright
description: Configurez des tests de bout en bout pour vos plugins et thèmes WordPress avec Playwright et la CLI Playground.
sidebar_class_name: navbar-build-item
---

<!--
End-to-end testing verifies that your WordPress plugin or theme works correctly from a user's perspective — clicking buttons, filling forms, and navigating pages in a real browser. This guide shows how to combine [Playwright](https://playwright.dev/) with the [WordPress Playground CLI](/developers/local-development/wp-playground-cli) to write reliable E2E tests without Docker, databases, or manual setup.
-->

Les tests de bout en bout vérifient que votre extension ou thème WordPress fonctionne correctement du point de vue de l'utilisateur — cliquer sur des boutons, remplir des formulaires et naviguer sur les pages dans un véritable navigateur. Ce guide montre comment combiner [Playwright](https://playwright.dev/) avec la [CLI WordPress Playground](/developers/local-development/wp-playground-cli) pour écrire des tests E2E fiables sans Docker, bases de données ou configuration manuelle.

<!--
:::info
This guide assumes familiarity with WordPress plugin or theme development. For an introduction to using Playground in your development workflow, see [WordPress Playground for Plugin Developers](/guides/for-plugin-developers). For Blueprint configuration details, see [Blueprints Getting Started](/blueprints/getting-started).
:::
-->

:::info
Ce guide suppose une familiarité avec le développement d’extensions ou de thèmes WordPress. Pour une introduction à l'utilisation de Playground dans votre flux de développement, consultez [WordPress Playground pour développeurs de plugins](/guides/for-plugin-developers). Pour les détails de configuration des Blueprints, voir [Démarrage avec Blueprints](/blueprints/getting-started).
:::

<!--
## Prerequisites

- **Node.js 20+** and up
- A WordPress plugin/theme or an entire WordPress site to test
- **Recommended:** enable the `@typescript-eslint/no-floating-promises` ESLint rule to catch missing `await` on async Playwright calls
-->

## Prérequis

- **Node.js 20+** et supérieur
- Une extension/thème WordPress ou un site WordPress complet à tester
- **Recommandé :** activez la règle ESLint `@typescript-eslint/no-floating-promises` pour détecter les `await` manquants dans les appels asynchrones Playwright

<!--
## Project setup

### Install dependencies

From your plugin or theme root directory:
-->

## Configuration du projet

### Installer les dépendances

Depuis le répertoire racine de votre extension ou thème :

```bash
npm init -y
npm install --save-dev @playwright/test @wp-playground/cli
npx playwright install chromium
```

<!--
This installs Playwright as the test runner, the Playground CLI for creating WordPress instances, and the Chromium browser for test execution.

### Configure Playwright

Create a `playwright.config.ts` file in your project root:
-->

Cela installe Playwright comme exécuteur de tests, la CLI Playground pour créer des instances WordPress et le navigateur Chromium pour l'exécution des tests.

### Configurer Playwright

Créez un fichier `playwright.config.ts` à la racine de votre projet :

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

<!--
WordPress Playground needs more time to start than a typical web app. The 120-second test timeout and 30-second assertion timeout account for WordPress boot time and page loads. Setting `workers: 1` prevents port conflicts when multiple tests share a Playground server.
-->

WordPress Playground a besoin de plus de temps pour démarrer qu'une application web typique. Le délai d'attente des tests de 120 secondes et le délai d'assertion de 30 secondes tiennent compte du temps de démarrage de WordPress et du chargement des pages. La valeur `workers: 1` évite les conflits de ports lorsque plusieurs tests partagent un serveur Playground.

<!--
:::tip[Using baseURL with dynamic ports]
By default, Playground will sign the port `9400`. If you want to select a different port, pass `port: [NEW_PORT_NUMBER]` in the `runCLI` options to select a different port:

```typescript
const cli = await runCLI({ command: "server", port: 9500, blueprint });
```

Then add `baseURL: "http://localhost:9500"` to the `use` section above. Note that `testMatch` defaults to `**/*.spec.ts` — customize it if your test files use a different naming pattern.
:::
-->

:::tip[Utiliser baseURL avec des ports dynamiques]
Par défaut, Playground utilisera le port `9400`. Si vous souhaitez sélectionner un port différent, passez `port: [NOUVEAU_NUMÉRO_DE_PORT]` dans les options de `runCLI` pour sélectionner un port différent :

```typescript
const cli = await runCLI({ command: "server", port: 9500, blueprint });
```

Puis ajoutez `baseURL: "http://localhost:9500"` à la section `use` ci-dessus. Notez que `testMatch` utilise par défaut `**/*.spec.ts` — personnalisez-le si vos fichiers de test utilisent un autre schéma de nommage.
:::

<!--
:::tip
The WordPress Playground project uses even longer timeouts (300s test, 60s assertion) for its own tests. Start with the values above and increase if your CI environment is slower.
:::
-->

:::tip
Le projet WordPress Playground utilise des délais encore plus longs (300s pour les tests, 60s pour les assertions) pour ses propres tests. Commencez avec les valeurs ci-dessus et augmentez-les si votre environnement CI est plus lent.
:::

<!--
### First test file

Create `tests/e2e/plugin.spec.ts`:
-->

### Premier fichier de test

Créez `tests/e2e/plugin.spec.ts` :

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

<!--
Run the test:

```bash
npx playwright test
```
-->

Exécutez le test :

```bash
npx playwright test
```

<!--
## Choosing locators

Playwright provides several ways to find elements on the page. Prefer locators that reflect how users see the page, falling back to CSS selectors only when necessary.

**Locator priority** (most to least preferred):

1. `page.getByRole()` — buttons, headings, links, form controls
2. `page.getByLabel()` — form inputs with associated labels
3. `page.getByText()` — visible text content
4. `page.getByTestId()` — elements with `data-testid` attributes you add to your plugin
5. `page.locator()` — CSS or XPath selectors as a last resort
-->

## Choisir les localisateurs

Playwright offre plusieurs façons de trouver les éléments sur la page. Préférez les localisateurs qui reflètent la façon dont les utilisateurs voient la page, en utilisant les sélecteurs CSS uniquement en dernier recours.

**Priorité des localisateurs** (du plus au moins recommandé) :

1. `page.getByRole()` — boutons, titres, liens, contrôles de formulaire
2. `page.getByLabel()` — champs de formulaire avec étiquettes associées
3. `page.getByText()` — contenu texte visible
4. `page.getByTestId()` — éléments avec attributs `data-testid` que vous ajoutez à votre plugin
5. `page.locator()` — sélecteurs CSS ou XPath en dernier recours

<!--
### WordPress-specific guidance

In the WordPress admin, some core elements (admin bar, meta boxes) rely on IDs and CSS classes rather than ARIA roles. However, many elements work well with semantic locators. This means:

- **Use semantic locators** for buttons, headings, links, form fields, and admin menu items — WordPress renders standard `<button>`, `<input>`, `<a>`, and `<h1>` elements that `getByRole` and `getByLabel` can find.
- **Use `data-testid`** for your own plugin markup — you control the HTML, so add testable attributes.
- **Use CSS selectors** for WordPress core layout elements like `#wpadminbar` or `#wpbody-content` — these lack ARIA alternatives.
-->

### Conseils spécifiques à WordPress

Dans l'admin WordPress, certains éléments principaux (barre d'administration, meta boxes) utilisent des ID et classes CSS plutôt que des rôles ARIA. Cependant, de nombreux éléments fonctionnent bien avec des localisateurs sémantiques. Cela signifie :

- **Utilisez des localisateurs sémantiques** pour les boutons, titres, liens, champs de formulaire et éléments du menu admin — WordPress rend des éléments standards `<button>`, `<input>`, `<a>` et `<h1>` que `getByRole` et `getByLabel` peuvent trouver.
- **Utilisez `data-testid`** pour le markup de votre propre plugin — vous contrôlez le HTML, ajoutez donc des attributs testables.
- **Utilisez des sélecteurs CSS** pour les éléments de mise en page principaux de WordPress comme `#wpadminbar` ou `#wpbody-content` — ils n'ont pas d'alternatives ARIA.

<!--
### Same element, three approaches

```typescript
// ✅ Preferred: semantic locator (works because WP renders a real <button>)
await page.getByRole("button", { name: "Save Changes" }).click();

// ⚠️ Acceptable: test ID you added to your plugin markup
await page.getByTestId("save-settings").click();

// ❌ Avoid: brittle CSS selector tied to WordPress markup
await page.locator("#submit").click();
```
-->

### Même élément, trois approches

```typescript
// ✅ Préféré : localisateur sémantique (fonctionne car WP rend un vrai <button>)
await page.getByRole("button", { name: "Enregistrer les modifications" }).click();

// ⚠️ Acceptable : ID de test que vous avez ajouté au markup de votre plugin
await page.getByTestId("save-settings").click();

// ❌ À éviter : sélecteur CSS fragile lié au markup WordPress
await page.locator("#submit").click();
```

<!--
:::tip[Generate locators automatically]
Run `npx playwright codegen localhost:9400/wp-admin/` to open a browser and record interactions. Playwright generates locator code as you click, helping you discover which semantic locators work for each element.
:::
-->

:::tip[Générer les localisateurs automatiquement]
Exécutez `npx playwright codegen localhost:9400/wp-admin/` pour ouvrir un navigateur et enregistrer les interactions. Playwright génère le code des localisateurs pendant que vous cliquez, vous aidant à découvrir quels localisateurs sémantiques fonctionnent pour chaque élément.
:::

<!--
## Auto-waiting and web-first assertions

Playwright locators wait automatically for elements to appear, become visible, and become actionable. You do not need manual `waitForSelector` calls in most cases.

### Web-first assertions

Web-first assertions auto-retry until the condition passes or the timeout expires. Always prefer them over manual checks:
-->

## Auto-attente et assertions orientée web

Les localisateurs Playwright attendent automatiquement que les éléments apparaissent, deviennent visibles et actionnables. Dans la plupart des cas, vous n'avez pas besoin d'appels manuels à `waitForSelector`.

### Assertions orientée web

Les assertions orientée web réessaient automatiquement jusqu'à ce que la condition soit remplie ou que le délai expire. Préférez-les toujours aux vérifications manuelles :

```typescript
// ✅ Assertion orientée web (réessaie jusqu'à visible ou timeout)
await expect(page.getByText("Paramètres enregistrés")).toBeVisible();

// ❌ Vérification manuelle (sans retry — instable si l'élément apparaît en retard)
expect(await page.getByText("Paramètres enregistrés").isVisible()).toBe(true);
```

<!--
### Soft assertions

Use `expect.soft()` to check multiple things on one page without stopping at the first failure. All failures appear in the test report:
-->

### Assertions souples

Utilisez `expect.soft()` pour vérifier plusieurs éléments sur une page sans s'arrêter au premier échec. Tous les échecs apparaissent dans le rapport de test :

```typescript
await expect.soft(page.getByLabel("API Key")).toHaveValue("test-key-123");
await expect.soft(page.getByText("Settings saved")).toBeVisible();
await expect.soft(page.getByRole("heading", { level: 1 })).toContainText("Settings");
```

<!--
## Writing tests

### Starting a Playground server

The `runCLI` function starts a local Playground server and returns an object with `serverUrl` (the URL string) and `server` (the HTTP server instance). Pass a Blueprint to configure the WordPress instance:
-->

## Écrire des tests

### Démarrer un serveur Playground

La fonction `runCLI` démarre un serveur Playground local et retourne un objet avec `serverUrl` (la chaîne URL) et `server` (l'instance du serveur HTTP). Passez un Blueprint pour configurer l'instance WordPress :

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

<!--
#### Server lifecycle: shared vs. per-test

**Shared server (`beforeAll`/`afterAll`)** — one Playground instance serves all tests in a describe block. Faster, but tests can affect each other:
-->

#### Cycle de vie du serveur : partagé vs. par test

**Serveur partagé (`beforeAll`/`afterAll`)** — une instance Playground sert tous les tests d'un bloc describe. Plus rapide, mais les tests peuvent s'influencer mutuellement :

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

<!--
**Per-test server (`beforeEach`/`afterEach`)** — each test gets a fresh instance. Slower, but fully isolated:
-->

**Serveur par test (`beforeEach`/`afterEach`)** — chaque test obtient une instance fraîche. Plus lent, mais entièrement isolé :

```typescript
test.beforeEach(async () => {
  cli = await runCLI({ command: "server", blueprint });
});
test.afterEach(async () => {
  await cli?.server?.close();
});
```

<!--
Use shared servers when tests only read state (checking pages render). Use per-test servers when tests modify state (creating posts, changing settings).

### Using Blueprints as test fixtures

Blueprints define the WordPress state each test scenario needs. Here are common patterns:
-->

Utilisez des serveurs partagés lorsque les tests ne font que lire l'état (vérification du rendu des pages). Utilisez des serveurs par test lorsque les tests modifient l'état (création d'articles, modification des paramètres).

### Utiliser les Blueprints comme fixtures de test

Les Blueprints définissent l'état WordPress nécessaire à chaque scénario de test. Voici les modèles courants :

<!--
#### Installing a plugin from wordpress.org
-->

#### Installer un plugin depuis wordpress.org

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

<!--
#### Installing a local plugin

Mount your local plugin directory into the Playground instance:
-->

#### Installer un plugin local

Montez le répertoire de votre plugin local dans l'instance Playground :

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

<!--
This maps your current directory to the plugin path inside WordPress, then activates the plugin. Changes to your local files are reflected immediately. The user can set the `autoMount` property to identify plugins and themes, but the `mount` property will provide more control to the user to set different folders in the project.

#### Setting options and creating content
-->

Cela mappe votre répertoire actuel au chemin du plugin dans WordPress, puis active le plugin. Les modifications de vos fichiers locaux se reflètent immédiatement. L'utilisateur peut configurer la propriété `autoMount` pour identifier les plugins et thèmes, mais la propriété `mount` offrira plus de contrôle à l'utilisateur pour définir différents dossiers dans le projet.

#### Définir les options et créer du contenu

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

<!--
:::tip
Use the [Playground Step Library](https://akirk.github.io/playground-step-library/) or [Pootle Playground](https://pootleplayground.com/) to prototype your Blueprint configuration visually before adding it to your test code.
:::
-->

:::tip
Utilisez la [Playground Step Library](https://akirk.github.io/playground-step-library/) ou [Pootle Playground](https://pootleplayground.com/) pour prototyper votre configuration Blueprint visuellement avant de l'ajouter à votre code de test.
:::

<!--
### Testing WordPress admin pages

Navigate to admin pages and interact with the WordPress UI:
-->

### Tester les pages d'administration WordPress

Naviguez vers les pages d'administration et interagissez avec l'interface WordPress :

```typescript
test("plugin settings page saves options", async ({ page }) => {
  await page.goto(`${cli.serverUrl}/wp-admin/options-general.php?page=my-plugin`);

  await page.getByLabel("API Key").fill("test-key-123");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();

  await expect(page.getByText("Paramètres enregistrés")).toBeVisible();
  await expect(page.getByLabel("API Key")).toHaveValue("test-key-123");
});
```

<!--
#### Handling common admin UI elements

```typescript
// Dismiss WordPress admin notices (WP adds aria-label to dismiss buttons)
await page.getByRole("button", { name: "Dismiss this notice" }).first().click();

// Wait for admin bar to load — no ARIA role available, use locator
await page.locator("#wpadminbar").waitFor();

// Navigate via admin menu
await page.getByRole("link", { name: "My Plugin" }).first().click();
```
-->

#### Gérer les éléments courants de l'interface d'administration

```typescript
// Fermer les notifications admin WordPress (WP ajoute aria-label aux boutons de fermeture)
await page.getByRole("button", { name: "Dismiss this notice" }).first().click();

// Attendre le chargement de la barre admin — pas de rôle ARIA disponible, utiliser locator
await page.locator("#wpadminbar").waitFor();

// Naviguer via le menu admin
await page.getByRole("link", { name: "My Plugin" }).first().click();
```

<!--
### Testing the front end
-->

### Tester le front-end

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

<!--
## Page Object Model pattern

The Page Object Model (POM) wraps page interactions into reusable classes. This reduces duplication and makes tests easier to maintain when your plugin UI changes.
-->

## Modèle Page Object Model

Le Page Object Model (POM) encapsule les interactions avec les pages dans des classes réutilisables. Cela réduit la duplication et facilite la maintenance des tests lorsque l'interface de votre plugin change.

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
    this.saveButton = page.getByRole("button", { name: "Enregistrer les modifications" });
    this.successNotice = page.getByText("Paramètres enregistrés");
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

<!--
Use the POM in tests:
-->

Utilisez le POM dans les tests :

```typescript
import { PluginSettingsPage } from "./pages/plugin-settings";

test("save plugin settings", async ({ page }) => {
  const settings = new PluginSettingsPage(page);
  await settings.goto(cli.serverUrl);
  await settings.setApiKey("test-key-123");
  await settings.expectSaved();
});
```

<!--
The Playground project uses this pattern with a `WebsitePage` class that provides methods like `goto()`, `wordpress()`, and `getSiteTitle()` — encapsulating navigation and WordPress-specific interactions.

## Testing across PHP and WordPress versions

Parameterized tests cover multiple version combinations without duplicating test code:
-->

Le projet Playground utilise ce modèle avec une classe `WebsitePage` qui fournit des méthodes comme `goto()`, `wordpress()` et `getSiteTitle()` — encapsulant la navigation et les interactions spécifiques à WordPress.

## Tester sur différentes versions de PHP et WordPress

Les tests paramétrés couvrent plusieurs combinaisons de versions sans dupliquer le code de test :

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

<!--
The `preferredVersions` property in the Blueprint controls which PHP and WordPress versions the Playground instance uses. Supported ranges: PHP 7.4–8.5, WordPress 6.3–6.8+, plus `latest`, `nightly`, and `beta`. For type-safe PHP version values, use the `SupportedPHPVersion` type from `@php-wasm/universal`.

## Running tests in CI/CD

### GitHub Actions

Create `.github/workflows/e2e-tests.yml`:
-->

La propriété `preferredVersions` dans le Blueprint contrôle les versions PHP et WordPress utilisées par l'instance Playground. Plages prises en charge : PHP 7.4–8.5, WordPress 6.3–6.8+, ainsi que `latest`, `nightly` et `beta`. Pour des valeurs de version PHP typées, utilisez le type `SupportedPHPVersion` de `@php-wasm/universal`.

## Exécuter les tests en CI/CD

### GitHub Actions

Créez `.github/workflows/e2e-tests.yml` :

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

<!--
This workflow installs dependencies, downloads Chromium, runs the tests, and uploads the HTML report as an artifact. The `--with-deps` flag installs system libraries Chromium needs on Ubuntu.

:::tip[Sharding for faster CI]
Split tests across multiple CI jobs with Playwright's built-in sharding:
-->

Ce workflow installe les dépendances, télécharge Chromium, exécute les tests et télécharge le rapport HTML comme artefact. L'option `--with-deps` installe les bibliothèques système nécessaires à Chromium sur Ubuntu.

:::tip[Fragmenter pour un CI plus rapide]
Répartissez les tests sur plusieurs jobs CI avec la fragmentation intégrée de Playwright :

```bash
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

Créez trois jobs parallèles dans la matrice de votre workflow, chacun exécutant un fragment différent. Cela réduit proportionnellement le temps total de CI.
:::

<!--
:::info
For manual PR testing alongside automated E2E tests, see [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview).
:::
-->

:::info
Pour les tests manuels des PR en complément des tests E2E automatisés, voir [Ajouter des boutons d'aperçu PR avec GitHub Actions](/guides/github-action-pr-preview).
:::

<!--
## Troubleshooting

**Timeout errors** — Increase `timeout` in `playwright.config.ts`. WordPress boot time varies by environment. CI runners often need 120–180 seconds.

**Port conflicts** — Let Playground auto-assign ports. Do not hardcode port numbers in your configuration. The `serverUrl` property returns the correct URL.

**Browser not found** — Run `npx playwright install chromium` to download the browser binary. On CI, add `--with-deps` for system libraries.

**WordPress not loading** — Check your Blueprint syntax against the [Blueprint schema](https://playground.wordpress.net/blueprint-schema.json). Invalid steps fail silently in some cases.

**Tests pass locally but fail in CI** — CI runners have less memory and CPU. Increase timeouts, reduce parallel workers, and ensure `workers: 1` in the config.

## Debugging tests

When a test fails, Playwright provides several tools to investigate:
-->

## Dépannage

**Erreurs de timeout** — Augmentez `timeout` dans `playwright.config.ts`. Le temps de démarrage de WordPress varie selon l'environnement. Les exécuteurs CI ont souvent besoin de 120–180 secondes.

**Conflits de ports** — Laissez Playground attribuer les ports automatiquement. Ne codez pas en dur les numéros de port dans votre configuration. La propriété `serverUrl` retourne la bonne URL.

**Navigateur non trouvé** — Exécutez `npx playwright install chromium` pour télécharger le binaire du navigateur. Sur CI, ajoutez `--with-deps` pour les bibliothèques système.

**WordPress ne charge pas** — Vérifiez la syntaxe de votre Blueprint par rapport au [schéma Blueprint](https://playground.wordpress.net/blueprint-schema.json). Les étapes invalides échouent silencieusement dans certains cas.

**Les tests passent en local mais échouent en CI** — Les exécuteurs CI ont moins de mémoire et de CPU. Augmentez les délais d'expiration, réduisez les processus parallèles et assurez-vous que `workers: 1` est dans la config.

## Déboguer les tests

Lorsqu'un test échoue, Playwright fournit plusieurs outils pour investiguer :

<!--
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
-->

**Playwright Inspector** — parcourez les tests de manière interactive avec un débogueur intégré :

```bash
npx playwright test --debug
```

**Visualiseur de traces** — examinez une chronologie des actions, des snapshots DOM et des requêtes réseau d'un test échoué. La configuration `trace: "on-first-retry"` ci-dessus capture automatiquement les traces :

```bash
npx playwright show-trace test-results/plugin-spec-ts/trace.zip
```

**Mode UI** — exécutez les tests dans une interface visuelle où vous pouvez regarder, filtrer et relancer les tests :

```bash
npx playwright test --ui
```

**Capture d'écran en cas d'échec** — la configuration `screenshot: "only-on-failure"` dans le configuration sauvegarde une capture d'écran à chaque échec de test. Trouvez les captures dans le répertoire `test-results/`.

<!--
:::tip
Combine `--debug` with a specific test file to focus your investigation: `npx playwright test tests/e2e/settings.spec.ts --debug`
:::

## Next steps

- [WordPress Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference
- [Playwright documentation](https://playwright.dev/docs/intro) — test writing guide and API reference
- [Blueprints reference](/blueprints/steps) — all available Blueprint steps
- [Adding PR Preview Buttons](/guides/github-action-pr-preview) — combine automated tests with manual PR previews
-->

:::tip
Combinez `--debug` avec un fichier de test spécifique pour concentrer votre investigation : `npx playwright test tests/e2e/settings.spec.ts --debug`
:::

## Prochaines étapes

- [Documentation de la CLI WordPress Playground](/developers/local-development/wp-playground-cli) — référence complète de la CLI
- [Documentation Playwright](https://playwright.dev/docs/intro) — guide d'écriture de tests et référence API
- [Référence Blueprints](/blueprints/steps) — toutes les étapes Blueprint disponibles
- [Ajouter des boutons d'aperçu PR](/guides/github-action-pr-preview) — combinez les tests automatisés avec les aperçus PR manuels
