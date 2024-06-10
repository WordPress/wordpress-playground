import {
	activatePlugin,
	installPlugin,
	login,
} from '@wp-playground/blueprints';
import { bootWordPress } from '@wp-playground/wordpress';
import { PHPRequest, loadPHPRuntime } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import { listenForPhpRequests } from './messaging';

const requestHandler = bootWorker();
prerenderEditor();

async function prerenderEditor() {
	await requestHandler;
	const iframe = document.createElement('iframe');
	iframe.src = 'http://localhost:5400/scope:777777777/wp-admin/post-new.php';
	document.body.appendChild(iframe);

	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve);
	});

	setTimeout(() => {
		document.body.removeChild(iframe);
	}, 10000);
}

listenForPhpRequests(async (request) => {
	const handler = await requestHandler;
	request.headers = {
		...(request.headers || {}),
		Host: 'playground.internal',
		Origin: 'http://playground.internal',
		Referer: 'http://playground.internal',
	};
	const response = await handler.request(request);
	const newHeaders = {};
	for (const [key, value] of Object.entries(response.headers)) {
		newHeaders[key.toLowerCase() as any] = value.map((v: string) =>
			v.replace('http://playground.internal', chrome.runtime.getURL(''))
		);
	}
	return {
		...response,
		headers: newHeaders,
		bytes: new TextEncoder().encode(
			response.text.replaceAll(
				'http://playground.internal',
				chrome.runtime.getURL('')
			)
		),
	};
});

const putInCache = async (request, response) => {
	const cache = await caches.open('v1');
	await cache.put(request, response);
};

const iframe = document.querySelector(
	'#playground-remote-service-worker'
) as any;

// Super naive caching, let's use actual request caches instead
window.addEventListener('message', async (event) => {
	if (event.data.type === 'playground-extension-sw-message') {
		if (event.data.data.method === 'request') {
			const phpRequest = event.data.data.args[0] as PHPRequest;

			const requestUrl = new URL(phpRequest.url);
			requestUrl.searchParams.delete('_ajax_nonce');

			const request = new Request(requestUrl.toString(), {
				method: event.data.data.args[0].method,
				// Do not use headers or body as cache keys. We
				// only need basic matching here.
			});
			const response = await caches.match(request);
			let phpResponse = undefined;
			if (!response) {
				phpResponse = await (
					await requestHandler
				).request(event.data.data.args[0]);
				if (
					requestUrl.searchParams.has('rest_route') ||
					requestUrl.pathname.includes('wp-includes')
				) {
					putInCache(
						request,
						new Response(phpResponse.bytes, {
							headers: phpResponse.headers as any,
							status: phpResponse.httpStatusCode,
						})
					);
				}
			}

			if (response && !phpResponse) {
				const phpResponseHeaders: Record<string, string[]> = {};
				response.headers.forEach((value, key) => {
					phpResponseHeaders[key.toLowerCase()] = [value];
				});

				phpResponse = {
					bytes: await response.arrayBuffer(),
					headers: phpResponseHeaders,
					httpStatusCode: response.status,
				};
			}

			iframe.contentWindow.postMessage(
				responseTo(event.data.requestId, phpResponse),
				'*'
			);
		}
	}
});

async function bootWorker() {
	const iframe = document.querySelector(
		'#playground-remote-service-worker'
	) as any;
	iframe.src = 'http://localhost:5400/extension.html';

	const [wordPressZip, sqliteIntegrationPluginZip] = await Promise.all([
		readFileFromCurrentExtension('wordpress-6.5.4.zip'),
		readFileFromCurrentExtension('sqlite-database-integration.zip'),
	]);
	const requestHandler = await bootWordPress({
		// WordPress installer needs a `http://` URL.
		// We can't keep using it to run the site later on because it's
		// not a real URL and WordPress will keep redirecting there.
		// Fortunately, we can override it with `chrome.runtime.getURL`
		// right after the installation is completed.
		siteUrl: 'http://localhost:5400/scope:777777777/',
		createPhpRuntime: async () => {
			// @ts-expect-error
			const phpModule = await import('./php_8_0.js');
			return await loadPHPRuntime(phpModule, {
				...fakeWebsocket(),
			});
		},
		wordPressZip,
		sqliteIntegrationPluginZip,
		sapiName: 'cli',
		phpIniEntries: {
			allow_url_fopen: '0',
			disable_functions: '',
		},
	});

	const url = 'http://localhost:5400/scope:777777777/';
	const primaryPHP = await requestHandler.getPrimaryPhp();
	primaryPHP.defineConstant('WP_HOME', url);
	primaryPHP.defineConstant('WP_SITEURL', url);

	primaryPHP.mkdir('/wordpress/wp-content/plugins/playground-editor');
	await installPlugin(primaryPHP, {
		pluginZipFile: new File(
			[await (await fetch('blocky-formats.zip')).blob()],
			'blocky-formats.zip'
		),
		options: {
			activate: false,
		},
	});
	await login(primaryPHP, {});

	primaryPHP.writeFile(
		'/wordpress/wp-content/plugins/playground-editor/script.js',
		await (await fetch('wordpress-plugin/script.js')).text()
	);

	primaryPHP.writeFile(
		'/wordpress/wp-content/plugins/playground-editor/index.php',
		await (await fetch('wordpress-plugin/index.php')).text()
	);

	await activatePlugin(primaryPHP, {
		pluginPath: 'playground-editor/index.php',
	});
	return requestHandler;
}

async function readFileFromCurrentExtension(path: string): Promise<File> {
	const response = await fetch(path);
	return new File([await response.blob()], path);
}

/**
 * Fake a websocket connection to prevent errors in the web app
 * from cascading and breaking the Playground.
 */
const fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor: any) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						try {
							super();
						} catch (e) {
							// pass
						}
					}

					send() {
						return null;
					}
				};
			},
		},
	};
};
