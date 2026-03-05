---
slug: /developers/architecture/wasm-php-compiling
---

# PHPのコンパイル

<!--
# Compiling PHP
-->

ビルドパイプラインは[`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile)に格納されています。これは元々[seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)からフォークされたものです。

<!--
The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)
-->

大まかに言うと、その `Dockerfile` は次のようになります。

<!--
In broad strokes, that `Dockerfile`:
-->

- 必要な Linux パッケージ（`build-essential` など）をすべてインストールします。
- PHP と必要なライブラリ（`sqlite3` など）をダウンロードします。
- いくつかのパッチを適用します。
- C コンパイラの代替となる [Emscripten](https://emscripten.org/) を使用してすべてをコンパイルします。
- JavaScript 用の便利な API である `php_wasm.c` をコンパイルします。
- 設定に応じて、`php.wasm` ファイルと 1 つ以上の JavaScript ローダーを出力します。
- Emscripten のデフォルトの `php.js` 出力を、追加機能を備えた ESM モジュールに変換します。

<!--
-   Installs all the necessary linux packages (like `build-essential`)
-   Downloads PHP and the required libraries, e.g. `sqlite3`.
-   Applies a few patches.
-   Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
-   Compiles `php_wasm.c` – a convenient API for JavaScript.
-   Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
-   Transforms the Emscripten's default `php.js` output into an ESM module with additional features.
-->

各ステップの詳細については、[Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile) を直接参照してください。

<!--
To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile).
-->

### ビル

<!--
### Building
-->

すべての PHP バージョンをビルドするには、リポジトリのルートで`nx recompile-php:all php-wasm-web`（または`php-wasm-node`）を実行してください。出力ファイルは`packages/php-wasm/php-web/public`にあります。特定のバージョンをビルドするには、`nx recompile-php:all php-wasm-node --PHP_VERSION=8.0 --WITH_JSPI=yes`（`--WITH_JSPI=no`で繰り返します）を実行してください。

<!--
To build all PHP versions, run `nx recompile-php:all php-wasm-web` (or `php-wasm-node`) in the repository root. You'll find the output files in `packages/php-wasm/php-web/public`. To build a specific version, run `nx recompile-php:all php-wasm-node --PHP_VERSION=8.0 --WITH_JSPI=yes` (and repeat with `--WITH_JSPI=no`).
-->

### PHP 拡張機能

<!--
### PHP extensions
-->

PHP は、[`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile) にリストされているいくつかの拡張機能を使用して構築されています。

<!--
PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile).
-->

`zip` のような一部の拡張機能は、ビルド中にオン/オフを切り替えることができます。`sqlite3` のような拡張機能はハードコードされています。

<!--
Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded.
-->

ハードコードされた拡張機能のいずれかをオフにする必要がある場合は、このリポジトリで問題を報告してください。さらに、このプロジェクトには貢献者が必要です。PR を開いて必要な変更を投稿していただければ幸いです。

<!--
If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.
-->

### JavaScript に公開された C API

<!--
### C API exposed to JavaScript
-->

JavaScript に公開されている C API は[`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c)ファイルにあります。最も重要な関数は以下のとおりです。

<!--
The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are:
-->

- `void phpwasm_init()` – 新しい PHP コンテキストを作成します。 PHP コードを実行する前に必ず呼び出してください。
- `int phpwasm_run(char *code)` – PHP スクリプトを実行し、出力を /tmp/stdout と /tmp/stderr に書き込みます。終了コードを返します。
- `void phpwasm_refresh()` – 現在の PHP コンテキストを破棄し、新しいコンテキストを開始します。PHP スクリプトを1つ実行した後、次のスクリプトを実行する前に呼び出してください。

<!--
-   `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
-   `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
-   `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another.
-->

詳細については、[`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) のインラインドキュメントを参照してください。

<!--
Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more.
-->

### ビルド構成

<!--
### Build configuration
-->

ビルドは[Docker `--build-arg`機能](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg)を介して設定できます。`build.js`スクリプトを通じて設定できます。以下のコマンドを実行すると使用方法が表示されます。

<!--
The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message:
-->

```sh
nx recompile-php php-wasm-web
```

**サポートされているビルド オプション:**

<!--
**Supported build options:**
-->

- `PHP_VERSION` – ビルドする PHP バージョン。デフォルト: `8.0.24`。`PHP-` をプレフィックスとして指定する場合、この値は https://github.com/php/php-src.git リポジトリの既存のブランチを指している必要があります。例えば、`7.4.0` は `PHP-7.4.0` ブランチが存在するため有効ですが、`7` のみは `PHP-7` ブランチが存在しないため無効です。動作が確認されている PHP バージョンは `7.4.*` と `8.0.*` です。他のバージョンも動作する可能性はありますが、まだ試していません。
- `EMSCRIPTEN_ENVIRONMENT` – `web` または `node`。デフォルト: `web`。ビルド対象のプラットフォーム。`web` 用にビルドする場合、`php-web.js` と `php-webworker.js` という 2 つの JavaScript ローダーが作成されます。 Node.js 用にビルドする場合、`php-node.js` というローダーが 1 つだけ作成されます。
- `WITH_LIBXML` – `yes` または `no`、デフォルト: `no`。`libxml2` と `dom`、`xml`、`simplexml` PHP 拡張モジュール (`DOMDocument`、`SimpleXML` など) を使用してビルドするかどうかを指定します。
- `WITH_LIBZIP` – `yes` または `no`、デフォルト: `yes`。`zlib`、`libzip`、`zip` PHP 拡張モジュール (`ZipArchive`) を使用してビルドするかどうかを指定します。
- `WITH_NODEFS` – `yes` または `no`、デフォルト: `no`。 [Emscripten の NODEFS JavaScript ライブラリ](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs) を含めるかどうか。これは、Node.js から php.wasm を実行する際に、ローカルファイルシステムからファイルを読み込み、ディレクトリをマウントするのに便利です。

<!--
-   `PHP_VERSION` – The PHP version to build, default: `8.0.24`. This value must point to an existing branch of the https://github.com/php/php-src.git repository when prefixed with `PHP-`. For example, `7.4.0` is valid because the branch `PHP-7.4.0` exists, but just `7` is invalid because there's no branch `PHP-7`. The PHP versions that are known to work are `7.4.*` and `8.0.*`. Others likely work as well but they haven't been tried.
-   `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
-   `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
-   `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
-   `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.
-->
