---
slug: /developers/apis/javascript-api/-html-vs-remote-html
---

# `remote.html` vs `index.html`

[playground.wordpress.net](https://playground.wordpress.net/) は、`remote.html` と `index.html` という 2 つの異なる HTML ファイルを通じて、2 つの異なる API を公開しています。それぞれの機能と違いの概要は次のとおりです。

<!--
[playground.wordpress.net](https://playground.wordpress.net/) exposes two distinct APIs through two separate HTML files: `remote.html` and `index.html`. Here's an overview of their functions and differences:
 -->

-   `index.html` は、WordPress Playground API クライアントを使用して、`remote.html` という「エンドポイント」を制御します。
-   [クエリ API](../query-api/) は、WordPress Playground JavaScript API とは独立して、`index.html` によってのみ提供されます。
-   [JavaScript API](../javascript-api/) は、`remote.html` によってのみ提供されます。`PlaygroundClient` クラスの「エンドポイント」として使用できるのは、このファイルのみです。

<!--
-   `index.html` uses WordPress Playground API client to control the "endpoint" that is `remote.html`.
-   The [Query API](../query-api/) is exclusively provided by `index.html`, independent of the WordPress Playground JavaScript API.
-   The [JavaScript API](../javascript-api/) is exclusively provided by `remote.html`. Only that file can be used as an "endpoint" for the `PlaygroundClient` class.
 -->

これらの各ファイルについてもう少し詳しく説明します。

<!--
Here's a bit more about each of these files:
 -->

## Remote.html

`remote.html` は WordPress を実行・レンダリングするだけでなく、開発者が WordPress を制御するための API も公開しています。重要なのは、`remote.html` はブラウザ UI やバージョンスイッチャーなどの UI 要素をレンダリングしないことです。これは WordPress そのもののことです。`remote.html` の主な機能は次のとおりです。

<!--
`remote.html` runs and renders WordPress and also exposes an API for developers to control it. Importantly, `remote.html` does not render any UI elements, such as browser UI or version switchers. It's just WordPress. The primary functions of `remote.html` are:
 -->

-   PHP の WebAssembly ビルドである php.wasm の適切なバージョンをロードします。
-   ユーザーインタラクション用に正しいバージョンの WordPress をロードします。
-   WebWorker で PHP を初期化し、HTTP リクエスト用の ServiceWorker を登録します。
-   親ウィンドウからの `message` イベントをリッスンし、適切なコードコマンドを実行します。

<!--
-   Loading the suitable version of php.wasm, the WebAssembly build of PHP.
-   Loading the correct version of WordPress for user interaction.
-   Initiating PHP in a WebWorker and registering a ServiceWorker for HTTP requests.
-   Listening to the `message` event from the parent window and executing the appropriate code command.
 -->

最後の部分はパブリック API の仕組みです。親ウィンドウ（`index.html`）はコマンドと引数を含むメッセージを`iframe`（`remote.html`）に送信し、`iframe`はそのコマンドを実行し、結果を別のメッセージで返します。

<!--
That last part is how the public API works. The parent window (`index.html`) sends a message to the `iframe` (`remote.html`) with a command and arguments, and the `iframe` then executes that command and sends the result back with another message.
 -->

メッセージを送信するのは面倒なので、`PlaygroundClient` クラスはメッセージを内部で処理するオブジェクト指向 API を提供します。

<!--
Sending messages is cumbersome, so the `PlaygroundClient` class provides an object-oriented API that handles the messages internally.
 -->

迅速なテストとデバッグのために、`remote.html` は JavaScript API クライアントを `window.playground` として公開しています。これは、開発ツールから次のように使用できます。

<!--
For quick testing and debugging, `remote.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows:
 -->

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

`playground` はこのコンテキストではクラスインスタンスであり、ブラウザの自動補完の恩恵を受けることができます。

<!--
`playground` is a class instance in this context, and you will benefit from browser's autocompletion.
 -->

## Index.html

`index.html` は、WordPress Playground API クライアントを使用して `remote.html` を中心に構築された独立したアプリです。

<!--
`index.html` is an independent app built around `remote.html` using the WordPress Playground API client.
 -->

ブラウザ UI、バージョンセレクター、そして`iframe`経由で`remote.html`を埋め込むことで WordPress をレンダリングします。アドレスバーやバージョンセレクターなどの UI 機能は、`PlaygroundClient`を使用して`remote.html`と通信することで実装されます。

<!--
It renders the browser UI, version selectors, and renders WordPress by embedding `remote.html` via an `iframe`. UI features, such as an address bar or a version selector, are implemented by communicating with `remote.html` using `PlaygroundClient`.
 -->

`index.html` は受信したクエリパラメータを監視し、適切な `PlaygroundClient` メソッドを呼び出します。例えば、`?plugin=coblocks` は `installPluginsFromDirectory( client, ['coblocks'] )` を呼び出します。このメカニズムがクエリ API の基盤となっています。

<!--
`index.html` monitors the query parameters it receives and triggers the appropriate `PlaygroundClient` methods. For instance, `?plugin=coblocks` triggers `installPluginsFromDirectory( client, ['coblocks'] )`. This mechanism forms the basis of the Query API.
 -->

迅速なテストとデバッグのために、`index.html` は JavaScript API クライアントを `window.playground` として公開しています。これは、開発ツールから次のように使用できます。

<!--
For quick testing and debugging, `index.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows:
 -->

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

このコンテキストでは、`playground` は Proxy オブジェクトであり、ブラウザから自動補完は行われないことに注意してください。

<!--
Note that `playground` is a Proxy object in this context and you won't get any autocompletion from the browser.
 -->
