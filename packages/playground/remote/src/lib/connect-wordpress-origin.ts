import { getURLScope } from '@php-wasm/scopes';
import { streamToPort } from '@php-wasm/universal';
import type { RemoteAPI } from '@php-wasm/universal';
import type { PlaygroundWorkerEndpoint } from './playground-worker-endpoint';
import { wordPressSiteUrl } from './config';

/** Keep the cross-origin transport limited to HTTP requests for this PHP instance. */
export async function connectWordPressOrigin(
	client: RemoteAPI<PlaygroundWorkerEndpoint>,
	scope: string
) {
	const bridge = document.createElement('iframe');
	bridge.hidden = true;
	bridge.title = 'WordPress request transport';
	const url = new URL('/wordpress-bridge.html', wordPressSiteUrl);
	url.searchParams.set('scope', scope);
	bridge.src = url.href;
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			window.removeEventListener('message', onMessage);
			bridge.remove();
			reject(new Error('WordPress request transport did not start.'));
		}, 30000);
		/** Accept only the bound helper and expose HTTP, not the filesystem API. */
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
			const { method, requestId } = event.data;
			let response;
			const transfer: Transferable[] = [];
			try {
				if (method === 'request') {
					const request = event.data.args?.[0];
					const target = new URL(request?.url);
					if (
						target.origin !== wordPressSiteUrl ||
						getURLScope(target) !== scope
					)
						return;
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
					const { staticAssetsDirectory } =
						await client.getWordPressModuleDetails();
					response = { staticAssetsDirectory };
				} else {
					return;
				}
			} catch (error) {
				response = {
					httpStatusCode: 500,
					headers: { 'content-type': ['text/plain'] },
					bytes: new TextEncoder().encode(String(error)),
				};
			}
			bridge.contentWindow!.postMessage(
				{
					type: 'wordpress-bridge-response',
					scope,
					requestId,
					response,
				},
				wordPressSiteUrl,
				transfer
			);
		}
		window.addEventListener('message', onMessage);
		document.body.append(bridge);
	});
}
