---
slug: /developers/architecture/wasm-php-overview
---

# WebAssembly PHP

<!--
# WebAssembly PHP
-->

WordPress Playground は、[Emscripten](https://emscripten.org/docs/porting/networking.html) と [専用パイプライン](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile) を使用して [PHP インタープリター](https://github.com/php/php-src) を WebAssembly にビルドします。

<!--
WordPress Playground build [the PHP interpreter](https://github.com/php/php-src) to WebAssembly using [Emscripten](https://emscripten.org/docs/porting/networking.html) and a [dedicated pipeline](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile).
-->

![Building C programs to WebAssembly](@site/static/img/c-programs-general.png)

PHP から WebAssembly へのビルドは、通常の PHP のビルドと非常に似ています。wasm ビルドでは、[ここで関数シグネチャを調整する](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php7.1.patch#L8-L9)、[そこで設定変数を強制する](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile#L495)、[いくつかの小さなパッチ](https://github.com/WordPress/wordpress-playground/tree/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets) がありますが、調整が必要な箇所は比較的少ないです。

<!--
Building PHP to WebAssembly is very similar to building vanilla PHP. The wasm build required [adjusting a function signature here](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php7.1.patch#L8-L9), [forcing a config variable there](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile#L495), and applying [a few small patches](https://github.com/WordPress/wordpress-playground/tree/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets), but there's relatively few adjustments involved.
-->

![Building PHP to WebAssembly](@site/static/img/c-programs-php.png)

しかし、PHP の標準ビルドはブラウザではあまり役に立ちません。サーバーソフトウェアである PHP には、リクエストボディを渡したり、ファイルをアップロードしたり、`php://stdin`ストリームにデータを入力したりするためのJavaScript API がありません。WordPress Playground では、これをゼロから構築する必要がありました。 WebAssembly バイナリには、C で記述された [専用の PHP API モジュール](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php_wasm.c) と、writeFile() や run() などのメソッドを公開する [JavaScript PHP クラス](https://github.com/WordPress/wordpress-playground/blob/da38192af57a95699d8731c855b82ac0222df61b/packages/php-wasm/common/src/lib/php.ts) が付属しています。

<!--
However, vanilla PHP builds aren't very useful in the browser. As a server software, PHP doesn't have a JavaScript API to pass the request body, upload files, or populate the `php://stdin` stream. WordPress Playground had to build one from scratch. The WebAssembly binary comes with a [dedicated PHP API module](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php_wasm.c) written in C and a [JavaScript PHP class](https://github.com/WordPress/wordpress-playground/blob/da38192af57a95699d8731c855b82ac0222df61b/packages/php-wasm/common/src/lib/php.ts) that exposes methods like writeFile() or run().
-->

PHP のバージョンはすべて静的な.wasm ファイルなので、PHP バージョンスイッチャーは実はかなり退屈です。ブラウザに、例えば`php_8_2.wasm`ではなく`php_7_3.wasm`をダウンロードするように指示するだけです。

<!--
Because every PHP version is just a static .wasm file, the PHP version switcher is actually pretty boring. It simply tells the browser to download, for example, `php_7_3.wasm` instead of, say, `php_8_2.wasm`.
-->

![Building different versions of PHP to WebAssembly](@site/static/img/c-programs-php-versions.png)

### ネットワークサポートはプラットフォームによって異なります

<!--
### Networking support varies between platforms
-->

ネットワークに関しては、WebAssembly プログラムは JavaScript API の呼び出しに制限されています。これは安全機能ではありますが、課題も生じます。PHP で使用される低レベルの同期ネットワークコードを、JavaScript で利用可能な高レベルの非同期 API でどのようにサポートするのでしょうか？

<!--
When it comes to networking, WebAssembly programs are limited to calling JavaScript APIs. It is a safety feature, but also presents a challenge. How do you support low-level, synchronous networking code used by PHP with the high-level asynchronous APIs available in JavaScript?
-->

Node.js では、WebSocket から TCP ソケットへのプロキシである[Asyncify](https://emscripten.org/docs/porting/asyncify.html)と、php_select のような PHP 内部の深い部分へのパッチ適用が解決策となります。複雑ではありますが、そのメリットはあります。Node.js 向けの PHP ビルドでは、Web API のリクエスト、Composer パッケージのインストール、さらには MySQL サーバーへの接続も可能です。

<!--
In Node.js, the answer involves a WebSocket to TCP socket proxy, [Asyncify](https://emscripten.org/docs/porting/asyncify.html), and patching deep PHP internals like php_select. It's complex, but there's a reward. The Node.js-targeted PHP build can request web APIs, install composer packages, and even connect to a MySQL server.
-->

ブラウザでは、ネットワークは次の 2 つの方法でサポートされます。

<!--
In the browser, networking is supported in two ways:
-->

- `wp_safe_remote_get` 用の高速トランスポートで、これを `fetch()` 呼び出しに変換します。
- その他すべてのネットワーク呼び出し用の低速トランスポートで、PHP によって開始された [TLS 伝送を解析](https://github.com/WordPress/wordpress-playground/pull/1926) し、それを `fetch()` 呼び出しに変換します。

<!--
-   A fast transport for `wp_safe_remote_get` to translate them into `fetch()` calls.
-   A slower transport for all other network calls that [parses the TLS transmission](https://github.com/WordPress/wordpress-playground/pull/1926) initiated by PHP and translates it to a `fetch()` call.
-->
