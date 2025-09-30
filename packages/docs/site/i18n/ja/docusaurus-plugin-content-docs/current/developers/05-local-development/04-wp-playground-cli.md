---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

# Playground CLI

<!--
# Playground CLI
-->

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) は、WordPress の開発とテストのフローを簡素化するコマンドラインツールです。Playground CLI は、プラグイン、テーマ、または WordPress インストールを含むディレクトリの自動マウントをサポートしています。また、柔軟性が必要な場合は、CLI はローカル環境をカスタマイズするためのマウントコマンドもサポートしています。

<!--
[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment.
-->

**主な機能:**

<!--
**Key features:**
-->

-   **クイックセットアップ**: わずか数秒でローカルの WordPress 環境をセットアップできます。
-   **柔軟性**: さまざまなシナリオに合わせて設定を調整できます。
-   **シンプルな環境**: 追加の設定は不要で、互換性のある Node バージョンをインストールするだけですぐに使用できます。

<!--
-   **Quick Setup**: Set up a local WordPress environment in seconds.
-   **Flexibility**: Allows for configuration to adapt to different scenarios.
-   **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it.
-->

## 要件

<!--
## Requirements
-->

Playground CLI を使用するには、Node.js 20.18 以降が必要です。これは推奨される長期サポート (LTS) バージョンです。[Node.js ウェブサイト](https://nodejs.org/en/download) からダウンロードできます。

<!--
The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).
-->

## クイックスタート

<!--
## Quickstart
-->

Playground CLI を実行するには、コマンド ラインを開いて次のコマンドを使用します。

<!--
To run the Playground CLI, open a command line and use the following command:
-->

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI in Action](@site/static/img/developers/npx-wp-playground-server.gif)

前のコマンドでは、テスト用に新しい WordPress インスタンスしか作成されません。多くの開発者は、自分の作業をテストしたいと考えるでしょう。プラグインやテーマをテストするには、プロジェクトフォルダに移動し、`--auto-mount` フラグを付けて CLI を実行してください。

<!--
With the previous command, you only get a fresh WordPress instance to test. Most developers will want to test their own work. To test a plugin or a theme, navigate to your project folder and run the CLI with the `--auto-mount` flag:
-->

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

### WordPress と PHP のバージョンの選択

<!--
### Choosing a WordPress and PHP Version
-->

デフォルトでは、CLI はパフォーマンス向上のため、WordPress と PHP 8.3 の最新の安定バージョンを読み込みます。希望するバージョンを指定するには、フラグ`--wp=<version>`と`--php=<version>`を使用します。

