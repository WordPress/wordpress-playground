/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
declare const window: any; // For the web backend

/* eslint-disable no-inner-declarations */

import { startPHP, PHPBrowser, PHPServer } from '../../php-wasm';
import type { PHP, JavascriptRuntime } from '../../php-wasm';
import { responseTo } from '../messaging';
import { DEFAULT_BASE_URL } from '../utils';
import EmscriptenDownloadMonitor from '../emscripten-download-monitor';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';
import { getURLScope } from '../scope';
import { FileInfo } from '../../php-wasm/php';
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
	const middleware = config.middleware || ((message, next) => next(message));

	const absoluteUrl = phpBrowser.server.absoluteUrl;
	const scope = getURLScope(new URL(absoluteUrl));

	// Handle postMessage communication from the main thread
	currentBackend.setMessageListener(async (event) => {
		const result = await middleware(event.data, doHandleMessage);

		// When `requestId` is present, the other thread expects a response:
		if (event.data.requestId) {
			const response = responseTo(event.data.requestId, result);
			currentBackend.postMessageToParent(response);
		}
	});

	async function doHandleMessage(message) {
		console.debug(
			`[Worker Thread] "${message.type}" message received from a service worker`
		);

		if (message.type === 'isAlive') {
			return true;
		} else if (message.type === 'getAbsoluteUrl') {
			return phpBrowser.server.absoluteUrl;
		} else if (message.type === 'getScope') {
			return scope;
		} else if (message.type === 'readFile') {
			return phpBrowser.server.php.readFileAsText(message.path);
		} else if (message.type === 'listFiles') {
			return phpBrowser.server.php.listFiles(message.path);
		} else if (message.type === 'unlink') {
			return phpBrowser.server.php.unlink(message.path);
		} else if (message.type === 'isDir') {
			return phpBrowser.server.php.isDir(message.path);
		} else if (message.type === 'mkdirTree') {
			return phpBrowser.server.php.mkdirTree(message.path);
		} else if (message.type === 'writeFile') {
			return await phpBrowser.server.php.writeFile(
				message.path,
				message.contents
			);
		} else if (message.type === 'fileExists') {
			return await phpBrowser.server.php.fileExists(message.path);
		} else if (message.type === 'run') {
			return phpBrowser.server.php.run(message.code);
		} else if (message.type === 'HTTPRequest') {
			return await renderRequest(message.request);
		}
		throw new Error(
			`[Worker Thread] Received unexpected message: "${message.type}"`
		);
	}

	async function renderRequest(request) {
		const fileInfos: FileInfo[] = [];
		if (request.files) {
			for (const key in request.files) {
				const file: File = request.files[key];
				fileInfos.push({
					key,
					name: file.name,
					type: file.type,
					data: new Uint8Array(await file.arrayBuffer()),
				});
			}
		}
		return await phpBrowser.request({
			...request,
			files: fileInfos,
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
	 * Middleware to run before handing a message.
	 */
	middleware?: (message, next) => Promise<any>;
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
	getOptions: () => Record<string, string>;
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
	getOptions() {
		return searchParamsToObject(new URL(window.location).searchParams);
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
	getOptions() {
		return searchParamsToObject(new URL(self.location.href).searchParams);
	},
};

function searchParamsToObject(params: URLSearchParams) {
	const result: Record<string, string> = {};
	params.forEach((value, key) => {
		result[key] = value;
	});
	return result;
}

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
		acc[module.dependencyFilename.split('?')[0]] =
			module.dependenciesTotalSize;
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
