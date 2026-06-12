# WordPress Playground Remote Access

Private workspace package for sharing Remote Access transport code between
packages.

Remote Access lets one browser open a WordPress Playground runtime that is
already running in another browser. The PHP relay is only used for rendezvous,
heartbeats, and WebRTC signaling. WordPress HTTP requests, responses, and backup
data flow over a direct WebRTC `RTCDataChannel`.

This package is intentionally private. It is not a published npm API yet, but it
keeps the transport and routing code out of `personal-wp` so other packages can
reuse the same pieces without copying them.

## What Lives Here

- `relay.php`: the signaling-only PHP/MySQL relay.
- `RemoteAccessHostController`: host-side lifecycle wrapper for starting,
  stopping, approving, and observing a shared Playground runtime.
- `DirectTunnelHost` and `DirectTunnelGuest`: lower-level WebRTC transport.
- Connect-code helpers for formatting, normalizing, and resolving six-digit
  access codes.
- URL routing helpers for `/connect`, scoped iframe URLs, and viewer URL cleanup.
- Service-worker relay helpers for forwarding `/scope:default/...` iframe
  requests to the remote viewer page.
- Shared tunnel utilities for attempt-scoped signals, verification codes, backup
  filenames, and ICE candidate buffering.

## Using This Package

A consuming package needs to provide four app-specific pieces around this
package:

1. A deployed copy of `relay.php` at `/relay/*`, backed by the Remote Access
   MySQL tables.
2. A host UI that can access a running Playground client and call
   `RemoteAccessHostController.start(playgroundClient)`.
3. A `/connect` route for entering a six-digit access code and opening the
   viewer URL.
4. A viewer route that registers the Playground service worker, starts
   `DirectTunnelGuest`, and renders a scoped iframe such as
   `/scope:default/?remote-access-view=<session-id>`.

The package does not provide React components. Personal WP has the current UI
implementation in `packages/playground/personal-wp/src/components/remote-access-*`.
Use that code as a reference for package-specific screens rather than as shared
API.

## Server Relay

Deploy `relay.php` so these paths reach it:

- `POST /relay/session`
- `GET /relay/code/:accessCode`
- `GET /relay/:sessionId/status`
- `GET /relay/:sessionId/signal`
- `POST /relay/:sessionId/signal`
- `POST /relay/:sessionId/close`

The relay expects these MySQL tables:

- `playground_remote_access_sessions`
- `playground_remote_access_signals`
- `playground_remote_access_guests`

For my.wordpress.net, the schema lives in:

```text
packages/playground/website-deployment/my-wordpress-net/mywp-remote-access-tables.sql
```

The relay reads DB configuration from these env/server variables, in order:

- `PLAYGROUND_RELAY_DB_HOST`, `DB_HOST`
- `PLAYGROUND_RELAY_DB_USER`, `DB_USER`
- `PLAYGROUND_RELAY_DB_PASSWORD`, `DB_PASSWORD`
- `PLAYGROUND_RELAY_DB_NAME`, `DB_NAME`
- `PLAYGROUND_RELAY_DB_PORT`, `DB_PORT`

Set `PLAYGROUND_RELAY_PUBLIC_BASE_URL` when generated share URLs should use a
specific public origin.

The relay only emits CORS access for same-origin `Origin` hosts. Unexpected
server failures are logged with `error_log()` and returned to clients as a
generic relay error.

## Host Flow

Use `RemoteAccessHostController` when the host page has access to the running
Playground client:

```ts
import { RemoteAccessHostController } from '@wp-playground/remote-access';

const controller = new RemoteAccessHostController({
	relayUrl: window.location.origin,
	onError(error) {
		// Surface this in the host UI or diagnostics.
		console.error(error);
	},
});

const unsubscribe = controller.subscribe((status) => {
	// status.shareUrl, status.accessCode, status.pendingVerificationCode,
	// status.metrics, status.status
});

const shareUrl = await controller.start(playgroundClient);
controller.approve('42');
await controller.stop();
unsubscribe();
```