<!--
By default, the CLI loads the latest stable version of WordPress and PHP 8.3 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:
-->

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.3
```

### ブループリントの読み込み

<!--
### Loading Blueprints
-->

Playground CLI 開発エクスペリエンスを次のレベルに引き上げる方法の一つは、[Blueprints](/blueprints/getting-started/) との統合です。この技術に馴染みのない方のために説明すると、開発者は WordPress Playground インスタンスの初期状態を設定できます。

<!--
One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). For those unfamiliar with this technology, it allows developers to configure the initial state for their WordPress Playground instances.
-->

`--blueprint=<blueprint-address>` フラグを使用すると、開発者はカスタム初期状態でプレイグラウンドを実行できます。以下の例でこれを行います。

<!--
Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We’ll use the example below to do this.
-->

**(my-blueprint.json)**

```bash
{
  "landingPage": "/wp-admin/options-general.php?page=akismet-key-config",
  "login": true,
  "plugins": [
    "hello-dolly",
    "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
  ]
}
```

ブループリントをロードする CLI コマンド:

<!--
CLI command loading a blueprint:
-->

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

### フォルダを手動でマウントする

<!--
### Mounting folders manually
-->

プロジェクトによっては、特殊な構造を持つため、カスタム設定が必要となる場合があります。例えば、リポジトリに `/wp-content/` フォルダ内のすべてのファイルが含まれている場合などです。このようなシナリオでは、Playground CLI に `--mount` フラグを使用して、プロジェクトをそのフォルダからマウントするように指定できます。

<!--
Some projects have a specific structure that requires a custom configuration; for example, your repository contains all the files in the `/wp-content/` folder. So in this scenario, you can specify to the Playground CLI that it will mount your project from that folder using the `--mount` flag.
-->

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

### WordPress インストール前のマウント

<!--
### Mounting before WordPress installation
-->

WordPress のインストールが始まる前に、WordPress プロジェクトファイルをマウントすることを検討してください。この方法は、Playground の起動プロセスをオーバーライドしたい場合に便利です。Playground を `WP-CLI` に接続するのに役立ちます。`--mount-before-install` フラグはこのプロセスをサポートします。

<!--
Consider mounting your WordPress project files before the WordPress installation begins. This approach is beneficial if you want to override the Playground boot process, as it can help connect Playground with `WP-CLI`. The `--mount-before-install` flag supports this process.
-->

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

:::info
Windows では、パス形式「 /host/path:/vfs/path 」が問題を引き起こす可能性があります。この問題を解決するには、「 --mount-dir 」および「 --mount-dir-before-install 」フラグを使用してください。これらのフラグを使用すると、ホストおよび仮想ファイルシステムのパスを「"/host/path"」および「"/vfs/path"」という代替形式で指定できます。
:::

<!--
:::info
On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format`"/host/path"` `"/vfs/path"`.
:::
-->

## コマンドと引数

<!--
## Command and Arguments
-->

Playground CLI はシンプルで設定しやすく、固定観念にとらわれません。WordPress の設定に合わせて自由に設定できます。Playground CLI では、以下のトップレベルコマンドを使用できます。

<!--
Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:
-->

-   **`server`**: (デフォルト) ローカルの WordPress サーバーを起動します。
-   **`run-blueprint`**: Web サーバーを起動せずに Blueprint ファイルを実行します。
-   **`build-snapshot`**: Blueprint に基づいて WordPress サイトの ZIP スナップショットを構築します。

<!--
-   **`server`**: (Default) Starts a local WordPress server.
-   **`run-blueprint`**: Executes a Blueprint file without starting a web server.
-   **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.
-->

`server` コマンドは次のオプション引数をサポートしています。

<!--
The `server` command supports the following optional arguments:
-->

-   `--port=<port>`: サーバーが listen するポート番号。デフォルトは 9400 です。
-   `--outfile`: ビルド時にこの出力ファイルに書き込みます。
-   `--wp=<version>`: 使用する WordPress のバージョン。デフォルトは最新です。
-   `--auto-mount`: 現在のディレクトリ (プラグイン、テーマ、wp-content など) を自動的にマウントします。
-   `--mount=<mapping>`: ディレクトリを手動でマウントします (複数回使用可能)。形式: `"/host/path:/vfs/path"`。
-   `--mount-before-install`: WordPress をインストールする前に、ディレクトリを PHP ランタイムにマウントします (複数回使用可能)。形式: `"/host/path:/vfs/path"`。
-   `--mount-dir`: ディレクトリを PHP ランタイムにマウントします (複数回使用可能)。フォーマット: `"/host/path"` `"/vfs/path"`
-   `--mount-dir-before-install`: WordPress をインストールする前にディレクトリをマウントします（複数回使用可能）。フォーマット: `"/host/path"` `"/vfs/path"`
-   `--blueprint=<path>`: 実行する JSON ブループリント ファイルへのパス。
-   `--blueprint-may-read-adjacent-files`: 同意フラグ: ローカル ブループリント内の「バンドル」リソースが、ブループリント ファイルと同じディレクトリにあるファイルを読み取ることを許可します。
-   `--login`: ユーザーを管理者として自動的にログインします。
-   `--skip-wordpress-setup`: WordPress をダウンロードまたはインストールしません。WordPress ディレクトリ全体をマウントする場合に便利です。
-   `--skip-sqlite-setup`: SQLite データベース統合をセットアップしません。
-   `--verbosity`: ログと進捗メッセージを出力します。選択肢は「quiet」、「normal」、「debug」です。デフォルトは「normal」です。
-   `--debug`: 起動中にエラーが発生した場合、PHP のエラーログを出力します。

<!--
-   `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
-   `--outfile`: When building, write to this output file.
-   `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
-   `--auto-mount`: Automatically mount the current directory (plugin, theme, wp-content, etc.).
-   `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: `"/host/path:/vfs/path"`.
-   `--mount-before-install`: Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: `"/host/path:/vfs/path"`.
-   `--mount-dir`: Mount a directory to the PHP runtime (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`.
-   `--mount-dir-before-install`: Mount a directory before WordPress installation (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`
-   `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
-   `--blueprint-may-read-adjacent-files`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
-   `--login`: Automatically log the user in as an administrator.
-   `--skip-wordpress-setup`: Do not download or install WordPress. Useful if you are mounting a full WordPress directory.
-   `--skip-sqlite-setup`: Do not set up the SQLite database integration.
-   `--verbosity`: Output logs and progress messages. Choices are "quiet", "normal" or "debug". Defaults to "normal".
-   `--debug`: Print the PHP error log if an error occurs during boot.
-->

## CLI に関するサポートが必要ですか?

<!--
## Need some help with the CLI?
-->

Playground CLI では、`--help` フラグを使用して、使用可能なコマンドと引数の完全なリストを取得できます。

<!--
With the Playground CLI, you can use the `--help` flag to get the full list of available commands and arguments.
-->

```bash
npx @wp-playground/cli@latest --help
```

## JavaScript によるプログラム的使用

<!--
## Programmatic Usage with JavaScript
-->

Playground CLI は、`runCLI` 関数を使って JavaScript/TypeScript コードからプログラム的に制御することもできます。これにより、コード内のすべての CLI 機能に直接アクセスできるため、エンドツーエンドテストの自動化に役立ちます。`runCLI` の使い方の基本を説明しましょう。

<!--
The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. Let's cover the basics of using `runCLI`.
-->

### 特定のバージョンで WordPress インスタンスを実行する

<!--
### Running a WordPress instance with a specific version
-->

`runCLI` 関数を使用すると、PHP や WordPress のバージョンなどのオプションを指定できます。以下の例では、WordPress の最新バージョンである PHP 8.3 を要求し、自動的にログインするように設定しています。サポートされているすべての引数は `RunCLIArgs` 型で定義されています。

<!--
Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type.
-->

```TypeScript
import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true
} as RunCLIArgs);
```

上記のコードを実行するには、開発者は好みの方法を設定できます。このコードを実行する簡単な方法は、`.ts` ファイルとして保存し、`tsx` などのツールで実行することです。例: `tsx my-script.ts`

<!--
To execute the code above, the developer can set their preferred method. A simple way to execute this code is to save it as a `.ts` file and run it with a tool like `tsx`. For example: `tsx my-script.ts`
-->

### ブループリントの設定

<!--
### Setting a Blueprint
-->

ブループリントは、`blueprint` プロパティに直接渡されるオブジェクトリテラルとして、または外部の `.json` ファイルへのパスを含む文字列として、2 つの方法で提供できます。

<!--
You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file.
-->

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
  command: 'server',
  wp: 'latest',
  blueprint: {
    steps: [
        {
          "step": "setSiteOptions",
          "options": {
              "blogname": "Blueprint Title",
              "blogdescription": "A great blog description"
          }
        }
    ],
  },
});
```

