import { Logger } from '../logger';

/**
 * Log Windows errors.
 *
 * @param loggerInstance The logger instance
 * @param ErrorEvent event
 */
const logWindowError = (loggerInstance: Logger, event: ErrorEvent) => {
	loggerInstance.logMessage({
		message: `${event.message} in ${event.filename} on line ${event.lineno}:${event.colno}`,
		severity: 'Error',
	});
};

/**
 * Log promise rejections.
 *
 * @param loggerInstance The logger instance
 * @param PromiseRejectionEvent event
 */
const logPromiseRejection = (
	loggerInstance: Logger,
	event: PromiseRejectionEvent
) => {
	// No reason was provided, so we can't log anything.
	if (!event?.reason) {
		return;
	}
	const message = event?.reason.stack ?? event.reason;
	loggerInstance.logMessage({
		message,
		severity: 'Error',
	});
};

/**
 * The number of open Playground tabs.
 */
let numberOfOpenPlaygroundTabs = 0;

/**
 * Register a listener for service worker messages and log the data.
 * The service worker will send the number of open Playground tabs.
 *
 * @param loggerInstance The logger instance
 */
const addServiceWorkerMessageListener = (loggerInstance: Logger) => {
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.numberOfOpenPlaygroundTabs === undefined) {
			return;
		}
		// Each tab sends an activate event on load. Prevent sending the same metrics multiple times if a tab is reloaded.
		if (
			numberOfOpenPlaygroundTabs ===
			event.data?.numberOfOpenPlaygroundTabs
		) {
			return;
		}
		numberOfOpenPlaygroundTabs = event.data?.numberOfOpenPlaygroundTabs;
		loggerInstance.debug(
			`Number of open Playground tabs is: ${numberOfOpenPlaygroundTabs}`
		);
	});
};

// If the window events are already connected.
let windowConnected = false;

/**
 * Collect errors from JavaScript window events like error and log them.
 * @param loggerInstance The logger instance
 */
export const collectWindowErrors = (loggerInstance: Logger) => {
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
};
