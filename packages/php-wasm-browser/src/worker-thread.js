/* eslint-disable no-inner-declarations */

import { startPHP, PHPBrowser, PHPServer } from 'php-wasm';
import { responseTo } from './messaging';
import { DEFAULT_BASE_URL } from './urls';
import EmscriptenDownloadMonitor from './emscripten-download-monitor';

const noop = () => { };
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
 * @param {async ({absoluteUrl}) => PHPBrowser} bootBrowser An async function that produces the PHP browser.
 */
export async function initializeWorkerThread(bootBrowser=defaultBootBrowser) {
	// Handle postMessage communication from the main thread
	currentBackend.setMessageListener(async event => {
		const result = await handleMessage(event.data);

		// When `messageId` is present, the other thread expects a response:
		if (event.data.messageId) {
			const response = responseTo(event.data.messageId, result);
			currentBackend.postMessageToParent(response);
		}
	});

	let phpBrowser;
	async function handleMessage(message) {
		if (message.type === 'initialize_php') {
			phpBrowser = await bootBrowser({
				absoluteUrl: message.absoluteUrl
			});
		}
		else if (message.type === 'is_alive') {
			return true;
		}
		else if (message.type === 'run_php') {
			return await phpBrowser.server.php.run(message.code);
		}
		else if (message.type === 'request') {
			const parsedUrl = new URL(
				message.request.path,
				DEFAULT_BASE_URL
			);
			return await phpBrowser.request({
				...message.request,
				path: parsedUrl.pathname,
				queryString: parsedUrl.search,
			});
		} else {
			console.warn(
				`[WASM Worker] "${message.type}" event received but it has no handler.`
			);
		}
	}
}

async function defaultBootBrowser({ absoluteUrl }) {
	return new PHPBrowser(
		new PHPServer(
			await startPHP('/php.js', currentBackend.jsEnv, phpArgs),
			{
				absoluteUrl: absoluteUrl || location.origin
			}
		)
	)
}

const webBackend = {
    jsEnv: 'WEB', // Matches the Env argument in php.js
    setMessageListener(handler) {
        window.addEventListener(
            'message',
            (event) =>
                handler(event, (response) =>
                    event.source.postMessage(response, '*')
                ),
            false
        );
    },
    postMessageToParent(message) {
        window.parent.postMessage(message, '*');
    }
}

const webWorkerBackend = {
    jsEnv: 'WORKER', // Matches the Env argument in php.js
    setMessageListener(handler) {
        onmessage = (event) => {
            handler(event, postMessage);
        };
    },
    postMessageToParent(message) {
        postMessage(message);
    }
}

/**
 * @returns 
 */
export const currentBackend = (function () {
    /* eslint-disable no-undef */
    if (typeof window !== 'undefined') {
        return webBackend;
    } else if (typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope) {
        return webWorkerBackend;
    } else {
        throw new Error(`Unsupported environment`);
    }
    /* eslint-enable no-undef */
})();

