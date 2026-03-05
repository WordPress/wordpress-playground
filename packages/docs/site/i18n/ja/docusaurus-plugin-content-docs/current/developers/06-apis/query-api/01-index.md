---
sidebar_position: 5
slug: /developers/apis/query-api
description: このページでは、URL クエリ パラメータを使用して WP インスタンスを構成できる WordPress Playground クエリ API について詳しく説明します。
---

# クエリー API

<!--
# Query API
-->

WordPress Playground は、ブラウザで Playground を構成するために使用できるシンプルな API を公開しています。

<!--
WordPress Playground exposes a simple API that you can use to configure the Playground in the browser.
-->

これは、設定オプションをクエリパラメータとして Playground URL に渡すことで機能します。例えば、pendant テーマをインストールするには、次の URL を使用します。

<!--
It works by passing configuration options as query parameters to the Playground URL. For example, to install the pendant theme, you would use the following URL:
-->

```text
https://playground.wordpress.net/?theme=pendant
```

ぜひお試しください。Playground が自動的にテーマをインストールし、管理者としてログインします。`<iframe>`タグを使って、この URL をウェブサイトに埋め込むこともできます。

<!--
You can go ahead and try it out. The Playground will automatically install the theme and log you in as an admin. You may even embed this URL in your website using an `<iframe>` tag:
-->

```html
<iframe src="https://playground.wordpress.net/?theme=pendant"></iframe>
```

## 利用可能なオプション

<!--
## Available options
-->

| オプション      | デフォルト値          | 説明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`           | `8.0`                 | 指定された PHP バージョンをロードします。 `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` or `latest`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wp`            | `latest`              | 指定された WordPress バージョンを読み込みます。直近 3 つのメジャー WordPress バージョンに対応しています。2024 年 6 月 1 日時点では、`6.3`、`6.4`、`6.5`が該当します。また、汎用的な値として`latest`、`nightly`、`beta`も使用できます。                                                                                                                                                                                                                                                                              |
| `blueprint-url` |                       | この Playground インスタンスを構成するために使用されるブループリントの URL。                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `networking`    | `yes`                 | Playground のネットワークサポートを有効または無効にします。`yes` または `no` を指定します。                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `plugin`        |                       | 指定されたプラグインをインストールします。プラグイン名は WordPress プラグインディレクトリの URL から取得してください。例えば、URL が「https://wordpress.org/plugins/wp-lazy-loading/」の場合、プラグイン名は「wp-lazy-loading」になります。「plugin=coblocks&plugin=wp-lazy-loading&…」と指定することで、複数のプラグインを事前にインストールできます。プラグインをインストールすると、ユーザーは自動的に管理者としてログインします。URL の「plugin」属性を繰り返すだけで、複数のプラグインをインストールできます。 |
| `theme`         |                       | 指定されたテーマをインストールします。テーマ名は WordPress テーマディレクトリの URL から取得してください。例えば、URL が「https://wordpress.org/themes/disco/」の場合、テーマ名は「disco」になります。テーマをインストールすると、ユーザーは自動的に管理者としてログインします。URLに「theme」属性を繰り返すだけで、複数のテーマをインストールできます。                                                                                                                                                            |
| `url`           | `/wp-admin/`          | この Playground インスタンスに指定された初期 WordPress ページを読み込みます。                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `mode`          | `browser-full-screen` | WordPress インスタンスの表示方法を指定します。ブラウザ UI にラップするか、シームレスにフルスクリーンで表示するかを選択します。`browser-full-screen` または `seamless` を指定できます。                                                                                                                                                                                                                                                                                                                              |
| `lazy`          |                       | Playground アセットの読み込みを、「実行」ボタンがクリックされるまで延期します。値は指定できません。URL パラメータに「lazy」を追加した場合、読み込みは延期されます。                                                                                                                                                                                                                                                                                                                                                 |
| `login`         | `yes`                 | ユーザーを管理者としてログインします。「はい」または「いいえ」で受け付けます。                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `multisite`     | `no`                  | WordPress マルチサイトモードを有効にします。`yes` または `no` を指定します。                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `import-site`   |                       | URL で指定された ZIP ファイルからサイト ファイルとデータベースをインポートします。                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `import-wxr`    |                       | URL で指定された WXR ファイルからサイトコンテンツをインポートします。WordPress Importer プラグインを使用するため、デフォルトの管理者ユーザーでログインする必要があります。                                                                                                                                                                                                                                                                                                                                          |
| `site-slug`     |                       | ブラウザのストレージから読み込むサイトを選択します。指定されたサイトが存在しない場合、指定されたスラッグで新しいサイトを保存するようユーザーに促されます。                                                                                                                                                                                                                                                                                                                                                          |
| `language`      | `en_US`               | WordPress インスタンスのロケールを設定します。これは `networking=yes` と組み合わせて使用 ​​ する必要があります。そうしないと、WordPress は翻訳をダウンロードできません。                                                                                                                                                                                                                                                                                                                                            |
| `core-pr`       |                       | https://github.com/WordPress/wordpress-develop の特定のコア PR をインストールします。PR 番号を指定します。例: `core-pr=6883`。                                                                                                                                                                                                                                                                                                                                                                                      |
| `gutenberg-pr`  |                       | https://github.com/WordPress/gutenberg の特定の PR をインストールします。PR 番号を指定します。例：`gutenberg-pr=65337`。                                                                                                                                                                                                                                                                                                                                                                                            |

