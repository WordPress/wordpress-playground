---
slug: /developers/architecture/browser-concepts
---

# ServiceWorker と Worker Threads を使用してブラウザで PHP アプリを実行する

<!--
# Running PHP apps in the browser with ServiceWorkers and Worker Threads
-->

大まかに言うと、WordPress Playground は Web ブラウザー内で次のように動作します。

<!--
On a high level, WordPress Playground works in web browsers as follows:
-->

- playground.wordpress.net 上の `index.html` ファイルは、`<iframe src="/remote.html">` を介して `remote.html` ファイルを読み込みます。
- `remote.html` はワーカースレッドとサービスワーカーを起動し、ダウンロードの進行状況情報を返します。
- ワーカースレッドは PHP を起動し、SQLite で動作するようにパッチを適用した WordPress をファイルシステムに読み込みます。
- サービスワーカーはすべての HTTP リクエストをインターセプトし、ワーカースレッドに転送します。
- `remote.html` は `<iframe src="/index.php">` を作成し、サービスワーカーは `index.php` リクエストをワーカースレッドに転送し、WordPress ホームページがレンダリングされます。

<!--
-   The `index.html` file on playground.wordpress.net loads the `remote.html` file via an `<iframe src="/remote.html">`.
-   `remote.html` starts a Worker Thread and a ServiceWorker and sends back the download progress information.
-   The Worker Thread starts PHP and populates the filesystem with a WordPress patched to run on SQLite.
-   The ServiceWorker starts intercepting all HTTP requests and forwarding them to the Worker Thread.
-   `remote.html` creates an `<iframe src="/index.php">`, and the Service Worker forwards the `index.php` request to the Worker Thread where the WordPress homepage is rendered.
-->

視覚的には次のようになります。

<!--
Visually, it looks like this:
-->

![Architecture overview](@site/static/img/architecture-overview.webp)

## 高レベルのアイデア

<!--
## High-level ideas
-->

[`@php-wasm/web`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/web/) は、次のアイデアに基づいて構築されています。

<!--
The [`@php-wasm/web`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/web/) is built on top of the following ideas:
-->

- [**ブラウザタブがすべてをオーケストレーション**](/developers/architecture/browser-tab-orchestrates-execution) – ブラウザタブはメインプログラムです。タブを閉じたり再読み込みしたりすると、実行環境全体が破壊されます。
- [**iframeベースのレンダリング**](/developers/architecture/browser-iframe-rendering) – ユーザーがリンクをクリックしたときにブラウザタブが再読み込みされるのを避けるため、PHP サーバーが生成するすべてのレスポンスは iframe でレンダリングする必要があります。
- [**PHPワーカースレッド**](/developers/architecture/browser-php-worker-threads) – PHPサーバーは低速であるため、Web ワーカーで実行する必要があります。そうしないと、リクエストの処理中に Web サイトの UI がフリーズしてしまいます。
- [**サービス ワーカー ルーティング**](/developers/architecture/browser-service-workers) – その iframe で発生したすべての HTTP リクエストは、サービス ワーカーによってインターセプトされ、レンダリングのために PHP ワーカー スレッドに渡される必要があります。

<!--
-   [**Browser tab orchestrates everything**](/developers/architecture/browser-tab-orchestrates-execution) – The browser tab is the main program. Closing or reloading it means destroying the entire execution environment.
-   [**Iframe-based rendering**](/developers/architecture/browser-iframe-rendering) – Every response produced by the PHP server must be rendered in an iframe to avoid reloading the browser tab when the user clicks on a link.
-   [**PHP Worker Thread**](/developers/architecture/browser-php-worker-threads) – The PHP server is slow and must run in a web worker, otherwise handling requests freezes the website UI.
-   [**Service Worker routing**](/developers/architecture/browser-service-workers) – All HTTP requests originating in that iframe must be intercepted by a Service worker and passed on to the PHP worker thread for rendering.
-->
