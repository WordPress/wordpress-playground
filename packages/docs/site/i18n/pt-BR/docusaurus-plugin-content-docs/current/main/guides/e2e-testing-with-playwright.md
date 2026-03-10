---
title: Testes E2E com Playwright e WordPress Playground
slug: /guides/e2e-testing-with-playwright
description: Configure testes de ponta a ponta para plugins e temas WordPress usando Playwright e o Playground CLI.
sidebar_class_name: navbar-build-item
---

<!--
End-to-end testing verifies that your WordPress plugin or theme works correctly from a user's perspective — clicking buttons, filling forms, and navigating pages in a real browser. This guide shows how to combine [Playwright](https://playwright.dev/) with the [WordPress Playground CLI](/developers/local-development/wp-playground-cli) to write reliable E2E tests without Docker, databases, or manual setup.
-->

Testes de ponta a ponta verificam se seu plugin ou tema WordPress funciona corretamente da perspectiva do usuário — clicando em botões, preenchendo formulários e navegando em páginas em um navegador real. Este guia mostra como combinar [Playwright](https://playwright.dev/) com o [WordPress Playground CLI](/developers/local-development/wp-playground-cli) para escrever testes E2E confiáveis sem Docker, bancos de dados ou configuração manual.

<!--
:::info
This guide assumes familiarity with WordPress plugin or theme development. For an introduction to using Playground in your development workflow, see [WordPress Playground for Plugin Developers](/guides/for-plugin-developers). For Blueprint configuration details, see [Blueprints Getting Started](/blueprints/getting-started).
:::
-->

:::info
Este guia pressupõe familiaridade com desenvolvimento de plugins ou temas WordPress. Para uma introdução ao uso do Playground no seu fluxo de desenvolvimento, consulte [WordPress Playground para Desenvolvedores de Plugins](/guides/for-plugin-developers). Para detalhes de configuração do Blueprint, consulte [Introdução aos Blueprints](/blueprints/getting-started).
:::

<!--
## Prerequisites

- **Node.js 20+** and up
- A WordPress plugin/theme or an entire WordPress site to test
- **Recommended:** enable the `@typescript-eslint/no-floating-promises` ESLint rule to catch missing `await` on async Playwright calls
-->

## Pré-requisitos

- **Node.js 20+** e superior
- Um plugin/tema WordPress ou um site WordPress completo para testar
- **Recomendado:** habilite a regra ESLint `@typescript-eslint/no-floating-promises` para detectar `await` ausente em chamadas assíncronas do Playwright

<!--
## Project setup

### Install dependencies

From your plugin or theme root directory:

```bash
npm init -y
npm install --save-dev @playwright/test @wp-playground/cli
npx playwright install chromium
```

This installs Playwright as the test runner, the Playground CLI for creating WordPress instances, and the Chromium browser for test execution.
-->

## Configuração do projeto

### Instalar dependências

A partir do diretório raiz do seu plugin ou tema:

```bash
npm init -y
npm install --save-dev @playwright/test @wp-playground/cli
npx playwright install chromium
```

Isso instala o Playwright como executor de testes, o Playground CLI para criar instâncias do WordPress e o navegador Chromium para execução dos testes.

<!--
### Configure Playwright

Create a `playwright.config.ts` file in your project root:
-->

### Configurar o Playwright

Crie um arquivo `playwright.config.ts` na raiz do seu projeto:

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

O WordPress Playground precisa de mais tempo para iniciar do que uma aplicação web típica. O timeout de teste de 120 segundos e o timeout de asserção de 30 segundos consideram o tempo de inicialização do WordPress e o carregamento das páginas. Definir `workers: 1` evita conflitos de porta quando vários testes compartilham um servidor Playground.

<!--
:::tip[Using baseURL with dynamic ports]
By default, Playground will sign the port `9400`. If you want to select a different port, pass `port: [NEW_PORT_NUMBER]` in the `runCLI` options to select a different port:

```typescript
const cli = await runCLI({ command: "server", port: 9500, blueprint });
```

Then add `baseURL: "http://localhost:9500"` to the `use` section above. Note that `testMatch` defaults to `**/*.spec.ts` — customize it if your test files use a different naming pattern.
:::
-->

:::tip[Usando baseURL com portas dinâmicas]
Por padrão, o Playground usará a porta `9400`. Se você quiser selecionar uma porta diferente, passe `port: [NOVO_NÚMERO_DE_PORTA]` nas opções do `runCLI` para selecionar uma porta diferente:

```typescript
const cli = await runCLI({ command: "server", port: 9500, blueprint });
```

Em seguida, adicione `baseURL: "http://localhost:9500"` na seção `use` acima. Observe que `testMatch` tem como padrão `**/*.spec.ts` — personalize se seus arquivos de teste usarem um padrão de nomenclatura diferente.
:::

<!--
:::tip
The WordPress Playground project uses even longer timeouts (300s test, 60s assertion) for its own tests. Start with the values above and increase if your CI environment is slower.
:::
-->

:::tip
O projeto WordPress Playground usa timeouts ainda maiores (300s de teste, 60s de asserção) para seus próprios testes. Comece com os valores acima e aumente se seu ambiente de CI for mais lento.
:::

<!--
### First test file

Create `tests/e2e/plugin.spec.ts`:
-->

### Primeiro arquivo de teste

Crie `tests/e2e/plugin.spec.ts`:

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

Execute o teste:

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

## Escolhendo localizadores

O Playwright oferece várias formas de encontrar elementos na página. Prefira localizadores que reflitam como os usuários veem a página, usando seletores CSS apenas quando necessário.

**Prioridade de localizadores** (do mais ao menos preferido):

1. `page.getByRole()` — botões, títulos, links, controles de formulário
2. `page.getByLabel()` — inputs de formulário com rótulos associados
3. `page.getByText()` — conteúdo de texto visível
4. `page.getByTestId()` — elementos com atributos `data-testid` que você adiciona ao seu plugin
5. `page.locator()` — seletores CSS ou XPath como último recurso

<!--
### WordPress-specific guidance

In the WordPress admin, some core elements (admin bar, meta boxes) rely on IDs and CSS classes rather than ARIA roles. However, many elements work well with semantic locators. This means:

- **Use semantic locators** for buttons, headings, links, form fields, and admin menu items — WordPress renders standard `<button>`, `<input>`, `<a>`, and `<h1>` elements that `getByRole` and `getByLabel` can find.
- **Use `data-testid`** for your own plugin markup — you control the HTML, so add testable attributes.
- **Use CSS selectors** for WordPress core layout elements like `#wpadminbar` or `#wpbody-content` — these lack ARIA alternatives.
-->

### Orientação específica para WordPress

No admin do WordPress, alguns elementos principais (barra de administração, meta boxes) usam IDs e classes CSS em vez de funções ARIA. Porém, muitos elementos funcionam bem com localizadores semânticos. Isso significa:

- **Use localizadores semânticos** para botões, títulos, links, campos de formulário e itens do menu admin — o WordPress renderiza elementos padrão `<button>`, `<input>`, `<a>` e `<h1>` que `getByRole` e `getByLabel` podem encontrar.
- **Use `data-testid`** para a marcação do seu próprio plugin — você controla o HTML, então adicione atributos testáveis.
- **Use seletores CSS** para elementos de layout principais do WordPress como `#wpadminbar` ou `#wpbody-content` — estes não têm alternativas ARIA.

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

### Mesmo elemento, três abordagens

> Observação: o WordPress Playground usa a interface de administração em inglês por padrão, então os textos dos botões (como "Save Changes") aparecem em inglês.

```typescript
// ✅ Preferido: localizador semântico (funciona porque o WP renderiza um <button> real)
await page.getByRole("button", { name: "Save Changes" }).click();

// ⚠️ Aceitável: ID de teste que você adicionou à marcação do seu plugin
await page.getByTestId("save-settings").click();

// ❌ Evite: seletor CSS frágil vinculado à marcação do WordPress
await page.locator("#submit").click();
```

<!--
:::tip[Generate locators automatically]
Run `npx playwright codegen localhost:9400/wp-admin/` to open a browser and record interactions. Playwright generates locator code as you click, helping you discover which semantic locators work for each element.
:::
-->

:::tip[Gerar localizadores automaticamente]
Execute `npx playwright codegen localhost:9400/wp-admin/` para abrir um navegador e gravar interações. O Playwright gera código de localizador conforme você clica, ajudando a descobrir quais localizadores semânticos funcionam para cada elemento.
:::

<!--
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
-->

## Auto-espera e asserções web-first

Os localizadores do Playwright esperam automaticamente que os elementos apareçam, fiquem visíveis e acionáveis. Na maioria dos casos, você não precisa de chamadas manuais a `waitForSelector`.

### Asserções web-first

Asserções web-first repetem automaticamente até a condição ser atendida ou o timeout expirar. Sempre prefira-as em vez de verificações manuais:

```typescript
// ✅ Asserção web-first (repete automaticamente até visível ou timeout)
await expect(page.getByText("Configurações salvas")).toBeVisible();

// ❌ Verificação manual (sem retry — instável se o elemento aparecer com atraso)
expect(await page.getByText("Configurações salvas").isVisible()).toBe(true);
```

### Asserções suaves

Use `expect.soft()` para verificar várias coisas em uma página sem parar no primeiro erro. Todas as falhas aparecem no relatório de teste:

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

## Escrevendo testes

### Iniciando um servidor Playground

A função `runCLI` inicia um servidor Playground local e retorna um objeto com `serverUrl` (a string da URL) e `server` (a instância do servidor HTTP). Passe um Blueprint para configurar a instância do WordPress:

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

#### Ciclo de vida do servidor: compartilhado vs. por teste

**Servidor compartilhado (`beforeAll`/`afterAll`)** — uma instância Playground serve todos os testes em um bloco describe. Mais rápido, mas os testes podem afetar uns aos outros:

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

**Servidor por teste (`beforeEach`/`afterEach`)** — cada teste recebe uma instância nova. Mais lento, mas totalmente isolado:

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

Use servidores compartilhados quando os testes apenas leem o estado (verificando renderização de páginas). Use servidores por teste quando os testes modificam o estado (criando posts, alterando configurações).

### Usando Blueprints como fixtures de teste

Blueprints definem o estado do WordPress que cada cenário de teste precisa. Aqui estão padrões comuns:

<!--
#### Installing a plugin from wordpress.org
-->

#### Instalando um plugin do wordpress.org

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

#### Instalando um plugin local

Monte o diretório do seu plugin local na instância do Playground:

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

Isso mapeia seu diretório atual para o caminho do plugin dentro do WordPress e, em seguida, ativa o plugin. As alterações nos seus arquivos locais refletem imediatamente. O usuário pode configurar a propriedade `autoMount` para identificar plugins e temas, mas a propriedade `mount` proporcionará mais controle ao usuário para definir diferentes pastas no projeto.

#### Definindo opções e criando conteúdo

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
Use a [Playground Step Library](https://akirk.github.io/playground-step-library/) ou o [Pootle Playground](https://pootleplayground.com/) para prototipar sua configuração de Blueprint visualmente antes de adicioná-la ao seu código de teste.
:::

<!--
### Testing WordPress admin pages

Navigate to admin pages and interact with the WordPress UI:
-->

### Testando páginas do admin do WordPress

Navegue até as páginas do admin e interaja com a interface do WordPress:

```typescript
test("plugin settings page saves options", async ({ page }) => {
  await page.goto(`${cli.serverUrl}/wp-admin/options-general.php?page=my-plugin`);

  await page.getByLabel("API Key").fill("test-key-123");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByText("Settings saved")).toBeVisible();
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

#### Lidando com elementos comuns da UI do admin

```typescript
// Dispensar avisos do admin do WordPress (o WP adiciona aria-label aos botões de dispensar)
await page.getByRole("button", { name: "Dismiss this notice" }).first().click();

// Aguardar o carregamento da barra admin — sem função ARIA disponível, use locator
await page.locator("#wpadminbar").waitFor();

// Navegar pelo menu admin
await page.getByRole("link", { name: "My Plugin" }).first().click();
```

<!--
### Testing the front end
-->

### Testando o front-end

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

## Padrão Page Object Model

O Page Object Model (POM) encapsula as interações da página em classes reutilizáveis. Isso reduz duplicação e facilita a manutenção dos testes quando a UI do seu plugin muda.

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

<!--
Use the POM in tests:
-->

Use o POM nos testes:

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

O projeto Playground usa esse padrão com a classe `WebsitePage` que fornece métodos como `goto()`, `wordpress()` e `getSiteTitle()` — encapsulando navegação e interações específicas do WordPress.

## Testando em diferentes versões de PHP e WordPress

Testes parametrizados cobrem múltiplas combinações de versões sem duplicar código de teste:

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

A propriedade `preferredVersions` no Blueprint controla quais versões de PHP e WordPress a instância Playground usa. Intervalos suportados: PHP 7.4–8.5, WordPress 6.3–6.8+, além de `latest`, `nightly` e `beta`. Para valores de versão PHP com segurança de tipos, use o tipo `SupportedPHPVersion` de `@php-wasm/universal`.

## Executando testes em CI/CD

### GitHub Actions

Crie `.github/workflows/e2e-tests.yml`:

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

Este workflow instala dependências, baixa o Chromium, executa os testes e faz upload do relatório HTML como artefato. A flag `--with-deps` instala as bibliotecas do sistema que o Chromium precisa no Ubuntu.

:::tip[Fragmentação para CI mais rápido]
Divida os testes em vários jobs de CI com a fragmentação integrada do Playwright:

```bash
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

Crie três jobs paralelos na matriz do seu workflow, cada um executando um fragmento diferente. Isso reduz o tempo total de CI proporcionalmente.
:::

<!--
:::info
For manual PR testing alongside automated E2E tests, see [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview).
:::
-->

:::info
Para testes manuais de PR junto com testes E2E automatizados, consulte [Adicionando botões de preview de PR com GitHub Actions](/guides/github-action-pr-preview).
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

## Solução de problemas

**Erros de timeout** — Aumente o `timeout` no `playwright.config.ts`. O tempo de inicialização do WordPress varia conforme o ambiente. Runners de CI frequentemente precisam de 120–180 segundos.

**Conflitos de porta** — Deixe o Playground atribuir portas automaticamente. Não codifique números de porta na sua configuração. A propriedade `serverUrl` retorna a URL correta.

**Navegador não encontrado** — Execute `npx playwright install chromium` para baixar o binário do navegador. No CI, adicione `--with-deps` para bibliotecas do sistema.

**WordPress não carrega** — Verifique a sintaxe do seu Blueprint com o [esquema Blueprint](https://playground.wordpress.net/blueprint-schema.json). Passos inválidos podem falhar silenciosamente em alguns casos.

**Testes passam localmente mas falham no CI** — Runners de CI têm menos memória e CPU. Aumente os timeouts, reduza workers paralelos e garanta `workers: 1` na config.

## Depurando testes

Quando um teste falha, o Playwright oferece várias ferramentas para investigar:

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

**Playwright Inspector** — percorra os testes interativamente com um depurador integrado:

```bash
npx playwright test --debug
```

**Visualizador de trace** — inspecione uma linha do tempo de ações, capturas de DOM e requisições de rede de um teste que falhou. A configuração `trace: "on-first-retry"` no config acima captura traces automaticamente:

```bash
npx playwright show-trace test-results/plugin-spec-ts/trace.zip
```

**Modo UI** — execute os testes em uma interface visual onde você pode assistir, filtrar e reexecutá-los:

```bash
npx playwright test --ui
```

**Screenshot em caso de falha** — a configuração `screenshot: "only-on-failure"` no config salva um screenshot sempre que um teste falha. Encontre os screenshots no diretório `test-results/`.

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
Combine `--debug` com um arquivo de teste específico para focar sua investigação: `npx playwright test tests/e2e/settings.spec.ts --debug`
:::

## Próximos passos

- [Documentação do WordPress Playground CLI](/developers/local-development/wp-playground-cli) — referência completa da CLI
- [Documentação do Playwright](https://playwright.dev/docs/intro) — guia de escrita de testes e referência da API
- [Referência de Blueprints](/blueprints/steps) — todos os passos de Blueprint disponíveis
- [Adicionando botões de preview de PR](/guides/github-action-pr-preview) — combine testes automatizados com previews manuais de PR
