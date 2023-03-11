/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
declare const window: any; // For the web backend
/* eslint-disable no-inner-declarations */

import { startPHP, PHPBrowser, PHPServer } from '../../php-library/index';
import type { PHP, JavascriptRuntime } from '../../php-library/index';
import EmscriptenDownloadMonitor from '../emscripten-download-monitor';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';
import { PHPProtocolHandler } from '../../php-library/php-protocol-handler2';
import { responseTo } from '../../php-library/messaging';
export * from '../../php-library/scope';

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
): Promise<IncomingMessageLink> {
	const HandlerClass = (config.handler || PHPProtocolHandler) as any;
	const phpBrowser = config.phpBrowser || defaultBootBrowser();
	const handler = new HandlerClass(phpBrowser);

	incomingMessageLink.setHandler(handler);
	return incomingMessageLink;
}

async function defaultBootBrowser({ absoluteUrl = location.origin } = {}) {
	return new PHPBrowser(
		new PHPServer(await startPHP('/php.js', incomingMessageLink.jsEnv), {
			absoluteUrl,
			documentRoot: '/www',
		})
	);
}

interface WorkerThreadConfiguration {
	/**
	 * The PHP browser instance to use.
	 */
	phpBrowser?: PHPBrowser;
	/**
	 * Message handler.
	 */
	handler?: PHPProtocolHandler;
}

type Listener = (e: any) => void;
abstract class IncomingMessageLink {
	abstract jsEnv: JavascriptRuntime; // Matches the Env argument in php.js
	listener: Listener | null = null;
	#options: Record<string, any> = {};

	constructor() {
		this.bindEventListener();
		this.#options = this.parseOptions();
	}

	setHandler(handler: PHPProtocolHandler) {
		this.listener = (message) =>
			handler[message.method](...(message.args || []));
	}

	protected async handleMessageEvent(
		event: any,
		respond: any = this.postMessageToParent
	) {
		let result;
		try {
			result = await this.listener!(event.data);
		} catch (error) {
			result = { error: error || 'Unknown error' };
		}

		// When `requestId` is present, the other thread expects a response:
		if (event.data.requestId) {
			const response = responseTo(event.data.requestId, result);
			respond(response);
		}
	}

	getOption(name, _default?: any) {
		return this.getOptions()[name] || _default;
	}

	getOptions() {
		return this.#options;
	}

	abstract postMessageToParent(message: any);
	protected abstract bindEventListener();
	protected abstract parseOptions(): Record<string, any>;
}

class WindowIncomingMessageLink extends IncomingMessageLink {
	jsEnv = 'WEB' as JavascriptRuntime;

	bindEventListener() {
		window.addEventListener(
			'message',
			(event) =>
				this.handleMessageEvent(event, (response) =>
					event.source!.postMessage(response, '*' as any)
				),
			false
		);
	}
	postMessageToParent(message) {
		window.parent.postMessage(message, '*');
	}
	parseOptions() {
		return searchParamsToObject(new URL(window.location).searchParams);
	}
}

class WorkerIncomingMessageLink extends IncomingMessageLink {
	jsEnv = 'WORKER' as JavascriptRuntime;
	bindEventListener() {
		onmessage = (event) => this.handleMessageEvent(event);
	}

	postMessageToParent(message) {
		postMessage(message);
	}

	parseOptions() {
		return searchParamsToObject(new URL(self.location.href).searchParams);
	}
}

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
export const incomingMessageLink: IncomingMessageLink = (function () {
	/* eslint-disable no-undef */
	if (typeof window !== 'undefined') {
		return new WindowIncomingMessageLink();
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof WorkerGlobalScope
	) {
		return new WorkerIncomingMessageLink();
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
export async function loadPHP(
	phpLoaderModule: any,
	dataDependenciesModules: any[] = [],
	phpModuleArgs: any = {}
): Promise<PHP> {
	const modules = [phpLoaderModule, ...dataDependenciesModules];
	const assetsSizes = modules.reduce((acc, module) => {
		if (module.dependenciesTotalSize > 0) {
			const filename = new URL(
				module.dependencyFilename,
				'http://example.com'
			).pathname
				.split('/')
				.pop()!;
			acc[filename] = Math.max(
				filename in acc ? acc[filename] : 0,
				module.dependenciesTotalSize
			);
		}
		return acc;
	}, {} as Record<string, number>);
	const downloadMonitor = new EmscriptenDownloadMonitor(assetsSizes);
	(downloadMonitor as any).addEventListener(
		'progress',
		(e: CustomEvent<DownloadProgressEvent>) =>
			incomingMessageLink.postMessageToParent({
				type: 'download_progress',
				...e.detail,
			})
	);

	return await startPHP(
		phpLoaderModule,
		incomingMessageLink.jsEnv,
		{
			// Emscripten sometimes prepends a '/' to the path, which
			// breaks vite dev mode.
			locateFile: (path) => path,
			...phpModuleArgs,
			...downloadMonitor.phpArgs,
		},
		dataDependenciesModules
	);
}