ブループリント オブジェクトを定義するときに完全な型安全性を確保するには、`@wp-playground/blueprints` パッケージから `BlueprintDeclaration` 型をインポートして使用できます。

<!--
For full type-safety when defining your blueprint object, you can import and use the `BlueprintDeclaration` type from the `@wp-playground/blueprints` package:
-->

```TypeScript
import type { BlueprintDeclaration } from '@wp-playground/blueprints';

const myBlueprint: BlueprintDeclaration = {
  landingPage: "/wp-admin/",
  steps: [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwentyone"
      },
      "options": {
        "activate": true
      }
    }
  ]
};
```

### プログラムによるプラグインのマウント

<!--
### Mounting a plugin programmatically
-->

`runCLI` を使用することで、プログラム的にローカルディレクトリをマウントできます。`mount` および `mount-before-install` オプションが利用可能です。`hostPath` プロパティには、ローカルマシン上のディレクトリへのパスを指定します。このパスは、スクリプトが実行される場所からの相対パスである必要があります。

<!--
It is possible to mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. This path should be relative to where your script is being executed.
-->

```TypeScript
	cliServer = await runCLI({
      command: 'server',
      login: true,
      'mount-before-install': [
        {
          hostPath: './[my-plugin-local-path]',
          vfsPath: '/wordpress/wp-content/plugins/my-plugin',
        },
      ],
    });
```

これらのオプションを使用すると、プロジェクトの取り付け部分をブループリントと組み合わせることができます。例:

<!--
With those options we can combine mounting parts of the project with blueprints, for example:
-->

```TypeScript

import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true,
    mount: [
        {
            "hostPath": "./plugin/",
            "vfsPath": "/wordpress/wp-content/plugins/playwright-test"
        }
    ],
    blueprint: {
        steps: [
            {
                "step": "activatePlugin",
                "pluginPath": "/wordpress/wp-content/plugins/playwright-test/plugin-playwright.php"
            }
        ]
    }
} as RunCLIArgs);
```
