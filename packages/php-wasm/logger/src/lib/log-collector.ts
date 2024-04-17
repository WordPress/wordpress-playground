import {
	PHPRequestErrorEvent,
	UniversalPHP,
} from '@php-wasm/universal/src/lib/universal-php';
import { Logger } from './logger';

let windowConnected = false;

/**
 * Log Windows errors.
 *
 * @param loggerInstance The logger instance
 * @param ErrorEvent event
 */
function logWindowError(loggerInstance: Logger, event: ErrorEvent) {
	loggerInstance.addLogMessage(
		`${event.message} in ${event.filename} on line ${event.lineno}:${event.colno}`,
		'Error'
	);
}

/**
 * Log unhandled promise rejections.
 *
 * @param loggerInstance The logger instance
 * @param PromiseRejectionEvent event
 */
function logUnhandledRejection(
	loggerInstance: Logger,
	event: PromiseRejectionEvent
) {
	// No reason was provided, so we can't log anything.
	if (!event?.reason) {
		return;
	}
	const message = event?.reason.stack ?? event.reason;
	loggerInstance.addLogMessage(message, 'Error');
}

/**
 * Register a listener for service worker messages and log the data.
 *
 * @param loggerInstance The logger instance
 */
function addServiceWorkerMessageListener(loggerInstance: Logger) {
	const requestClientInfo = () => {
		if (!navigator.serviceWorker.controller) {
			return;
		}
		navigator.serviceWorker.controller.postMessage('getClientInfo');
	};
	requestClientInfo();
	navigator.serviceWorker.addEventListener(
		'controllerchange',
		requestClientInfo
	);
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data.clientCount) {
			loggerInstance.addContext({ clientCount: event.data.clientCount });
		}
	});
}

/**
 * Collect errors from JavaScript window events like error and log them.
 * @param loggerInstance The logger instance
 */
export function collectWindowErrors(loggerInstance: Logger) {
	// Ensure that the window events are connected only once.
	if (windowConnected) {
		return;
	}
	addServiceWorkerMessageListener(loggerInstance);
	if (typeof window === 'undefined') {
		return;
	}

	window.addEventListener('error', (event) =>
		logWindowError(loggerInstance, event as ErrorEvent)
	);
	window.addEventListener('unhandledrejection', (event) =>
		logUnhandledRejection(loggerInstance, event as PromiseRejectionEvent)
	);
	window.addEventListener('rejectionhandled', (event) =>
		logUnhandledRejection(loggerInstance, event as PromiseRejectionEvent)
	);
	windowConnected = true;
}

let lastPHPLogLength = 0;
const errorLogPath = '/wordpress/wp-content/debug.log';

/**
 * Read the WordPress debug.log file and return its content.
 *
 * @param loggerInstance The logger instance
 * @param UniversalPHP playground instance
 * @returns string The content of the debug.log file
 */
async function getRequestPhpErrorLog(
	loggerInstance: Logger,
	playground: UniversalPHP
) {
	if (!(await playground.fileExists(errorLogPath))) {
		return '';
	}
	return await playground.readFileAsText(errorLogPath);
}

/**
 * Register a listener for the request.end event and log the data.
 *
 * @param loggerInstance The logger instance
 * @param UniversalPHP playground instance
 */
function addPlaygroundRequestEndListener(
	loggerInstance: Logger,
	playground: UniversalPHP
) {
	playground.addEventListener('request.end', async () => {
		const log = await getRequestPhpErrorLog(loggerInstance, playground);
		if (log.length > lastPHPLogLength) {
			loggerInstance.addRawLogMessage(log.substring(lastPHPLogLength));
			loggerInstance.consoleLog(log.substring(lastPHPLogLength));
			lastPHPLogLength = log.length;
		}
	});
	playground.addEventListener('request.error', (event) => {
		event = event as PHPRequestErrorEvent;
		if (event.error) {
			loggerInstance.addLogMessage(
				`${event.error.message} ${event.error.stack}`,
				'Fatal',
				'PHP-WASM'
			);
			loggerInstance.dispatchEvent(
				new CustomEvent(loggerInstance.fatalErrorEvent, {
					detail: {
						logs: loggerInstance.getLogs(),
						source: event.source,
					},
				})
			);
		}
	});
}

/**
 * Collect PHP logs from the error_log file and log them.
 * @param UniversalPHP playground instance
 * @param loggerInstance The logger instance
 */
export function collectPhpLogs(
	loggerInstance: Logger,
	playground: UniversalPHP
) {
	addPlaygroundRequestEndListener(loggerInstance, playground);
}

/**
 * Collect worker metrics.
 *
 * @param worker The service worker
 */
export function collectWorkerMetrics(worker: ServiceWorkerGlobalScope) {
	worker.addEventListener('activate', (event) => {
		event.waitUntil(worker.clients.claim());
	});
	worker.addEventListener('message', (event) => {
		if (event.data === 'getClientInfo') {
			worker.clients.matchAll().then((clients) => {
				if (!event.source) {
					return;
				}
				event.source.postMessage({
					clientCount: clients.filter(
						// Only count top-level frames to get the number of tabs.
						(c) => c.frameType === 'top-level'
					).length,
				});
			});
		}
	});
}

/**
 * Add a listener for the Playground crashes.
 * These crashes include Playground errors like Asyncify errors.
 * The callback function will receive an Event object with logs in the detail property.
 *
 * @param loggerInstance The logger instance
 * @param callback The callback function
 */
export function addCrashListener(
	loggerInstance: Logger,
	callback: EventListenerOrEventListenerObject
) {
	loggerInstance.addEventListener(loggerInstance.fatalErrorEvent, callback);
}
