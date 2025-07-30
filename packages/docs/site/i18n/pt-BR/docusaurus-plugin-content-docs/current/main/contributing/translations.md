---
title: Contribuições para traduções
slug: /contributing/translations
---

<!--
# Contributions to translations

You can help translate the Playground documentation into any language. This page provides a comprehensive guide on how to contribute to the translation of Playground docs.
-->

# Contribuições para traduções

Você pode ajudar a traduzir a documentação do Playground para qualquer idioma. Esta página fornece um guia abrangente sobre como contribuir para a tradução da documentação do Playground.

<!--
## How can I contribute to translations?

By using the same workflow than contributing to any other docs page. You could fork [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and make PRs with your changes or edit pages directly using the GitHub UI
-->

## Como posso contribuir para as traduções?

Usando o mesmo fluxo de trabalho que contribuir para qualquer outra página de documentação. Você pode fazer um fork do [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) e criar PRs com suas alterações ou editar páginas diretamente usando a interface do GitHub.

<!--
:::info
Check the [How can I contribute?](/contributing/documentation#how-can-i-contribute) to learn more about how to contribute to Playground Docs
:::
-->

:::info
Consulte [Como posso contribuir?](/contributing/documentation#how-can-i-contribute) para saber mais sobre como contribuir para a Documentação do Playground
:::

<!--
## Translations implementation details

:::info
Check the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of Docusaurus Docs to learn more about translations management in a Docusaurus website (the engine behind Playground Docs).
:::
-->

## Detalhes de implementação das traduções

:::info
Consulte a [seção de Internacionalização](https://docusaurus.io/docs/i18n/introduction) da Documentação do Docusaurus para saber mais sobre o gerenciamento de traduções em um site Docusaurus (o motor por trás da Documentação do Playground).
:::

<!--
Languages available for the Docs site are defined on `docusaurus.config.js`. For example:
-->

Os idiomas disponíveis para o site de Documentação são definidos no `docusaurus.config.js`. Por exemplo:ff

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
Translated docs pages are located in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository.
-->

As páginas de documentação traduzidas estão localizadas no repositório [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground).

<!--
Under `packages/docs/site/i18n/` there's a folder for each language.
For example for `es` (Spanish) there's a `packages/docs/site/i18n/es` folder
-->

Sob `packages/docs/site/i18n/` há uma pasta para cada idioma.
Por exemplo, para `es` (Espanhol) há uma pasta `packages/docs/site/i18n/es`.

<!--
Under each language folder there should be a `docusaurus-plugin-content-docs/current` folder.
For example for `es` (Spanish) there's a `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current` folder.
-->

Sob cada pasta de idioma deve haver uma pasta `docusaurus-plugin-content-docs/current`.
Por exemplo, para `es` (Espanhol) há uma pasta `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current`.

<!--
Under `docusaurus-plugin-content-docs/current` the same structure of files of the original docs (same structure of files than under `packages/docs/site/docs`) should be replicated.
-->

Sob `docusaurus-plugin-content-docs/current` a mesma estrutura de arquivos da documentação original (mesma estrutura de arquivos que sob `packages/docs/site/docs`) deve ser replicada.

<!--
For example, for `es` (Spanish), the following translated files exist: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`
-->

Por exemplo, para `es` (Espanhol) existem os seguintes arquivos traduzidos: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.

<!--
If a file is not available under a language's folder, the original file in the default language will be loaded
-->

Se um arquivo não estiver disponível sob a pasta de um idioma, o arquivo original no idioma padrão será carregado.

<!--
When a new language is added (see PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807)) you can run `npm run write-translations -- --locale <%LANGUAGE%>` from `packages/docs/site` to generate the JSON files with messages that can be translated to a specific language.
-->

Quando um novo idioma é adicionado (veja PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807)) você pode executar `npm run write-translations -- --locale <%LANGUAGE%>` de `packages/docs/site` para gerar os arquivos JSON com mensagens que podem ser traduzidas para um idioma específico.

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

Com a configuração adequada do i18n no `docusaurus.config.js` e arquivos sob `i18n`, ao executar `npm run build:docs` da raiz do projeto, pastas específicas sob `dist` para cada idioma serão criadas.

<!--
## How to locally test a language

To locally test an existing language you can do:

-   Modify (translate) any file under one of the available languages: `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   From `/packages/docs/site` run the version for the language you'd like to test. For example, to test `es`:
-->

## Como testar um idioma localmente

Para testar localmente um idioma existente você pode fazer:

-   Modificar (traduzir) qualquer arquivo sob um dos idiomas disponíveis: `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   De `/packages/docs/site` execute a versão para o idioma que você gostaria de testar. Por exemplo, para testar `es`:

```
npm run dev:docs -- --locale es
```

<!--
## Language Switcher - UI element to change language

The "Language Switcher" is a UI element provided by Docusaurus (the docs engine behind Playground Docs) that allows users to change the language of a specific page.

To give more visibility to a translated version the language switcher can be displayed by adding the following lines at `docusaurus.config.js`
-->

## Seletor de Idioma - Elemento de interface para alterar o idioma

O "Seletor de Idioma" é um elemento de interface fornecido pelo Docusaurus (o motor de documentação por trás da Documentação do Playground) que permite ao usuário alterar o idioma de uma página específica.

Para dar mais visibilidade a uma versão traduzida, o seletor de idioma pode ser exibido adicionando as seguintes linhas no `docusaurus.config.js`:

```
{
  type: 'localeDropdown',
  position: 'right',
},
```

<!--
This will generate a dropdown in the header to access directly to a language version of each file.

It's strongly recommended that a specific language is activated in this Dropdown only when there's a fair amount of pages translated. If it's activated with a few pages translated, the user's experience will be that whenever they switch to the language, no page will be translated into that language.
-->

Isso gerará um menu suspenso no cabeçalho para acessar diretamente uma versão em idioma de cada arquivo.

É fortemente recomendado que um idioma específico seja ativado neste Menu Suspenso apenas quando houver uma quantidade razoável de páginas traduzidas. Se for ativado com poucas páginas traduzidas, a experiência que o usuário terá é que sempre que mudarem para o idioma, nenhuma página estará traduzida para esse idioma.

<!--
### Making a language publicly available on the Language Switcher

All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.
-->

### Tornando um idioma publicamente disponível no Seletor de Idioma

Todos os idiomas estão disponíveis quando a configuração i18n para um idioma é feita e a estrutura correta de arquivos está disponível sob `i18n`.

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

<!--
These language versions of the docs should be hidden on the language switcher hidden until there's a fair amount of pages translated for that language. To be more precise, the recommendation is to only make a language publicly available on the Language Switcher when at least the [Documentation](https://wordpress.github.io/wordpress-playground/) section is completely translated for a specific language, including the following sections:
-->

Essas versões de idioma da documentação devem ser ocultadas no seletor de idioma até que haja uma quantidade razoável de páginas traduzidas para esse idioma. Para ser mais preciso, a recomendação é tornar um idioma publicamente disponível no Seletor de Idioma apenas quando pelo menos a seção [Documentação](https://wordpress.github.io/wordpress-playground/) estiver completamente traduzida para um idioma específico, incluindo as seguintes seções:

-   [Guia de Início Rápido](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Instância web do Playground](https://wordpress.github.io/wordpress-playground/web-instance)
-   [Sobre o Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guias](https://wordpress.github.io/wordpress-playground/guides)
-   [Contribuindo](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links e Recursos](https://wordpress.github.io/wordpress-playground/resources)

<!--
Even if the language switcher doesn't display a specific language, work on adding translated pages can still progress, as the translated pages will become publicly available once the PRs containing the translated files are merged.
-->

Mesmo que o seletor de idioma não exiba um idioma específico, o trabalho de adicionar páginas traduzidas ainda pode progredir, pois as páginas traduzidas se tornarão publicamente disponíveis uma vez que os PRs contendo os arquivos traduzidos sejam mesclados.

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

Assumindo que o idioma `fr` seja o primeiro idioma com as páginas do hub de Documentação (Guia de Início Rápido, Instância web do Playground, Sobre o Playground, Guias,...) completamente traduzidas para Francês, o `docusaurus.config.js` deve ficar assim nessa branch para que `npm run build:docs` gere adequadamente o subsite `fr` e exiba apenas o idioma francês no seletor de idioma `localeDropdown`:

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
### Testing the Language Switcher locally

Regarding testing the `localeDropdown` locally, I have found that although it is displayed locally, it doesn't really work locally as expected, as the translated pages are not found. But it seems to work well in production.

You can test the `localeDropdown` from any fork and doing from the root of the project:
-->

### Testando o Seletor de Idioma localmente

Quanto ao teste do `localeDropdown` localmente, descobri que embora seja exibido localmente, ele realmente não funciona localmente como esperado, pois as páginas traduzidas não são encontradas. Mas parece funcionar bem em produção.

Você pode testar o `localeDropdown` de qualquer fork e fazendo da raiz do projeto:

```
npm run build:docs
npm run deploy:docs
```

<!--
This generates three versions of the docs in the GitHub Pages of my forked repo:
-->

Isso gera três versões da documentação nas GitHub Pages do meu repositório forkado:

```
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/es/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/fr/
```

<!--
So, a possible approach to testing the `localeDropdown` feature is by deploying it to the GitHub Pages of a forked repository.

-->

Então, uma abordagem possível para testar o recurso `localeDropdown` é implantá-lo nas GitHub Pages de um repositório forkado.

<!--
## Process to translate one page into a language

The recommended process is to copy and paste the `.md` file from the original path (`packages/docs/site/docs`) into the desired language path ( `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`). It is important to replicate the structure of files at `packages/docs/site/docs`

The file under `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` can be translated and a PR can be created with the new changes.
-->

## Processo para traduzir uma página em um idioma

O processo recomendado é copiar e colar o arquivo `.md` do caminho original (`packages/docs/site/docs`) no caminho do idioma desejado (`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`). É importante replicar a estrutura de arquivos em `packages/docs/site/docs`.

O arquivo sob `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` pode ser traduzido e um PR pode ser criado com as novas alterações.

<!--
When the PR is merged, the translated version of that page should appear under https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}
-->

Quando o PR for mesclado, a versão traduzida dessa página deve aparecer sob https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}
