/// <reference lib="WebWorker" />

import {
	PHPRequestErrorEvent,
	UniversalPHP,
} from '@php-wasm/universal/src/lib/universal-php';
import type { Logger } from './logger';

let windowConnected = false;

/**
 * Log Windows errors.
 *
 * @param loggerInstance The logger instance
 * @param ErrorEvent event
 */
function logWindowError(loggerInstance: Logger, event: ErrorEvent) {
	loggerInstance.addLogEntry(
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
	loggerInstance.addLogEntry(message, 'Error');
}

/**
 * Register a listener for service worker messages and log the data.
 * The service worker will send the number of open Playground tabs.
 *
 * @param loggerInstance The logger instance
 */
function addServiceWorkerMessageListener(loggerInstance: Logger) {
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.numberOfOpenPlaygroundTabs !== undefined) {
			loggerInstance.addContext({
				numberOfOpenPlaygroundTabs:
					event.data.numberOfOpenPlaygroundTabs,
			});
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
 * @param UniversalPHP playground instance
 * @returns string The content of the debug.log file
 */
async function getRequestPhpErrorLog(playground: UniversalPHP) {
	if (!(await playground.fileExists(errorLogPath))) {
		return '';
	}
	return await playground.readFileAsText(errorLogPath);
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
	playground.addEventListener('request.end', async () => {
		const log = await getRequestPhpErrorLog(playground);
		if (log.length > lastPHPLogLength) {
			const currentLog = log.substring(lastPHPLogLength);
			loggerInstance.addRawLogEntry(currentLog);
			loggerInstance.consoleLog(currentLog);
			lastPHPLogLength = log.length;
		}
	});
	playground.addEventListener('request.error', (event) => {
		event = event as PHPRequestErrorEvent;
		if (event.error) {
			loggerInstance.addLogEntry(
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
 * **Call this inside a service worker.**
 * These errors include Playground errors like Asyncify errors. PHP errors won't trigger this event.
 *
 * Reports service worker metrics.
 * Allows the logger to request metrics from the service worker by sending a message.
 * The service worker will respond with the number of open Playground tabs.
 *
 * @param worker The service worker
 */
export function reportServiceWorkerMetrics(worker: ServiceWorkerGlobalScope) {
	worker.addEventListener('activate', () => {
		worker.clients.matchAll().then((clients) => {
			const metrics = {
				numberOfOpenPlaygroundTabs: clients.filter(
					// Only count top-level frames to get the number of tabs.
					(c) => c.frameType === 'top-level'
				).length,
			};
			worker.clients
				.matchAll({
					// We don't claim the clients, so we need to include uncontrolled clients to inform all tabs.
					includeUncontrolled: true,
				})
				.then((clients) => {
					for (const client of clients) {
						client.postMessage(metrics);
					}
				});
		});
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
