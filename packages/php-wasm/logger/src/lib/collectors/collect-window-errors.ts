import { Logger } from '../logger';

/**
 * Log Windows errors.
 *
 * @param loggerInstance The logger instance
 * @param ErrorEvent event
 */
function logWindowError(loggerInstance: Logger, event: ErrorEvent) {
	loggerInstance.logMessage({
		message: `${event.message} in ${event.filename} on line ${event.lineno}:${event.colno}`,
		severity: 'Error',
	});
}

/**
 * Log promise rejections.
 *
 * @param loggerInstance The logger instance
 * @param PromiseRejectionEvent event
 */
function logPromiseRejection(
	loggerInstance: Logger,
	event: PromiseRejectionEvent
) {
	// No reason was provided, so we can't log anything.
	if (!event?.reason) {
		return;
	}
	const message = event?.reason.stack ?? event.reason;
	loggerInstance.logMessage({
		message,
		severity: 'Error',
	});
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

// If the window events are already connected.
let windowConnected = false;

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
		logPromiseRejection(loggerInstance, event as PromiseRejectionEvent)
	);
	window.addEventListener('rejectionhandled', (event) =>
		logPromiseRejection(loggerInstance, event as PromiseRejectionEvent)
	);
	windowConnected = true;
}
