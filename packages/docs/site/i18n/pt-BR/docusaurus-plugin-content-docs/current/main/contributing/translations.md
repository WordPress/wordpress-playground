---
title: Contribuições para traduções
slug: /contributing/translations
description: Aprenda a traduzir a documentação do Playground, incluindo a estrutura de arquivos, testes locais e o processo de revisão.
---

<!--
# Contributions to translations
-->

# Contribuições para traduções

<!--
Help make WordPress Playground accessible to a global audience by translating its documentation. This guide provides everything you need to know to get started. Contributing translations follows the same workflow as any other documentation change. You can either fork the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository and create a pull request (PR) with your changes or edit pages directly using the GitHub UI.
-->

Ajude a tornar o WordPress Playground acessível a um público global traduzindo sua documentação. Este guia fornece tudo o que você precisa saber para começar. Contribuir com traduções segue o mesmo fluxo de trabalho que qualquer outra alteração de documentação. Você pode fazer um fork do repositório [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) e criar um pull request (PR) com suas alterações, ou editar páginas diretamente usando a interface do GitHub.

<!--
:::info
For a detailed guide on the contribution workflow (forking, creating PRs, etc.), please see our [documentation contribution guide](/contributing/documentation#how-can-i-contribute)
:::
-->

:::info
Para um guia detalhado sobre o fluxo de trabalho de contribuição (fork, criação de PRs, etc.), consulte nosso [guia de contribuição para documentação](/contributing/documentation#how-can-i-contribute)
:::

<!--
## How Translations Work
-->

## Como funcionam as traduções

<!--
Playground's documentation site is built with Docusaurus, which handles the internationalization (i18n) features.
-->

O site de documentação do Playground é construído com Docusaurus, que gerencia os recursos de internacionalização (i18n).

<!--
:::info
To learn more about how Docusaurus manages translations, see the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of the official Docusaurus documentation.
:::
-->

:::info
Para saber mais sobre como o Docusaurus gerencia traduções, consulte a [seção de Internacionalização](https://docusaurus.io/docs/i18n/introduction) da documentação oficial do Docusaurus.
:::

<!--
### Configuration
-->

### Configuração

<!--
Available languages are defined in the `packages/docs/site/docusaurus.config.js` file. For example:
-->

Os idiomas disponíveis são definidos no arquivo `packages/docs/site/docusaurus.config.js`. Por exemplo:

```
i18n: {
  defaultLocale: 'en',
  path: 'i18n',
  locales: ['en', 'fr'],
  localeConfigs: {
	en: {
		label: 'English',
		path: 'en',
	},
	fr: {
		label: 'French',
		path: 'fr',
	},
  },
}
```

<!--
### File Structure
-->

### Estrutura de arquivos

<!--
All translated documentation pages are located within the `packages/docs/site/i18n/` directory, organized by language code.
-->

Todas as páginas de documentação traduzidas estão localizadas no diretório `packages/docs/site/i18n/`, organizadas por código de idioma.

<!--
For a language to work correctly, its file structure must mirror the original English documentation found in `packages/docs/site/docs`.
-->

Para que um idioma funcione corretamente, sua estrutura de arquivos deve espelhar a documentação original em inglês encontrada em `packages/docs/site/docs`.

<!--
For example, the Spanish (es) translation for `docs/main/intro.md` must be placed at:
packages`/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.
-->

Por exemplo, a tradução em espanhol (es) de `docs/main/intro.md` deve ser colocada em:
`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.

<!--
If a translated file does not exist for a specific language, Docusaurus will automatically fall back to the English version of that page.
-->

Se um arquivo traduzido não existir para um idioma específico, o Docusaurus automaticamente recorrerá à versão em inglês dessa página.

<!--
### Generating Translation Files
-->

### Gerando arquivos de tradução

<!--
When adding a new language, you can generate the necessary JSON files for UI strings (like button labels and navigation items) by running the following command from the `packages/docs/site` directory:
-->

Ao adicionar um novo idioma, você pode gerar os arquivos JSON necessários para strings da interface do usuário (como rótulos de botões e itens de navegação) executando o seguinte comando do diretório `packages/docs/site`:

<!--
```bash
npm run write-translations -- --locale <LANGUAGE_CODE>
```
-->

```bash
npm run write-translations -- --locale <LANGUAGE_CODE>
```

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

Com a configuração adequada do i18n no `docusaurus.config.js` e arquivos sob `i18n`, ao executar `npm run build:docs` da raiz do projeto, pastas específicas sob `dist` para cada idioma serão criadas.

<!--
## Testing Translations Locally
-->

## Testando traduções localmente

<!--
To preview your changes for an existing language:
-->

Para visualizar suas alterações para um idioma existente:

<!--
1. Modify or add a translated file in the appropriate language directory, such as `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. From the `/packages/docs/site` directory, run the local development server for your target language. For example, to test Spanish (es):
-->

1. Modifique ou adicione um arquivo traduzido no diretório de idioma apropriado, como `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. Do diretório `/packages/docs/site`, execute o servidor de desenvolvimento local para seu idioma de destino. Por exemplo, para testar espanhol (es):

```bash

npm run dev -- --locale es

```

<!--
## The Language Switcher
-->

## O seletor de idioma

<!--
The language switcher is a dropdown menu that allows users to select their preferred language.
-->

O seletor de idioma é um menu suspenso que permite aos usuários selecionar seu idioma preferido.

<!--
![Documentation Language Switcher](@site/static/img/contributing/language-switcher-docs.webp)
-->

![Seletor de idioma da documentação](@site/static/img/contributing/language-switcher-docs.webp)

<!--
### Making a language publicly available on the Language Switcher
-->

### Tornando um idioma publicamente disponível no seletor de idioma

<!--
We recommend only adding a language to the switcher when a significant portion of the documentation has been translated. This avoids a poor user experience where switching to a new language results in seeing mostly untranslated English content.
-->

Recomendamos apenas adicionar um idioma ao seletor quando uma porção significativa da documentação foi traduzida. Isso evita uma experiência de usuário ruim onde mudar para um novo idioma resulta em ver principalmente conteúdo em inglês não traduzido.

<!--
As a guideline, a language should be made publicly available in the switcher only when the entire "Documentation" hub is translated, including these key sections:
-->

Como uma diretriz, um idioma deve ser tornado publicamente disponível no seletor apenas quando todo o hub de "Documentação" estiver traduzido, incluindo estas seções principais:

<!--
-   [Quick Start Guide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Playground web instance](https://wordpress.github.io/wordpress-playground/web-instance)
-   [About Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guides](https://wordpress.github.io/wordpress-playground/guides)
-   [Contributing](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links and Resources](https://wordpress.github.io/wordpress-playground/resources)
-->

-   [Guia de Início Rápido](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Instância web do Playground](https://wordpress.github.io/wordpress-playground/web-instance)
-   [Sobre o Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guias](https://wordpress.github.io/wordpress-playground/guides)
-   [Contribuindo](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links e Recursos](https://wordpress.github.io/wordpress-playground/resources)

<!--
All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.
-->

Todos os idiomas estão disponíveis assim que a configuração i18n para um idioma estiver completa e a estrutura de arquivos correta estiver em vigor sob `i18n`.

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

Assumindo que o idioma `fr` seja o primeiro idioma com as páginas do hub de Documentação (Guia de Início Rápido, Instância web do Playground, Sobre o Playground, Guias,...) completamente traduzidas para Francês, o `docusaurus.config.js` deve ficar assim nesse branch para que `npm run build:docs` gere adequadamente o subsite `fr` e exiba apenas o idioma francês no seletor de idioma `localeDropdown`:

```
  {
    "i18n": {
      "defaultLocale": "en",
      "path": "i18n",
      "locales": [
        "en",
        "fr"
      ],
      "localeConfigs": {
        "en": {
          "label": "English",
          "path": "en"
        },
        "fr": {
          "label": "French",
          "path": "fr"
        }
      }
    }
  },
  {
    "type": "localeDropdown",
    "position": "right"
  }
```

<!--
## Translation Workflow
-->

## Fluxo de trabalho de tradução

<!--
Follow these steps to translate a page:
-->

Siga estes passos para traduzir uma página:

<!--
1. **Check for an Existing Translation Issue**: First, [search the repository issues](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) to see if a tracking issue for your desired language already exists. If it does, comment on the issue to claim the page(s) you would like to translate.
2. **Create a New Translation Issue**: If no issue exists, please create a new one to track the translation progress for the language. You can model it after issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) and use the markdown checklist below to track progress.
3. **Translate the File**:
-->

1. **Verificar se existe uma issue de tradução existente**: Primeiro, [pesquise as issues do repositório](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) para ver se já existe uma issue de rastreamento para o idioma desejado. Se existir, comente na issue para reivindicar a(s) página(s) que você gostaria de traduzir.
2. **Criar uma nova issue de tradução**: Se não existir nenhuma issue, por favor crie uma nova para rastrear o progresso da tradução para o idioma. Você pode modelá-la de acordo com a issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) e usar a lista de verificação em markdown abaixo para rastrear o progresso.
3. **Traduzir o arquivo**:

<!--
-   Check if you have the latest version of the documentation
-   Copy the original .md file from `packages/docs/site/docs/...` to the corresponding path in the language directory (e.g., `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). It is crucial to replicate the original file structure.
-   Translate the content of the new file, keeping the original content commented out `<!-- English Content -->`.

-   The assets are listed at `packages/docs/site/static/img/` only place assets inside the translation folder when it requires localized content.
-   Once the translations are ready, check if the docs build script is running properly `npm run build:docs`.
    -->

-   Verifique se você tem a versão mais recente da documentação
-   Copie o arquivo .md original de `packages/docs/site/docs/...` para o caminho correspondente no diretório do idioma (por exemplo, `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). É crucial replicar a estrutura de arquivos original.
-   Traduza o conteúdo do novo arquivo, mantendo o conteúdo original comentado `<!-- English Content -->`.
-   Os recursos estão listados em `packages/docs/site/static/img/` apenas coloque recursos dentro da pasta de tradução quando necessitar de conteúdo localizado.
-   Assim que as traduções estiverem prontas, verifique se o script de compilação de documentação está sendo executado corretamente `npm run build:docs`.

<!--
4. **Create a pull request with your changes**
-->

4. **Criar um pull request com suas alterações**

<!--
-   Add a prefix to the title `[i18n]` to help to identify the translations
-   Describe the pages that you translated
-   Request a review at `#playground` or `#polyglots` at `wordpress.slack.com`
-->

-   Adicione um prefixo ao título `[i18n]` para ajudar a identificar as traduções
-   Descreva as páginas que você traduziu
-   Solicite uma revisão em `#playground` ou `#polyglots` no `wordpress.slack.com`

<!--
:::info
We highly recommend submitting pull requests with a small number of translated pages. This approach simplifies the review process and allows for a more gradual and manageable integration of your work.
:::
-->

:::info
Recomendamos enfaticamente enviar pull requests com um pequeno número de páginas traduzidas. Esta abordagem simplifica o processo de revisão e permite uma integração mais gradual e gerenciável do seu trabalho.
:::

<!--
### Translation Tracking Template
-->

### Modelo de rastreamento de tradução

<!--
You can use the following markdown in your tracking issue:
-->

Você pode usar o seguinte markdown em sua issue de rastreamento:

<!--
```
## Remaining translation pages

<details open>
<summary><h3>Main</h3></summary>

- about
  - [ ] build.md #2291
  - [ ] index.md #2282
  - [ ] launch.md #2292
  - [ ] test.md #2302
- contributing
  - [ ] code.md #2218
  - [ ] coding-standards.md #2219
  - [ ] contributor-day.md #2246
  - [ ] contributor-badge.md
  - [ ] documentation.md #2271
  - [ ] translations.md #2201
- guides
  - [ ] for-plugin-developers.md #2210
  - [ ] for-theme-developers.md #2211
  - [ ] index.md #2209
  - [ ] providing-content-for-your-demo.md #2213
  - [ ] wordpress-native-ios-app.md #2214
- [ ] intro.md #2198
- [ ] quick-start-guide.md #2204
- [ ] resources.md #2207
- [ ] web-instance.md #2208

</details>

<details open>
<summary><h3>Blueprints</h3></summary>

- blueprints
  - [ ] 01-index.md #2305
  - [ ] 02-using-blueprints.md #2330
  - [ ] 03-data-format.md #2340
   - [ ] 04-resources.md #2352
   - [ ] 05-steps-shorthands.md  #2386
  - [ ] 05-steps.md  #2386
  - [ ] 06-bundles.md #2438
   - [ ] 07-json-api-and-function-api.md #2438
   - [ ] 08-examples.md #2474
   - [ ] 09-troubleshoot-and-debug-blueprints.md #2474
   - [ ] intro.md #2489
   - tutorial
       - [ ] 01-what-are-blueprints-what-you-can-do-with-them.md #2511
       - [ ] 02-how-to-load-run-blueprints.md #2526
       - [ ] 03-build-your-first-blueprint.md
       - [ ] index.md #2511
</details>

<details open>
<summary><h3>Developers</h3></summary>

- [ ] developers
   - [ ] 03-build-an-app
      - [ ] 01-index.md
   - [ ] 05-local-development
      - [ ] 01-wp-now.md
      - [ ] 02-vscode-extension.md
      - [ ] 03-php-wasm-node.md
      - [ ] intro.md
   - [ ] 06-apis
      - [ ] 01-index.md
      - [ ] javascript-api
         - [ ] 01-index.md
         - [ ] 02-index-html-vs-remote-html.md
         - [ ] 03-playground-api-client.md
         - [ ] 04-blueprint-json-in-api-client.md
         - [ ] 05-blueprint-functions-in-api-client.md
         - [ ] 06-mount-data.md
      - [ ] query-api
          - [ ] 01-index.md
   - [ ] 23-architecture
      - [ ] 01-index.md
      - [ ] 02-wasm-php-overview.md
      - [ ] 03-wasm-php-compiling.md
      - [ ] 04-wasm-php-javascript-module.md
      - [ ] 05-wasm-php-filesystem.md
      - [ ] 07-wasm-asyncify.md
      - [ ] 08-browser-concepts.md
      - [ ] 09-browser-tab-orchestrates-execution.md
      - [ ] 10-browser-iframe-rendering.md
      - [ ] 11-browser-php-worker-threads.md
      - [ ] 12-browser-service-workers.md
      - [ ] 13-browser-scopes.md
      - [ ] 14-browser-cross-process-communication.md
      - [ ] 15-wordpress.md
      - [ ] 16-wordpress-database.md
      - [ ] 17-browser-wordpress.md
      - [ ] 18-host-your-own-playground.md
   - [ ] 24-limitations
      - [ ] 01-index.md
   - [ ] intro-devs.md
</details>
```
-->

```
## Remaining translation pages

<details open>
<summary><h3>Main</h3></summary>

- about
  - [ ] build.md #2291
  - [ ] index.md #2282
  - [ ] launch.md #2292
  - [ ] test.md #2302
- contributing
  - [ ] code.md #2218
  - [ ] coding-standards.md #2219
  - [ ] contributor-day.md #2246
  - [ ] contributor-badge.md
  - [ ] documentation.md #2271
  - [ ] translations.md #2201
- guides
  - [ ] for-plugin-developers.md #2210
  - [ ] for-theme-developers.md #2211
  - [ ] index.md #2209
  - [ ] providing-content-for-your-demo.md #2213
  - [ ] wordpress-native-ios-app.md #2214
- [ ] intro.md #2198
- [ ] quick-start-guide.md #2204
- [ ] resources.md #2207
- [ ] web-instance.md #2208

</details>

<details open>
<summary><h3>Blueprints</h3></summary>

- blueprints
  - [ ] 01-index.md #2305
  - [ ] 02-using-blueprints.md #2330
  - [ ] 03-data-format.md #2340
   - [ ] 04-resources.md #2352
   - [ ] 05-steps-shorthands.md  #2386
  - [ ] 05-steps.md  #2386
  - [ ] 06-bundles.md #2438
   - [ ] 07-json-api-and-function-api.md #2438
   - [ ] 08-examples.md #2474
   - [ ] 09-troubleshoot-and-debug-blueprints.md #2474
   - [ ] intro.md #2489
   - tutorial
       - [ ] 01-what-are-blueprints-what-you-can-do-with-them.md #2511
       - [ ] 02-how-to-load-run-blueprints.md #2526
       - [ ] 03-build-your-first-blueprint.md
       - [ ] index.md #2511
</details>

<details open>
<summary><h3>Developers</h3></summary>

- [ ] developers
   - [ ] 03-build-an-app
      - [ ] 01-index.md
   - [ ] 05-local-development
      - [ ] 01-wp-now.md
      - [ ] 02-vscode-extension.md
      - [ ] 03-php-wasm-node.md
      - [ ] intro.md
   - [ ] 06-apis
      - [ ] 01-index.md
      - [ ] javascript-api
         - [ ] 01-index.md
         - [ ] 02-index-html-vs-remote-html.md
         - [ ] 03-playground-api-client.md
         - [ ] 04-blueprint-json-in-api-client.md
         - [ ] 05-blueprint-functions-in-api-client.md
         - [ ] 06-mount-data.md
      - [ ] query-api
          - [ ] 01-index.md
   - [ ] 23-architecture
      - [ ] 01-index.md
      - [ ] 02-wasm-php-overview.md
      - [ ] 03-wasm-php-compiling.md
      - [ ] 04-wasm-php-javascript-module.md
      - [ ] 05-wasm-php-filesystem.md
      - [ ] 07-wasm-asyncify.md
      - [ ] 08-browser-concepts.md
      - [ ] 09-browser-tab-orchestrates-execution.md
      - [ ] 10-browser-iframe-rendering.md
      - [ ] 11-browser-php-worker-threads.md
      - [ ] 12-browser-service-workers.md
      - [ ] 13-browser-scopes.md
      - [ ] 14-browser-cross-process-communication.md
      - [ ] 15-wordpress.md
      - [ ] 16-wordpress-database.md
      - [ ] 17-browser-wordpress.md
      - [ ] 18-host-your-own-playground.md
   - [ ] 24-limitations
      - [ ] 01-index.md
   - [ ] intro-devs.md
</details>
```

<!--
### Translating with the GitHub Web Interface
-->

### Traduzindo com a interface web do GitHub

<!--
If you prefer not to use developer tools, you can easily contribute translations directly on the GitHub website. All you need is a free GitHub account.
-->

Se você preferir não usar ferramentas de desenvolvedor, pode facilmente contribuir com traduções diretamente no site do GitHub. Tudo que você precisa é uma conta gratuita do GitHub.

<!--
This guide will show you how to both update an existing translation and add a brand-new one.
-->

Este guia mostrará como atualizar uma tradução existente e adicionar uma nova.

---

<!--
#### Updating an Existing Translation
-->

#### Atualizando uma tradução existente

<!--
1.  **Navigate to the file.** Go to the repository and find the file you want to update. Translation files are located in a folder named after their language code. For example, all French translations are in `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`.
-->

1.  **Navegue até o arquivo.** Vá para o repositório e encontre o arquivo que deseja atualizar. Os arquivos de tradução estão localizados em uma pasta nomeada de acordo com seu código de idioma. Por exemplo, todas as traduções em francês estão em `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`.

<!--
2.  **Open the editor.** Select the file you wish to edit and click the pencil icon (**Edit this file**) in the upper right corner.
    ![Editing existing translation](@site/static/img/contributing/editing-translations.webp)
-->

2.  **Abra o editor.** Selecione o arquivo que deseja editar e clique no ícone de lápis (**Edit this file**) no canto superior direito.
    ![Editando tradução existente](@site/static/img/contributing/editing-translations.webp)

<!--
3.  **Fork the repository.** GitHub will automatically prompt you to **Fork this repository**. This creates a personal copy for you to edit safely. Click the button to proceed.
-->

3.  **Faça fork do repositório.** O GitHub automaticamente solicitará que você **Fork this repository**. Isso cria uma cópia pessoal para você editar com segurança. Clique no botão para prosseguir.

<!--
4.  **Make your changes.** The editor will open in your browser. Update the text with your improved translations.
-->

4.  **Faça suas alterações.** O editor abrirá em seu navegador. Atualize o texto com suas traduções melhoradas.

<!--
5.  **Propose your changes.** Once you are finished, scroll to the bottom of the page. Add a brief title and description of your changes (e.g., "Fixing typos in French translation") and click the **Propose changes** button.
-->

5.  **Proponha suas alterações.** Quando terminar, role até a parte inferior da página. Adicione um título breve e uma descrição de suas alterações (por exemplo, "Corrigindo erros de digitação na tradução em francês") e clique no botão **Propose changes**.

<!--
6.  **Create a Pull Request.** On the next screen, click the **Create pull request** button. This will submit your changes to the project maintainers for review.
-->

6.  **Crie um Pull Request.** Na próxima tela, clique no botão **Create pull request**. Isso enviará suas alterações aos mantenedores do projeto para revisão.

---

<!--
#### Adding a New Translation
-->

#### Adicionando uma nova tradução

<!--
1.  **Determine the correct file path.** The new file's path and name must mirror the original English file.

    -   **English original:** `packages/docs/site/docs/main/contributing/documentation.md`
    -   **French translation:** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`
-->

1.  **Determine o caminho correto do arquivo.** O caminho e o nome do novo arquivo devem espelhar o arquivo original em inglês.

    -   **Original em inglês:** `packages/docs/site/docs/main/contributing/documentation.md`
    -   **Tradução em francês:** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`

<!--
2.  **Create the new file.** Navigate to the correct language folder (e.g., `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`). Click **Add file** > **Create new file**.
    ![Creating a new translation](@site/static/img/contributing/adding-file-github-ui.webp)

    -   **Pro Tip:** In the filename box, you can create new folders by typing the folder name followed by a `/`. For example, typing `main/contributing/documentation.md` will create the `main` and `contributing` folders automatically.
-->

2.  **Crie o novo arquivo.** Navegue até a pasta de idioma correta (por exemplo, `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`). Clique em **Add file** > **Create new file**.
    ![Criando uma nova tradução](@site/static/img/contributing/adding-file-github-ui.webp)

    -   **Dica profissional:** Na caixa de nome do arquivo, você pode criar novas pastas digitando o nome da pasta seguido por `/`. Por exemplo, digitar `main/contributing/documentation.md` criará as pastas `main` e `contributing` automaticamente.

<!--
3.  **Fork the repository.** Just like before, GitHub will prompt you to **Fork this repository**. Click the button to create your personal copy.
-->

3.  **Faça fork do repositório.** Assim como antes, o GitHub solicitará que você **Fork this repository**. Clique no botão para criar sua cópia pessoal.

<!--
4.  **Add the translated content.** The editor will open with an empty file. For the convenience of reviewers, please copy the content from the original English file and paste it into your new file, wrapping it in comment tags. Add your translation below it.

    ```markdown
    <!--
    This is the original English content.
    It helps reviewers understand the context of the translation.
    -->

    Ceci est le contenu traduit en français.
    ```

    ![GitHub UI Editor](@site/static/img/contributing/editor-github-ui.webp)

-->

4.  **Adicione o conteúdo traduzido.** O editor abrirá com um arquivo vazio. Para a conveniência dos revisores, por favor copie o conteúdo do arquivo original em inglês e cole-o em seu novo arquivo, envolvendo-o em tags de comentário. Adicione sua tradução abaixo.

    ```markdown
    <!--
    This is the original English content.
    It helps reviewers understand the context of the translation.
    -->

    Este é o conteúdo traduzido em português.
    ```

    ![Editor de UI do GitHub](@site/static/img/contributing/editor-github-ui.webp)

<!--
5.  **Commit the new file.** When you are done, scroll to the bottom. Add a title for your new file (e.g., "Add French translation for documentation.md") and click the **Commit new file** button.
-->

5.  **Confirme o novo arquivo.** Quando terminar, role até a parte inferior. Adicione um título para seu novo arquivo (por exemplo, "Adicionar tradução em francês para documentation.md") e clique no botão **Commit new file**.

<!--
6.  **Create a Pull Request.** On the next screen, click **Create pull request** to submit your new translation for review.
-->

6.  **Crie um Pull Request.** Na próxima tela, clique em **Create pull request** para enviar sua nova tradução para revisão.

<!--
## Review Process
-->

## Processo de revisão

<!--
To simplify the review process, please keep the original English text as a comment directly above the translated content.
-->

Para simplificar o processo de revisão, mantenha o texto original em inglês como um comentário diretamente acima do conteúdo traduzido.

<!--
```
<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 Olá! Bem vindo a documentação oficial do WordPress Playground.

WordPress Playground é uma ferramenta online onde podes testar e aprender mais sobre o WordPress. Nesta página(Documentação) irá encontrar todas as informações necessárias para começar a trabalhar com o Playground.

```
-->

```

<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 Olá! Bem-vindo à documentação oficial do WordPress Playground.

WordPress Playground é uma ferramenta online onde você pode testar e aprender mais sobre o WordPress. Nesta página (Documentação) você encontrará todas as informações necessárias para começar a trabalhar com o Playground.

```

<!--
:::info
This practice also helps the maintenance team identify outdated translations. When the original English content is updated, we can search the codebase for the old text (now in comments) and flag the corresponding translation for review.
:::
-->

:::info
Esta prática também ajuda a equipe de manutenção a identificar traduções desatualizadas. Quando o conteúdo original em inglês é atualizado, podemos pesquisar no código base o texto antigo (agora em comentários) e sinalizar a tradução correspondente para revisão.
:::

<!--
To find a reviewer fluent in the language of your PR, you can post a request on the [Make WordPress Polyglots blog](https://make.wordpress.org/polyglots/). Be sure to include the locale tag (e.g., #ja for Japanese) to notify the appropriate General Translation Editors (GTEs).
-->

Para encontrar um revisor fluente no idioma do seu PR, você pode postar uma solicitação no [blog Make WordPress Polyglots](https://make.wordpress.org/polyglots/). Certifique-se de incluir a tag de localidade (por exemplo, #pt-BR para Português Brasileiro) para notificar os Editores Gerais de Tradução (GTEs) apropriados.

<!--
When the PR is merged, the translated version of that page should appear under `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, if you are contributing for the first time request your [Contributor Badge](/contributing/contributor-badge).
-->

Quando o PR for mesclado, a versão traduzida dessa página deve aparecer em `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, se você está contribuindo pela primeira vez, solicite seu [Emblema de Contribuidor](/contributing/contributor-badge).
```
