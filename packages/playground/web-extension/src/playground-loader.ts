import {
	activatePlugin,
	installPlugin,
	login,
} from '@wp-playground/blueprints';
import { bootWordPress } from '@wp-playground/wordpress';
import { PHPRequest, loadPHPRuntime } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import { LOOPBACK_SW_URL } from './config';

const requestHandler = bootWorker();
prerenderEditor();

async function prerenderEditor() {
	await requestHandler;
	await bootServiceWorker();
	const iframe = document.createElement('iframe');
	iframe.src = `${LOOPBACK_SW_URL}/wp-admin/post-new.php`;
	document.body.appendChild(iframe);

	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve);
	});

	setTimeout(() => {
		document.body.removeChild(iframe);
	}, 10000);
}

const cache = await caches.open('v1.1');
const putInCache = async (request, response) => {
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

			if (requestUrl.pathname.endsWith('/empty.html')) {
				iframe.contentWindow.postMessage(
					responseTo(event.data.requestId, {
						bytes: await emptyHtml().arrayBuffer(),
						headers: {
							'content-type': ['text/html'],
						},
						httpStatusCode: 200,
					}),
					'*'
				);
				return;
			}

			const request = new Request(requestUrl.toString(), {
				method: event.data.data.args[0].method,
				// Do not use headers or body as cache keys. We
				// only need basic matching here.
			});
			const response = await cache.match(request);
			let phpResponse = undefined;
			if (!response) {
				phpResponse = await (
					await requestHandler
				).request(event.data.data.args[0]);

				// Path the block-editor.js file to ensure the site editor's iframe
				// inherits the service worker.
				// @see controlledIframe below for more details.
				if (
					// WordPress Core version of block-editor.js
					requestUrl.pathname.endsWith(
						'/wp-includes/js/dist/block-editor.js'
					) ||
					requestUrl.pathname.endsWith(
						'/wp-includes/js/dist/block-editor.min.js'
					) ||
					// Gutenberg version of block-editor.js
					requestUrl.pathname.endsWith(
						'/build/block-editor/index.js'
					) ||
					requestUrl.pathname.endsWith(
						'/build/block-editor/index.min.js'
					)
				) {
					const script = new TextDecoder().decode(
						await phpResponse.bytes
					);
					const newScript = `${controlledIframe} ${script.replace(
						/\(\s*"iframe",/,
						'(__playground_ControlledIframe,'
					)}`;
					(phpResponse as any).bytes = new TextEncoder().encode(
						newScript
					);
				}

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

/**
 * Pair the site editor's nested iframe to the Service Worker.
 *
 * Without the patch below, the site editor initiates network requests that
 * aren't routed through the service worker. That's a known browser issue:
 *
 * * https://bugs.chromium.org/p/chromium/issues/detail?id=880768
 * * https://bugzilla.mozilla.org/show_bug.cgi?id=1293277
 * * https://github.com/w3c/ServiceWorker/issues/765
 *
 * The problem with iframes using srcDoc and src="about:blank" as they
 * fail to inherit the root site's service worker.
 *
 * Gutenberg loads the site editor using <iframe srcDoc="<!doctype html">
 * to force the standards mode and not the quirks mode:
 *
 * https://github.com/WordPress/gutenberg/pull/38855
 *
 * This commit patches the site editor to achieve the same result via
 * <iframe src="/doctype.html"> and a doctype.html file containing just
 * `<!doctype html>`. This allows the iframe to inherit the service worker
 * and correctly load all the css, js, fonts, images, and other assets.
 *
 * Ideally this issue would be fixed directly in Gutenberg and the patch
 * below would be removed.
 *
 * See https://github.com/WordPress/wordpress-playground/issues/42 for more details
 *
 * ## Why does this code live in the service worker?
 *
 * There's many ways to install the Gutenberg plugin:
 *
 * * Install plugin step
 * * Import a site
 * * Install Gutenberg from the plugin directory
 * * Upload a Gutenberg zip
 *
 * It's too difficult to patch Gutenberg in all these cases, so we blanket-patch
 * all the scripts requested over the network whose names seem to indicate they're
 * related to the Gutenberg plugin.
 */
const controlledIframe = `
window.__playground_ControlledIframe = window.wp.element.forwardRef(function (props, ref) {
	const source = window.wp.element.useMemo(function () {
		/**
		 * A synchronous function to read a blob URL as text.
		 *
		 * @param {string} url
		 * @returns {string}
		 */
		const __playground_readBlobAsText = function (url) {
			try {
			let xhr = new XMLHttpRequest();
			xhr.open('GET', url, false);
			xhr.overrideMimeType('text/plain;charset=utf-8');
			xhr.send();
			return xhr.responseText;
			} catch(e) {
			return '';
			} finally {
			URL.revokeObjectURL(url);
			}
		};
		if (props.srcDoc) {
			// WordPress <= 6.2 uses a srcDoc that only contains a doctype.
			return '/wp-includes/empty.html';
		} else if (props.src && props.src.startsWith('blob:')) {
			// WordPress 6.3 uses a blob URL with doctype and a list of static assets.
			// Let's pass the document content to empty.html and render it there.
			return '/wp-includes/empty.html#' + encodeURIComponent(__playground_readBlobAsText(props.src));
		} else {
			// WordPress >= 6.4 uses a plain HTTPS URL that needs no correction.
			return props.src;
		}
	}, [props.src]);
	return (
		window.wp.element.createElement('iframe', {
			...props,
			ref: ref,
			src: source,
			// Make sure there's no srcDoc, as it would interfere with the src.
			srcDoc: undefined
		})
	)
});`;

/**
 * The empty HTML file loaded by the patched editor iframe.
 */
function emptyHtml() {
	return new Response(
		'<!doctype html><script>const hash = window.location.hash.substring(1); if ( hash ) document.write(decodeURIComponent(hash))</script>',
		{
			status: 200,
			headers: {
				'content-type': 'text/html',
			},
		}
	);
}

async function bootServiceWorker() {
	const isServiceWorkerRegistered = (
		await fetch(`${LOOPBACK_SW_URL}/test.html`)
	).ok;
	if (!isServiceWorkerRegistered) {
		// Register the service worker
		const iframe = document.querySelector(
			'#playground-remote-service-worker'
		) as any;
		iframe.src = `${LOOPBACK_SW_URL}/register.html`;
		await new Promise((resolve) => {
			iframe.addEventListener('load', resolve);
		});
	}
}

async function bootWorker() {
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
		siteUrl: LOOPBACK_SW_URL,
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

	const url = LOOPBACK_SW_URL;
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