<!--
| Option                   | Default Value         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`                    | `8.0`                 | Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` or `latest`.                                                                                                                                                                                                                                                                                                                                                  |
| `wp`                     | `latest`              | Loads the specified WordPress version. Accepts the last three major WordPress versions. As of June 1, 2024, that's `6.3`, `6.4`, or `6.5`. You can also use the generic values `latest`, `nightly`, or `beta`.                                                                                                                                                                                                                                                              |
| `blueprint-url`          |                       | The URL of the Blueprint that will be used to configure this Playground instance.                                                                                                                                                                                                                                                                                                                                                                                           |
| `networking`             | `yes`                 | Enables or disables the networking support for Playground. Accepts `yes` or `no`.                                                                                                                                                                                                                                                                                                                                                                                           |
| `plugin`                 |                       | Installs the specified plugin. Use the plugin name from the WordPress Plugins Directory URL. For example, if the URL is `https://wordpress.org/plugins/wp-lazy-loading/`, the plugin name would be `wp-lazy-loading`. You can pre-install multiple plugins by saying `plugin=coblocks&plugin=wp-lazy-loading&…`. Installing a plugin automatically logs the user in as an admin. More than one plugin could be installed, just repeating the `plugin` attribute on the URL. |
| `theme`                  |                       | Installs the specified theme. Use the theme name from the WordPress Themes Directory URL. For example, if the URL is `https://wordpress.org/themes/disco/`, the theme name would be `disco`. Installing a theme automatically logs the user in as an admin. Multiples themes could be installed just repeating the `theme` attribute on the URL.                                                                                                                            |
| `url`                    | `/wp-admin/`          | Load the specified initial WordPress page in this Playground instance.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `mode`                   | `browser-full-screen` | Determines how the WordPress instance is displayed. Either wrapped in a browser UI or full width as a seamless experience. Accepts `browser-full-screen`, or `seamless`.                                                                                                                                                                                                                                                                                                    |
| `lazy`                   |                       | Defer loading the Playground assets until someone clicks on the "Run" button. Does not accept any values. If `lazy` is added as a URL parameter, loading will be deferred.                                                                                                                                                                                                                                                                                                  |
| `login`                  | `yes`                 | Log the user in as an admin. Accepts `yes` or `no`.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `multisite`              | `no`                  | Enables the WordPress multisite mode. Accepts `yes` or `no`.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `import-site`            |                       | Imports site files and database from a ZIP file specified by a URL.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `import-wxr`             |                       | Imports site content from a WXR file specified by a URL. It uses the WordPress Importer plugin, so the default admin user must be logged in.                                                                                                                                                                                                                                                                                                                                |
| `site-slug`              |                       | Selects which site to load from browser storage.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `language`               | `en_US`               | Sets the locale for the WordPress instance. This must be used in combination with `networking=yes` otherwise WordPress won't be able to download translations.                                                                                                                                                                                                                                                                                                              |
| `core-pr`                |                       | Installs a specific https://github.com/WordPress/wordpress-develop core PR. Accepts the PR number. For example, `core-pr=6883`.                                                                                                                                                                                                                                                                                                                                             |
| `gutenberg-pr`           |                       | Installs a specific https://github.com/WordPress/gutenberg PR. Accepts the PR number. For example, `gutenberg-pr=65337`.                                                                                                                                                                                                                                                                                                                                                    |
| `if-stored-site-missing` |                       | Indicates how to handle the scenario where the `site-slug` parameter identifies a site that does not exist. Use `if-stored-site-missing=prompt` to indicate that the user should be asked whether they would like to save a new site with the specified `site-slug`.                                                                                                                                                                                                        |
-->

