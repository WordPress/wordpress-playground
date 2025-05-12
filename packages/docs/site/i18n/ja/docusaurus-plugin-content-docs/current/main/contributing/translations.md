---
slug: /contributing/translations
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

他のドキュメントページへの貢献と同じワークフローを使用します。[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) をフォークして変更内容をプルリクエストとして送信したり、GitHub UI を使用してページを直接編集したりできます。

<!--
By using the same workflow than contributing to any other docs page. You could fork [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and make PRs with your changes or edit pages directly using the GitHub UI
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
Check the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of Docusaurus Docs to learn more about translations management in a Docusaurus website (the engine behind Playground Docs).
:::
-->

Docs サイトで利用可能な言語は、`docusaurus.config.js`で定義されています。例:

<!--
Languages available for the Docs site are defined on `docusaurus.config.js`. For example:
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
例えば、`es` (スペイン語) の場合は `packages/docs/site/i18n/es` フォルダがあります。

<!--
Under `packages/docs/site/i18n/` there's a folder for each language.
For example for `es` (Spanish) there's a `packages/docs/site/i18n/es` folder
-->

各言語フォルダの下には、`docusaurus-plugin-content-docs/current` フォルダがあります。
例えば、`es` (スペイン語) の場合は、`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current` フォルダがあります。

<!--
Under each language folder there should be a `docusaurus-plugin-content-docs/current` folder.
For example for `es` (Spanish) there's a `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current` folder.
-->

`docusaurus-plugin-content-docs/current` の下に、元のドキュメントと同じファイル構造 (`packages/docs/site/docs` の下と同じファイル構造) が複製される必要があります。

<!--
Under `docusaurus-plugin-content-docs/current` the same structure of files of the original docs (same structure of files than under `packages/docs/site/docs`) should be replicated.
-->

たとえば、`es` (スペイン語) の場合、次の翻訳ファイルが存在します: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`

<!--
For example for `es` (Spanish) the following translated files exists: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`
-->

言語のフォルダにファイルがない場合、デフォルトの言語の元のファイルが読み込まれます。

<!--
If a file is not available under a language's folder the original file in the default language will be loaded
-->

新しい言語が追加されると (PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807) を参照)、`packages/docs/site` から `npm run write-translations -- --locale <%LANGUAGE%>` を実行して、特定の言語に翻訳できるメッセージを含む JSON ファイルを生成できます。

<!--
When a new language is added (see PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807)) you can run `npm run write-translations -- --locale <%LANGUAGE%>` from `packages/docs/site` to generate the JSON files with messages that can be translated to a specific language.
-->

適切な i18n の `docusaurus.config.js` 構成と `i18n` の下のファイルを使用すると、プロジェクトのルートから `npm run build:docs` を実行すると、`dist` の下に各言語の特定のフォルダーが作成されます。

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project specific folders under `dist` for each language will be created.
-->

## 言語をローカルでテストする方法

<!--
## How to locally test a language
-->

既存の言語をローカルでテストするには、次の操作を実行します。

<!--
To locally test an existing language you can do:
-->

-   利用可能な言語のいずれかの配下のファイルを変更（翻訳）します：`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   `/packages/docs/site` から、テストしたい言語のバージョンを実行します。例えば、`es` をテストするには、次のようにします。

<!--
-   Modify (translate) any file under one of the available languages: `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   From `/packages/docs/site` run the version for the language you'd like to test. For example to test `es`:
-->

```
npm run dev -- --locale es
```

## 言語スイッチャー - 言語を変更するための UI 要素

<!--
## Language Switcher - UI element to change language
-->

「言語スイッチャー」は、docusaurus (Playground Docs の背後にあるドキュメント エンジン) によって提供される UI 要素であり、ユーザーはこれを使用して特定のページの言語を変更できます。

<!--
The "Language Switcher" is a UI element provided by docusaurus (the docs engine behind Playground Docs) that allows user to change the language of a specific page.
-->

翻訳版の可視性を高めるために、`docusaurus.config.js` に次の行を追加することで言語スイッチャーを表示できます。

<!--
To give more visibility to a translated version the language switcher can be displayed by adding the following lines at `docusaurus.config.js`
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

このドロップダウンで特定の言語を選択するのは、翻訳済みのページがかなり多い場合のみにすることを強くお勧めします。翻訳済みのページが少ない状態で選択すると、ユーザーがその言語を選択しても、どのページもその言語に翻訳されないという状況に陥ります。

<!--
It's strongly recommended that a specific language is activated in this Dropdown only when there's a fair amount of pages translated. If it's activated with few pages translated the experience the user will get is that whenever they change to the language no page will be translated to that language.
-->

### 言語スイッチャーで言語を公開する

<!--
### Making a language publicly available on the Language Switcher
-->

言語の i18n セットアップが完了し、正しいファイル構造が `i18n` で利用できる場合は、すべての言語が利用可能になります。

<!--
All languages are available when the i18n setup for a language is done and the correct structure of files is available under `i18n`.
-->

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

これらの言語バージョンのドキュメントは、その言語に翻訳されたページが十分に増えるまで、言語スイッチャーでは非表示にしておく必要があります。より正確に言うと、少なくとも[ドキュメント](https://wordpress.github.io/wordpress-playground/)セクションが特定の言語に完全に翻訳され、以下のセクションも含まれている場合にのみ、言語スイッチャーでその言語を公開することをお勧めします。

<!--
These language versions of the docs should be hidden on the language switcher hidden until there's a fair amount of pages translated for that language. To be more precise, the recommendation is to only make a language publicly available on the Language Switcher when at least the [Documentation](https://wordpress.github.io/wordpress-playground/) section is completely translated for a specific language including the following sections:
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

`fr` 言語がドキュメントハブページ (クイックスタートガイド、Playground ウェブインスタンス、Playground について、ガイドなど) が完全にフランス語に翻訳された最初の言語であると仮定すると、そのブランチの `docusaurus.config.js` は次のようになり、`npm run build:docs` は `fr` サブサイトを適切に生成し、`localeDropdown` 言語スイッチャーにフランス語のみを表示します。

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher
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
Regarding testing the `localeDropdown` locally, I have found that although is displayed locally it doesn't really work locally as expected as the translated pages are not found. But it seems to work well in production.
-->

任意のフォークから `localeDropdown` をテストし、プロジェクトのルートから実行できます。

<!--
You can test the `localeDropdown` from any fork and doing from the root of the project:
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

したがって、`localeDropdown` 機能をテストするための可能なアプローチは、それをフォークされたリポジトリの GitHub Pages にデプロイすることです。

<!--
So, a possible approach to testing the `localeDropdown` feature is by deploying it to the GitHub Pages of a forked repository.
-->

## ある言語で 1 ページを翻訳するプロセス

<!--
## Process to translate one page in a language
-->

推奨される方法は、`.md` ファイルを元のパス (`packages/docs/site/docs`) からコピーし、目的の言語パス (`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`) に貼り付けることです。`packages/docs/site/docs` のファイル構造を複製することが重要です。

<!--
The recommended process is to copy and paste the `.md` file from the original path (`packages/docs/site/docs`) into the desired language path ( `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`). It is important to replicate the structure of files at `packages/docs/site/docs`
-->

`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` の下のファイルを翻訳し、新しい変更を PR に反映させることができます。

<!--
The file under `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` can be translated and a PR can be created with the new changes.
-->

PR がマージされると、そのページの翻訳バージョンが https://wordpress.github.io/wordpress-playground/{%LANGUAGE%} の下に表示されます。

<!--
When the PR is merged the translated version of that page should appear under https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}
-->
