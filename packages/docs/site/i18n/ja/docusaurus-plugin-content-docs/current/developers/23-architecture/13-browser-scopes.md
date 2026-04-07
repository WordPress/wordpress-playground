# スコープ

<!--
# Scopes
-->

スコープを使用すると、2 つの異なるブラウザ タブでアプリを開いたときにアプリが動作し続けます。

<!--
Scopes keep your app working when you open it in two different browser tabs.
-->

サービスワーカーは、インターセプトした HTTP リクエストをレンダリングのために PHPRequestHandler に渡します。技術的には、[`BroadcastChannel`](https://developer.mozilla.org/ja/docs/Web/API/BroadcastChannel) を介してメッセージを送信し、アプリケーションが開いているすべてのブラウザタブに配信されます。これは望ましくない動作であり、処理速度が遅く、予期しない動作につながります。

<!--
The Service Worker passes the intercepted HTTP requests to the PHPRequestHandler for rendering. Technically, it sends a message through a [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) which then gets delivered to every browser tab where the application is open. This is undesirable, slow, and leads to unexpected behaviors.
-->

残念ながら、サービスワーカーは関連するワーカースレッドと直接通信できません。詳細については、[PR #31](https://github.com/WordPress/wordpress-playground/pull/31) および [issue #9](https://github.com/WordPress/wordpress-playground/issues/9) を参照してください。

<!--
Unfortunately, the Service Worker cannot directly communicate with the relevant Worker Thread – see [PR #31](https://github.com/WordPress/wordpress-playground/pull/31) and [issue #9](https://github.com/WordPress/wordpress-playground/issues/9) for more details.
-->

スコープにより、各ブラウザ タブで次の操作が可能になります。

<!--
Scopes enable each browser tab to:
-->

- 送信 HTTP リクエストに固有のタブ ID を付与する
- 異なる ID を持つ「 BroadcastChannel 」メッセージを無視する

<!--
-   Brand the outgoing HTTP requests with a unique tab id
-   Ignore any `BroadcastChannel` messages with a different id
-->

技術的には、スコープとは `PHPRequestHandler.absoluteUrl` に含まれる文字列です。例えば、次のようになります。

<!--
Technically, a scope is a string included in the `PHPRequestHandler.absoluteUrl`. For example:
-->

- **スコープなしアプリ**では、`/index.php` は `http://localhost:8778/wp-login.php` で利用できます。
- **スコープ付きアプリ**では、`/index.php` は `http://localhost:8778/scope:96253/wp-login.php` で利用できます。

<!--
-   In an **unscoped app**, `/index.php` would be available at `http://localhost:8778/wp-login.php`
-   In an **scoped app**, `/index.php` would be available at `http://localhost:8778/scope:96253/wp-login.php`
-->

サービス ワーカーはこの概念を認識しており、リクエスト URL にある `/scope:` を関連する `BroadcastChannel` 通信に添付します。

<!--
The service worker is aware of this concept and will attach the `/scope:` found in the request URL to the related `BroadcastChannel` communication.
-->

スコープ付きの `absoluteUrl` で開始されたワーカー スレッドは、**スコープ付き** であると言われます。

<!--
A worker thread initiated with a scoped `absoluteUrl` is said to be **scoped**:
-->

```js
import {
	PHP,
	setURLScope,
	exposeAPI,
	parseWorkerStartupOptions,
} from '@php-wasm/web';

// absoluteURL を直接使用しないでください:
const absoluteURL = 'http://127.0.0.1'

// 代わりに、最初にスコープを設定します。
const scope = Math.random().toFixed(16)
const scopedURL = setURLScope(absoluteURL, scope).toString()

const { phpVersion } = parseWorkerStartupOptions<{ phpVersion?: string }>();
const php = await PHP.load('8.0', {
	requestHandler: {
		documentRoot: '/',
		absoluteUrl: scopedSiteUrl
	}
});

// API を app.ts に公開します。
const [setApiReady, ] = exposeAPI( php );
setApiReady();
```

<!--
```js
import {
	PHP,
	setURLScope,
	exposeAPI,
	parseWorkerStartupOptions,
} from '@php-wasm/web';

// Don't use the absoluteURL directly:
const absoluteURL = 'http://127.0.0.1'

// Instead, set the scope first:
const scope = Math.random().toFixed(16)
const scopedURL = setURLScope(absoluteURL, scope).toString()

const { phpVersion } = parseWorkerStartupOptions<{ phpVersion?: string }>();
const php = await PHP.load('8.0', {
	requestHandler: {
		documentRoot: '/',
		absoluteUrl: scopedSiteUrl
	}
});

// Expose the API to app.ts:
const [setApiReady, ] = exposeAPI( php );
setApiReady();
```
-->
