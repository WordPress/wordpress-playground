---
slug: /contributing/translations
title: 翻訳への貢献 - WordPress Playground
description: ファイル構造、ローカルテスト、レビュープロセスなど、Playground ドキュメントを翻訳する方法を学びます。
---

# 翻訳への貢献

<!--
# Contributions to translations
-->

Playground のドキュメントをあらゆる言語に翻訳できます。このページでは、Playground ドキュメントの翻訳に貢献するための包括的なガイドを提供しています。

<!--
You can help translate the Playground documentation into any language. This page provides a comprehensive guide on how to contribute to the translation of Playground docs.
-->

## どうすれば翻訳に貢献できますか?

<!--
## How can I contribute to translations?
-->

他のドキュメントページへの貢献と同じワークフローを使用します。[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) をフォークして変更内容を PR として送信したり、GitHub UI を使用してページを直接編集したりできます。

<!--
By using the same workflow than contributing to any other docs page. You could fork [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and make PRs with your changes, or edit pages directly using the GitHub UI
-->

:::info
Playground Docs への貢献方法の詳細については、[貢献するにはどうすればいいですか?](/contributing/documentation#how-can-i-contribute) を参照してください。
:::

<!--
:::info
Check the [How can I contribute?](/contributing/documentation#how-can-i-contribute) to learn more about how to contribute to Playground Docs
:::
-->

## 翻訳実装の詳細

<!--
## Translations implementation details
-->

:::info
Docusaurus ウェブサイト (Playground Docs のエンジン) での翻訳管理の詳細については、Docusaurus Docs の [国際化セクション](https://docusaurus.io/docs/i18n/introduction) を参照してください。
:::

<!--
:::info
Check the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of Docusaurus Docs to learn more about translation management in a Docusaurus website (the engine behind Playground Docs).
:::
-->

Docs サイトで利用可能な言語は、`packages/docs/site/docusaurus.config.js`で定義されています。例:

<!--
Languages available for the Docs site are defined on `packages/docs/site/docusaurus.config.js`. For example:
-->

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

翻訳されたドキュメントページは、[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) リポジトリにあります。

<!--
Translated docs pages are located in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository.
-->

`packages/docs/site/i18n/` の下には、各言語用のフォルダがあります。
たとえば、`es` (スペイン語) の場合は、`packages/docs/site/i18n/es` フォルダがあります。

<!--
Under `packages/docs/site/i18n/`, there's a folder for each language.
For example, for `es` (Spanish), there's a `packages/docs/site/i18n/es` folder.
-->

各言語フォルダの下には、`docusaurus-plugin-content-docs/current` フォルダがあります。
例えば、`es` (スペイン語) の場合は、`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current` フォルダがあります。

<!--
Under each language folder, there should be a `docusaurus-plugin-content-docs/current` folder.
For example, for `es` (Spanish), there's a `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current` folder.
-->

`docusaurus-plugin-content-docs/current` の下に、元のドキュメントと同じファイル構造 (`packages/docs/site/docs` の下と同じファイル構造) が複製される必要があります。

<!--
Under `docusaurus-plugin-content-docs/current`, the same structure of files of the original docs (same structure of files as) under `packages/docs/site/docs`) should be replicated.
-->

たとえば、`es` (スペイン語) の場合、次の翻訳ファイルが存在します: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`

<!--
For example, for `es` (Spanish), the following translated files exist: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`
-->

言語のフォルダーにファイルがない場合、デフォルトの言語の元のファイルが読み込まれます。

<!--
If a file is not available under a language's folder, the original file in the default language will be loaded.
-->

新しい言語が追加されると (PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807) を参照)、`packages/docs/site` から `npm run write-translations -- --locale <%LANGUAGE%>` を実行して、特定の言語に翻訳できるメッセージを含む JSON ファイルを生成できます。

<!--
When a new language is added (see PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807)), you can run `npm run write-translations -- --locale <%LANGUAGE%>` from `packages/docs/site` to generate the JSON files containing messages that can be translated into a specific language.
-->

適切な i18n `docusaurus.config.js` 構成と `i18n` の下のファイルを使用して、プロジェクトのルートから `npm run build:docs` を実行すると、`dist` の下に各言語の特定のフォルダーが作成されます。

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

## 言語をローカルでテストする方法

<!--
## How to locally test a language
-->

既存の言語をローカルでテストするには、次のようにします。

<!--
To locally test an existing language, you can do:
-->

-   利用可能な言語のいずれかの配下のファイルを変更（翻訳）します：`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   `/packages/docs/site` から、テストしたい言語のバージョンを実行します。例えば、`es` をテストするには次のようにします。

<!--
-   Modify (translate) any file under one of the available languages: `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   From `/packages/docs/site` run the version for the language you'd like to test. For example, to test `es`:
-->

```
npm run dev:docs -- --locale es
```

## 言語スイッチャー - 言語を変更するための UI 要素

<!--
## Language Switcher - UI element to change language
-->

「言語スイッチャー」は、Docusaurus (Playground Docs の背後にあるドキュメント エンジン) によって提供される UI 要素であり、ユーザーはこれを使用して特定のページの言語を変更できます。

<!--
The "Language Switcher" is a UI element provided by Docusaurus (the docs engine behind Playground Docs) that allows users to change the language of a specific page.
-->

翻訳版の可視性を高めるには、次の行を `packages/docs/site/docusaurus.config.js` に追加して言語スイッチャーを表示できます。

<!--
To give more visibility to a translated version, the language switcher can be displayed by adding the following lines to `packages/docs/site/docusaurus.config.js`
-->

```
{
  type: 'localeDropdown',
  position: 'right',
},
```

これにより、ヘッダーにドロップダウンが生成され、各ファイルの言語バージョンに直接アクセスできるようになります。

<!--
This will generate a dropdown in the header to access directly to a language version of each file.
-->

このドロップダウンで特定の言語を有効にするのは、翻訳済みのページが十分に多い場合のみにすることを強くお勧めします。翻訳済みのページが少ない状態で有効にした場合、ユーザーはその言語に切り替えても、どのページもその言語に翻訳されないという状況に陥ります。

<!--
It's strongly recommended that a specific language is activated in this Dropdown only when there's a fair amount of pages translated. If it's activated with a few pages translated, the user's experience will be that whenever they switch to the language, no page will be translated into that language.
-->

### 言語スイッチャーで言語を公開する

<!--
### Making a language publicly available on the Language Switcher
-->

言語の i18n セットアップが完了し、`i18n` の下に正しいファイル構造が配置されると、すべての言語が利用できるようになります。

<!--
All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.
-->

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

これらの言語バージョンのドキュメントは、その言語に翻訳されたページが十分に増えるまで、言語スイッチャーでは非表示にしておく必要があります。より正確に言うと、少なくとも[ドキュメント](https://wordpress.github.io/wordpress-playground/)セクションが特定の言語に完全に翻訳され、以下のセクションも含まれている場合にのみ、言語スイッチャーでその言語を公開することをお勧めします。

<!--
These language versions of the docs should be hidden on the language switcher hidden until there's a fair amount of pages translated for that language. To be more precise, the recommendation is only to make a language publicly available on the Language Switcher when at least the [Documentation](https://wordpress.github.io/wordpress-playground/) section is completely translated for a specific language, including the following sections:
-->

-   [Quick Start Guide](/quick-start-guide)
-   [Playground web instance](/web-instance)
-   [About Playground](/about)
-   [Guides](/guides)
-   [Contributing](/contributing)
-   [Links and Resources](/resources)

<!--
-   [Quick Start Guide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Playground web instance](https://wordpress.github.io/wordpress-playground/web-instance)
-   [About Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guides](https://wordpress.github.io/wordpress-playground/guides)
-   [Contributing](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links and Resources](https://wordpress.github.io/wordpress-playground/resources)
-->

言語スイッチャーに特定の言語が表示されない場合でも、翻訳されたファイルを含む PR がマージされると翻訳されたページが公開されるため、翻訳されたページを追加する作業は引き続き進行します。

<!--
Even if the language switcher doesn't display a specific language, work on adding translated pages can still progress, as the translated pages will become publicly available once the PRs containing the translated files are merged.
-->

`fr` 言語がドキュメント ハブ ページ (クイック スタート ガイド、Playground Web インスタンス、Playground について、ガイドなど) が完全にフランス語に翻訳された最初の言語であると仮定すると、そのブランチの `docusaurus.config.js` は次のようになり、`npm run build:docs` によって `fr` サブサイトが適切に生成され、`localeDropdown` 言語スイッチャーにはフランス語のみが表示されます。

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

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

### 言語スイッチャーをローカルでテストする

<!--
### Testing the Language Switcher locally
-->

`localeDropdown` をローカルでテストしたところ、ローカルでは表示されるものの、翻訳されたページが見つからないため、期待通りに動作しないことがわかりました。しかし、本番環境では問題なく動作するようです。

<!--
Regarding testing the `localeDropdown` locally, I have found that although it is displayed locally, it doesn't work locally as expected, as the translated pages are not found. But it seems to work well in production.
-->

どのフォークからでも `localeDropdown` をテストすることができ、プロジェクトのルートから実行できます。

<!--
You can test the `localeDropdown` from any fork and do so from the root of the project:
-->

```
npm run build:docs
npm run deploy:docs
```

これにより、フォークしたリポジトリの GitHub ページに 3 つのバージョンのドキュメントが生成されます。

<!--
This generates three versions of the docs in the GitHub Pages of my forked repo:
-->

```
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/es/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/fr/
```

`localeDropdown` 機能をテストするための 1 つの方法は、それをフォークされたリポジトリの GitHub Pages にデプロイすることです。

<!--
A possible approach to testing the `localeDropdown` feature is to deploy it to the GitHub Pages of a forked repository.
-->

## 1 ページをある言語に翻訳するプロセス

<!--
## Process to translate one page into a language
-->

推奨される方法は、`.md` ファイルを元のパス (`packages/docs/site/docs`) からコピーし、目的の言語パス (`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`) に貼り付けることです。`packages/docs/site/docs` のファイル構造を複製することが重要です。

<!--
The recommended process is to copy and paste the `.md` file from the original path (`packages/docs/site/docs`) into the desired language path ( `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`). It is important to replicate the structure of files at `packages/docs/site/docs`
-->

`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` の下のファイルを翻訳し、新しい変更を PR に反映させることができます。

<!--
The file under `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` can be translated, and a PR can be created with the new changes.
-->

PR がマージされると、そのページの翻訳バージョンが https://wordpress.github.io/wordpress-playground/{%LANGUAGE%} の下に表示されます。

<!--
When the PR is merged, the translated version of that page should appear under https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}
-->

## レビュープロセス

<!--
## Review process
-->

レビューのプロセスを円滑にするために、元のコンテンツを翻訳されたコンテンツの近くにコメントしておくことをお勧めします。たとえば、次のようになります。

<!--
To facilitate the reviewing process, we do recommend keeping the original content commented close to the translated content, for example:
-->

```
<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 Olá! Bem vindo a documentação oficial do WordPress Playground.

WordPress Playground é uma ferramenta online onde podes testar e aprender mais sobre o WordPress. Nesta página(Documentação) irá encontrar todas as informações necessárias para começar a trabalhar com o Playground.

<!--
<p class="docs-hubs">The WordPress Playground documentation is distributed across four separate hubs (subsites):</p>
-->
<p class="docs-hubs">A documentação do WordPress Playground está dividida em quatro hubs(subsites):</p>
```

レビュープロセスを改善するには、PR の言語に一致するレビュアーを探してください。https://make.wordpress.org/polyglots/ に投稿し、ロケールタグ（例：日本語の場合は #ja）を付けてレビュアーを依頼してください。これにより、日本語の GTE に通知されます。

<!--
For an improved review process, find reviewers matching the PR's language. Request a reviewer by posting on https://make.wordpress.org/polyglots/ and include the locale tag (e.g., #ja for Japanese). This will notify the Japanese GTEs.
-->