`playgroundClient` must satisfy `RemoteAccessHostClient`, currently the
`UniversalPHP` surface used by Playground. The host side calls
`playgroundClient.request(...)` for tunneled WordPress HTTP requests and uses
the same client to produce backup zips.

The six-digit access code only finds a relay session. The host still must
approve the two-digit verification code shown by the remote viewer before
WordPress requests are accepted.

## Connect Route

The connect route is responsible for code entry and redirecting into the viewer
state:

```ts
import { buildRemoteAccessUrl, formatAccessCode, normalizeAccessCode, resolveAccessCode } from '@wp-playground/remote-access';

const formatted = formatAccessCode(inputValue);
const accessCode = normalizeAccessCode(formatted);
if (accessCode) {
	const { sessionId } = await resolveAccessCode(window.location.origin, accessCode);
	window.location.href = buildRemoteAccessUrl(window.location.href, sessionId);
}
```

By default the session id is stored in the `share` query parameter.

## Viewer And Service Worker Flow

The viewer page owns the remote browser connection. At a high level it should:

1. Read the session id with `getRemoteAccessSessionId(window.location.href)`.
2. Register the Playground service worker with
   `registerRemoteAccessServiceWorker(serviceWorkerUrl, window.location.origin)`.
3. Map the service-worker relay with `postRemoteAccessRelayMapping(...)`.
4. Start `DirectTunnelGuest`.
5. When both the service worker and data channel are ready, load an iframe URL
   from `buildRemoteAccessScopedIframeUrl(...)`.
6. Listen for service-worker messages, pass requests to `directTunnel.request`,
   and reply with `postRemoteAccessRelayResponse` or
   `postRemoteAccessRelayError`.

The service worker must import the service-worker-side helpers and intercept
scoped requests before the normal scoped Playground handler:

```ts
import { getRemoteAccessRelayMapping, getRemoteAccessRelayMappingFromUrl, handleRemoteAccessRelayMessage, handleRemoteAccessRelayProbe, handleRemoteAccessRelayRequest } from '@wp-playground/remote-access';

self.addEventListener('message', (event) => {
	handleRemoteAccessRelayMessage(event);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (!isURLScoped(url)) {
		return;
	}
	const scope = getURLScope(url)!;
	if (url.searchParams.has('remote-access-probe')) {
		return event.respondWith(handleRemoteAccessRelayProbe(scope, url.searchParams.get('remote-access-probe')));
	}
	const mapping = getRemoteAccessRelayMapping(scope) || getRemoteAccessRelayMappingFromUrl(scope, url);
	if (mapping) {
		return event.respondWith(handleRemoteAccessRelayRequest(event, mapping).then((response) => applyCrossOriginIsolationHeaders(response, scope)));
	}
});
```

The viewer iframe URL contains `remote-access-view=<session-id>`. That lets the
service worker recover the relay mapping after activation or update if the
in-memory mapping was not present yet.

The readiness probe URL contains `remote-access-probe=<session-id>`. The
service worker only returns diagnostics when that value matches the active
mapping for the scope.

## URL Helpers

Use the URL helpers to keep `/connect` and scoped iframe URLs consistent:

- `getRemoteAccessPathFromConnectUrl('/connect/wp-admin/?share=...')`
  returns `/wp-admin/`.
- `buildRemoteAccessScopedIframeUrl('/wp-admin/', sessionId)` returns a
  `/scope:default/...` iframe URL with `remote-access-view`.
- `buildConnectUrlFromScopedIframeUrl(...)` maps iframe navigation back to the
  visible `/connect/...` URL.
- `stripRemoteAccessSessionId(...)` removes `share` from the visible viewer URL
  after the session is established.

These helpers accept absolute URLs and path-only URLs.
