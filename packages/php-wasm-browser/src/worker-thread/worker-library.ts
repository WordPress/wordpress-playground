/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
declare const window: any; // For the web backend

/* eslint-disable no-inner-declarations */

import { startPHP, PHPBrowser, PHPServer } from 'php-wasm';
import type { PHP, JavascriptRuntime } from 'php-wasm';
import { responseTo } from '../messaging';
import { DEFAULT_BASE_URL } from '../utils';
import EmscriptenDownloadMonitor from '../emscripten-download-monitor';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';
import { getURLScope } from '../scope';
export * from '../scope';

/**
 * Call this in a worker thread script to set the stage for
 * offloading the PHP processing. This function:
 *
 * * Initializes the PHP runtime
 * * Starts PHPServer and PHPBrowser
 * * Lets the main app know when its ready
 * * Listens for messages from the main app
 * * Runs the requested operations (like `run_php`)
 * * Replies to the main app with the results using the [request/reply protocol](#request-reply-protocol)
 *
 * Remember: The worker thread code must live in a separate JavaScript file.
 *
 * A minimal worker thread script looks like this:
 *
 * ```js
 * import { initializeWorkerThread } from 'php-wasm-browser';
 * initializeWorkerThread();
 * ```
 *
 * You can customize the PHP loading flow via the first argument:
 *
 * ```js
 * import { initializeWorkerThread, loadPHPWithProgress } from 'php-wasm-browser';
 * initializeWorkerThread( bootBrowser );
 *
 * async function bootBrowser({ absoluteUrl }) {
 *     const [phpLoaderModule, myDependencyLoaderModule] = await Promise.all([
 *         import(`/php.js`),
 *         import(`/wp.js`)
 *     ]);
 *
 *     const php = await loadPHPWithProgress(phpLoaderModule, [myDependencyLoaderModule]);
 *
 *     const server = new PHPServer(php, {
 *         documentRoot: '/www',
 *         absoluteUrl: absoluteUrl
 *     });
 *
 *     return new PHPBrowser(server);
 * }
 * ```
 *
 * @param  config The worker thread configuration.
 * @return The backend object to communicate with the parent thread.
 */
export async function initializeWorkerThread(
	config: WorkerThreadConfiguration
): Promise<any> {
	const phpBrowser = config.phpBrowser || (await defaultBootBrowser());
	const broadcastChannel =
		config.broadcastChannel || new BroadcastChannel('php-wasm-browser');

	const absoluteUrl = phpBrowser.server.absoluteUrl;
	const scope = getURLScope(new URL(absoluteUrl));

	// Handle postMessage communication from the main thread
	currentBackend.setMessageListener(async (event) => {
		const result = await handleMessage(event.data);

		// When `requestId` is present, the other thread expects a response:
		if (event.data.requestId) {
			const response = responseTo(event.data.requestId, result);
			currentBackend.postMessageToParent(response);
		}
	});

	broadcastChannel.addEventListener(
		'message',
		async function onMessage(event) {
			console.log('broadcastChannel message', event);
			/**
			 * Ignore events meant for other PHP instances to
			 * avoid handling the same event twice.
			 *
			 * This is important because BroadcastChannel transmits
			 * events to all the listeners across all browser tabs.
			 */
			if (scope && event.data.scope !== scope) {
				return;
			}

			const result = await handleMessage(event.data);

			// The service worker expects a response when it includes a `requestId` in the message:
			if (event.data.requestId) {
				const response = responseTo(event.data.requestId, result);
				broadcastChannel.postMessage(response);
			}
		}
	);

	async function handleMessage(message) {
		console.debug(
			`[Worker Thread] "${message.type}" message received from a service worker`
		);

		if (message.type === 'is_alive') {
			return true;
		} else if (message.type === 'get_absolute_url') {
			return phpBrowser.server.absoluteUrl;
		} else if (message.type === 'run_php') {
			return await phpBrowser.server.php.run(message.code);
		} else if (message.type === 'request') {
			return await renderRequest(message.request);
		}
		throw new Error(
			`[Worker Thread] Received unexpected message: "${message.type}"`
		);
	}

	async function renderRequest(request) {
		const parsedUrl = new URL(request.path, DEFAULT_BASE_URL);
		return await phpBrowser.request({
			...request,
			path: parsedUrl.pathname,
			queryString: parsedUrl.search,
		});
	}

	return currentBackend;
}

interface WorkerThreadConfiguration {
	/**
	 * The PHP browser instance to use.
	 */
	phpBrowser?: PHPBrowser;
	/**
	 * The broadcast channel to use for communication
	 *  with the service worker.
	 */
	broadcastChannel?: BroadcastChannel;
}

async function defaultBootBrowser({ absoluteUrl = location.origin } = {}) {
	return new PHPBrowser(
		new PHPServer(await startPHP('/php.js', currentBackend.jsEnv), {
			absoluteUrl,
			documentRoot: '/www',
		})
	);
}

interface WorkerThreadBackend {
	jsEnv: JavascriptRuntime;
	setMessageListener(handler: any);
	postMessageToParent(message: any);
}

const webBackend: WorkerThreadBackend = {
	jsEnv: 'WEB' as JavascriptRuntime, // Matches the Env argument in php.js
	setMessageListener(handler) {
		window.addEventListener(
			'message',
			(event) =>
				handler(event, (response) =>
					event.source!.postMessage(response, '*' as any)
				),
			false
		);
	},
	postMessageToParent(message) {
		window.parent.postMessage(message, '*');
	},
};

const webWorkerBackend: WorkerThreadBackend = {
	jsEnv: 'WORKER' as JavascriptRuntime, // Matches the Env argument in php.js
	setMessageListener(handler) {
		onmessage = (event) => {
			handler(event, postMessage);
		};
	},
	postMessageToParent(message) {
		postMessage(message);
	},
};

/**
 * @returns
 */
export const currentBackend: WorkerThreadBackend = (function () {
	/* eslint-disable no-undef */
	if (typeof window !== 'undefined') {
		return webBackend;
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof WorkerGlobalScope
	) {
		return webWorkerBackend;
	}
	throw new Error(`Unsupported environment`);

	/* eslint-enable no-undef */
})();

/**
 * Call this in a Worker Thread to start load the PHP runtime
 * and post the progress to the main thread.
 *
 * @see startPHP
 * @param  phpLoaderModule         The ESM-wrapped Emscripten module. Consult the Dockerfile for the build process.
 * @param  dataDependenciesModules A list of the ESM-wrapped Emscripten data dependency modules.
 * @param  phpModuleArgs           The Emscripten module arguments, see https://emscripten.org/docs/api_reference/module.html#affecting-execution.
 * @returns PHP instance.
 */
export async function loadPHPWithProgress(
	phpLoaderModule: any,
	dataDependenciesModules: any[] = [],
	phpModuleArgs: any = {}
): Promise<PHP> {
	const modules = [phpLoaderModule, ...dataDependenciesModules];

	const assetsSizes = modules.reduce((acc, module) => {
		acc[module.dependencyFilename] = module.dependenciesTotalSize;
		return acc;
	}, {});
	const downloadMonitor = new EmscriptenDownloadMonitor(assetsSizes);
	(downloadMonitor as any).addEventListener(
		'progress',
		(e: CustomEvent<DownloadProgressEvent>) =>
			currentBackend.postMessageToParent({
				type: 'download_progress',
				...e.detail,
			})
	);

	return await startPHP(
		phpLoaderModule,
		currentBackend.jsEnv,
		{
			...phpModuleArgs,
			...downloadMonitor.phpArgs,
		},
		dataDependenciesModules
	);
}