たとえば、次のコードは、プリインストールされた Gutenberg プラグインを含む Playground を埋め込み、投稿エディターを開きます。

<!--
For example, the following code embeds a Playground with a preinstalled Gutenberg plugin and opens the post editor:
-->

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```

:::info CORS ポリシー

サイトの ZIP パッケージなどの URL からファイルをインポートするには、`Access-Control-Allow-Origin` ヘッダーを設定した状態で提供する必要があります。参考資料として、[クロスオリジンリソース共有（CORS）](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers)をご覧ください。

:::

<!--
:::info CORS policy

To import files from a URL, such as a site zip package, they must be served with `Access-Control-Allow-Origin` header set. For reference, see: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).

:::
-->

## GitHub エクスポート オプション

<!--
## GitHub Export Options
-->

次の追加のクエリ パラメータを使用して、GitHub エクスポート フォームを事前構成できます。

<!--
The following additional query parameters may be used to pre-configure the GitHub export form:
-->

- `gh-ensure-auth`: `yes` に設定すると、Playground は続行する前にユーザーが GitHub で認証されていることを確認するためのモーダルを表示します。
- `ghexport-repo-url`: エクスポート先の GitHub リポジトリの URL。
- `ghexport-pr-action`: エクスポート時に実行するアクション (作成または更新)。
- `ghexport-playground-root`: エクスポート元の Playground のルートディレクトリ。
- `ghexport-repo-root`: エクスポート先のリポジトリのルートディレクトリ。
- `ghexport-content-type`: エクスポートのコンテンツタイプ (plugin、theme、wp-content、custom-paths)。
- `ghexport-plugin`: プラグインのパス。コンテンツタイプが `plugin` の場合、エクスポートするプラグインを事前に選択します。
- `ghexport-theme`: テーマのディレクトリ名。コンテンツタイプが「theme」の場合、エクスポートするテーマを事前に選択します。
- `ghexport-path`: `ghexport-playground-root` からの相対パス。複数回指定できます。
  コンテンツタイプが「custom-paths」の場合、エクスポートするパスのリストが事前に入力されます。
- `ghexport-commit-message`: エクスポート時に使用するコミットメッセージ。
- `ghexport-allow-include-zip`: GitHub エクスポートに zip ファイルを含めるオプションを提供するかどうか (yes、no)。オプション。デフォルトは「yes」です。

<!--
-   `gh-ensure-auth`: If set to `yes`, Playground will display a modal to ensure the
    user is authenticated with GitHub before proceeding.
-   `ghexport-repo-url`: The URL of the GitHub repository to export to.
-   `ghexport-pr-action`: The action to take when exporting (create or update).
-   `ghexport-playground-root`: The root directory in the Playground to export from.
-   `ghexport-repo-root`: The root directory in the repository to export to.
-   `ghexport-content-type`: The content type of the export (plugin, theme, wp-content, custom-paths).
-   `ghexport-plugin`: Plugin path. When the content type is `plugin`, pre-select the plugin to export.
-   `ghexport-theme`: Theme directory name. When the content type is `theme`, pre-select the theme to export.
-   `ghexport-path`: A path relative to `ghexport-playground-root`. Can be provided multiple times. When the
    content type is `custom-paths`, it pre-populates the list of paths to export.
-   `ghexport-commit-message`: The commit message to use when exporting.
-   `ghexport-allow-include-zip`: Whether to offer an option to include a zip file in the GitHub
    export (yes, no). Optional. Defaults to `yes`.
-->
