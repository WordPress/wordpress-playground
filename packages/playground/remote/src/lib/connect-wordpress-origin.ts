import { getURLScope } from '@php-wasm/scopes';
import { streamToPort } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import type { RemoteAPI } from '@php-wasm/universal';
import type { PlaygroundWorkerEndpoint } from './playground-worker-endpoint';
import {
	playgroundOrigin,
	wordPressSiteUrl,
	releaseBase,
	usesMultiReleaseDirectoryLayout,
} from './config';
import { joinPaths } from '@php-wasm/util';
import { runtimeStaticAssetsDirectory } from './wordpress-static-assets';
import { getWordPressBridgePath } from './wordpress-bridge-path';
// @ts-ignore -- Provided by Vite.
import { buildVersion } from 'virtual:remote-config';

export const PARTITION_PROBE_CHANNEL_NAME = 'playground-partition-probe';
export const RUNTIME_PARTITION_LOCK_PREFIX = 'playground-runtime-partition:';

/**
 * Connect WordPress HTTP requests on a separate origin to this app-origin PHP worker.
 *
 * For example, remote.html on playground.wordpress.net runs PHP, but the visible
 * WordPress iframe loads wpsandbox.wordpress.net/scope:site-a/. The WordPress
 * service worker cannot message remote.html directly: it can only reach windows
 * on its own origin. This function creates a hidden WordPress-origin iframe as
 * a sibling of the visible WordPress iframe. Requests take this path:
 *
 * WordPress page -> WordPress service worker -> hidden iframe
 *   -> remote.html (this listener) -> the supplied PHP worker.
 *
 * Only messages from that exact hidden iframe, at the configured WordPress origin,
 * with the supplied scope reach PHP. The HTTP URL must also use that origin and
 * scope. The connection exposes two operations: HTTP requests and the directory
 * name for shared WordPress assets. It does not forward the full PHP API, file
 * handles, mount options, or requests for a different scope. Response status and
 * headers return as message data; body chunks travel through a MessagePort.
 *
 * Call after PHP has booted. Resolves when the bridge reports its service worker
 * is ready, not when a WordPress page has loaded. On success, the hidden iframe
 * and listener remain for the lifetime of remote.html. If no ready message arrives
 * within 30 seconds, both are removed and the promise rejects.
 *
 * Production URLs name this app's /releases/<id>/wordpress-bridge.html. Development
 * and portable builds use /wordpress-bridge-<buildVersion>.html instead. A worker
 * can generate its own release's bridge HTML and its matching build-version alias.
 * Requests naming another release or build reach HTTP, so an older worker cannot
 * substitute HTML that names its own script. The unversioned compatibility alias
 * also uses worker-generated HTML. The bridge registers the WordPress worker and
 * waits for activation before reporting ready.
 *
 * After connection, reject app-service-worker HTTP requests for this scope with
 * 404. Returning this site's HTML there would let its scripts run on the app
 * origin with app storage access, bypassing the sandbox origin entirely.
 * The rejection listener lasts with remote.html and survives worker restarts.
 *
 * The scope selects a PHP instance; it does not prove which WordPress page made
 * the HTTP request. Pages sharing the WordPress origin can still request another
 * running site's known scope. This connection also does not prevent WordPress
 * from embedding a fresh app/API document and connecting to that separate API.
 *
 * @param client The already-booted PHP worker that will serve this site's requests.
 * @param scope The site's URL routing scope, as supplied in its PHP boot options.
 */
export async function connectWordPressOrigin(
	client: RemoteAPI<PlaygroundWorkerEndpoint>,
	scope: string
) {
	const bridge = document.createElement('iframe');
	bridge.hidden = true;
	bridge.title = 'WordPress bridge';
	bridge.src = getWordPressBridgeUrl(scope).href;
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			window.removeEventListener('message', onMessage);
			bridge.remove();
			reject(new Error('WordPress bridge did not start.'));
		}, 30000);
		/**
		 * Handle this bridge's startup message or one request for its PHP instance.
		 *
		 * Checking the source window as well as the origin excludes other iframes
		 * on the shared WordPress origin. Check both the message scope and the URL
		 * scope: a valid bridge must not choose a different PHP instance by changing
		 * either field. Copy only HTTP request fields into requestStreamed(), and
		 * return only staticAssetsDirectory for the metadata operation. Keep the
		 * requestId unchanged so the service worker can match concurrent replies.
		 */
		async function onMessage(event: MessageEvent) {
			if (
				event.source !== bridge.contentWindow ||
				event.origin !== wordPressSiteUrl ||
				event.data?.scope !== scope
			)
				return;
			if (event.data.type === 'wordpress-bridge-ready') {
				clearTimeout(timeout);
				resolve();
				return;
			}
			if (event.data.type !== 'wordpress-bridge-request') return;
			const result = await handleWordPressBridgeRequest(
				client,
				scope,
				event.data
			);
			if (!result) return;
			bridge.contentWindow!.postMessage(
				{
					type: 'wordpress-bridge-response',
					scope,
					requestId: event.data.requestId,
					response: result.response,
				},
				wordPressSiteUrl,
				result.transfer
			);
		}
		window.addEventListener('message', onMessage);
		document.body.append(bridge);
	});
	listenForWordPressPopupRelay(client, scope);
	// Explicitly reject this site's app-origin HTTP route so /scope:site-a/ cannot
	// render its WordPress HTML with app storage access. Only the sandbox bridge above
	// may send this site's HTTP requests to PHP. Keep this listener with the
	// connection for remote.html's lifetime; it must also work after a SW restart.
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.scope !== scope || event.data.method !== 'request')
			return;
		event.source!.postMessage(
			responseTo(event.data.requestId, {
				httpStatusCode: 404,
				headers: {},
				bytes: new Uint8Array(),
			})
		);
	});
}

