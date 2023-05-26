# Scopes

Scopes keep your app working when you open it in two different browser tabs.

The Service Worker passes the intercepted HTTP requests to the PHPRequestHandler for rendering. Technically, it sends a message through a [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) which then gets delivered to every browser tab where the application is open. This is undesirable, slow, and leads to unexpected behaviors.

Unfortunately, the Service Worker cannot directly communicate with the relevant Worker Thread – see [PR #31](https://github.com/WordPress/wordpress-playground/pull/31) and [issue #9](https://github.com/WordPress/wordpress-playground/issues/9) for more details.

Scopes enable each browser tab to:

-   Brand the outgoing HTTP requests with a unique tab id
-   Ignore any `BroadcastChannel` messages with a different id

Technically, a scope is a string included in the `PHPRequestHandler.absoluteUrl`. For example:

-   In an **unscoped app**, `/index.php` would be available at `http://localhost:8778/wp-login.php`
-   In an **scoped app**, `/index.php` would be available at `http://localhost:8778/scope:96253/wp-login.php`

The service worker is aware of this concept and will attach the `/scope:` found in the request URL to the related `BroadcastChannel` communication.

A worker thread initiated with a scoped `absoluteUrl` is said to be **scoped**:

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