/**
 * Relay HTTP requests from top-level popup tabs on playgroundOrigin when this
 * runtime runs inside a cross-site iframe's storage partition.
 *
 * A new tab opened from an embedded Playground gets an unpartitioned service
 * worker that cannot reach this partitioned PHP worker. Trusted popup windows
 * on playgroundOrigin probe whether they share our partition via BroadcastChannel
 * and, when partitioned, forward the same narrow HTTP/metadata bridge messages
 * handled by connectWordPressOrigin().
 */
export function listenForWordPressPopupRelay(
	client: RemoteAPI<PlaygroundWorkerEndpoint>,
	scope: string,
	singleOriginServiceWorkerUrl?: string
) {
	let probeChannel: BroadcastChannel | null = null;
	const bridgeUrl =
		wordPressSiteUrl !== playgroundOrigin
			? getWordPressBridgeUrl(scope).href
			: null;
	const serviceWorkerUrl =
		wordPressSiteUrl === playgroundOrigin
			? (singleOriginServiceWorkerUrl ?? null)
			: null;

	// Hold a partition-scoped Web Lock for this runtime's lifetime so popups
	// in the same storage partition can detect it deterministically without
	// relying on a BroadcastChannel timing window.
	if (
		typeof navigator !== 'undefined' &&
		typeof navigator.locks?.request === 'function'
	) {
		void navigator.locks
			.request(
				`${RUNTIME_PARTITION_LOCK_PREFIX}${scope}`,
				() => new Promise<void>(() => {})
			)
			.catch(() => {});
	}

	window.addEventListener('message', async (event) => {
		if (
			event.origin !== playgroundOrigin ||
			!event.source ||
			event.source === window ||
			event.data?.scope !== scope
		) {
			return;
		}
		const source = event.source as Window;
		if (event.data.type === 'wordpress-popup-partition-probe') {
			const { probeId } = event.data;
			if (typeof probeId !== 'string') return;
			if (typeof BroadcastChannel === 'function') {
				probeChannel ??= new BroadcastChannel(
					PARTITION_PROBE_CHANNEL_NAME
				);
				probeChannel.postMessage({
					type: 'wordpress-popup-partition-probe-echo',
					scope,
					probeId,
				});
			}
			source.postMessage(
				{
					type: 'wordpress-popup-partition-probe-ack',
					scope,
					probeId,
					bridgeUrl,
					serviceWorkerUrl,
				},
				playgroundOrigin
			);
			return;
		}
		if (event.data.type !== 'wordpress-popup-bridge-request') {
			return;
		}
		const result = await handleWordPressBridgeRequest(
			client,
			scope,
			event.data
		);
		if (!result) return;
		source.postMessage(
			{
				type: 'wordpress-popup-bridge-response',
				scope,
				requestId: event.data.requestId,
				response: result.response,
			},
			playgroundOrigin,
			result.transfer
		);
	});
}

async function handleWordPressBridgeRequest(
	client: RemoteAPI<PlaygroundWorkerEndpoint>,
	scope: string,
	data: { method?: string; args?: any[] }
): Promise<{ response: any; transfer: Transferable[] } | null> {
	const { method } = data;
	let response;
	const transfer: Transferable[] = [];
	try {
		if (method === 'request') {
			const request = data.args?.[0];
			const target = new URL(request?.url);
			if (
				target.origin !== wordPressSiteUrl ||
				getURLScope(target) !== scope
			)
				return null;
			// Do not forward arbitrary PHP options, mount devices, or caller-selected scopes.
			const result = await client.requestStreamed({
				url: target.href,
				method: request.method,
				headers: request.headers,
				body: request.body,
			});
			// Resolve metadata first: a short body must not close its port before transfer.
			const httpStatusCode = await result.httpStatusCode;
			const headers = await result.headers;
			const bodyPort = streamToPort(result.stdout);
			transfer.push(bodyPort);
			response = { httpStatusCode, headers, bodyPort };
		} else if (method === 'getWordPressModuleDetails') {
			response = {
				staticAssetsDirectory: runtimeStaticAssetsDirectory(
					await client.getWordPressModuleDetails()
				),
			};
		} else {
			return null;
		}
	} catch (error) {
		response = {
			httpStatusCode: 500,
			headers: { 'content-type': ['text/plain'] },
			bytes: new TextEncoder().encode(String(error)),
		};
	}
	return { response, transfer };
}

function getWordPressBridgeUrl(scope: string): URL {
	// Name this app's release, or its buildVersion for development/portable builds.
	// An installed worker can answer the unversioned alias with its own script URL.
	// Qualified paths let it distinguish its bridge from another release or build.
	const url = new URL(
		usesMultiReleaseDirectoryLayout
			? joinPaths(releaseBase, 'wordpress-bridge.html')
			: getWordPressBridgePath(buildVersion),
		wordPressSiteUrl
	);
	url.searchParams.set('scope', scope);
	return url;
}
