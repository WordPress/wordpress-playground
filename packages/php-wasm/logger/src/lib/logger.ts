/// <reference lib="WebWorker" />

import {
	PHPRequestErrorEvent,
	UniversalPHP,
} from '@php-wasm/universal/src/lib/universal-php';
/**
 * Log severity levels.
 */
export type LogSeverity = 'Debug' | 'Info' | 'Warn' | 'Error' | 'Fatal';

/**
 * Log prefix.
 */
export type LogPrefix = 'Playground' | 'PHP-WASM';

/**
 * A logger for Playground.
 */
export class Logger extends EventTarget {
	public readonly fatalErrorEvent = 'playground-fatal-error';

	/**
	 * Log messages
	 */
	private logs: string[] = [];

	/**
	 * Whether the window events are connected.
	 */
	private windowConnected = false;

	/**
	 * The length of the last PHP log.
	 */
	private lastPHPLogLength = 0;

	/**
	 * Context data
	 */
	private context: Record<string, any> = {};

	/**
	 * The path to the error log file.
	 */
	private errorLogPath = '/wordpress/wp-content/debug.log';

	constructor(errorLogPath?: string) {
		super();
		if (errorLogPath) {
			this.errorLogPath = errorLogPath;
		}
	}

	/**
	 * Read the WordPress debug.log file and return its content.
	 *
	 * @param UniversalPHP playground instance
	 * @returns string The content of the debug.log file
	 */
	private async getRequestPhpErrorLog(playground: UniversalPHP) {
		if (!(await playground.fileExists(this.errorLogPath))) {
			return '';
		}
		return await playground.readFileAsText(this.errorLogPath);
	}

	/**
	 * Log Windows errors.
	 *
	 * @param ErrorEvent event
	 */
	private logWindowError(event: ErrorEvent) {
		this.log(
			`${event.message} in ${event.filename} on line ${event.lineno}:${event.colno}`,
			'Error'
		);
	}

	/**
	 * Log unhandled promise rejections.
	 *
	 * @param PromiseRejectionEvent event
	 */
	private logUnhandledRejection(event: PromiseRejectionEvent) {
		// No reason was provided, so we can't log anything.
		if (!event?.reason) {
			return;
		}
		const message = event?.reason.stack ?? event.reason;
		this.log(message, 'Error');
	}

	/**
	 * Register a listener for the window error events and log the data.
	 */
	public addWindowErrorListener() {
		// Ensure that the window events are connected only once.
		if (this.windowConnected) {
			return;
		}
		if (typeof window === 'undefined') {
			return;
		}

		window.addEventListener('error', this.logWindowError.bind(this));
		window.addEventListener(
			'unhandledrejection',
			this.logUnhandledRejection.bind(this)
		);
		window.addEventListener(
			'rejectionhandled',
			this.logUnhandledRejection.bind(this)
		);
		this.windowConnected = true;
	}

	/**
	 * Register a listener for service worker messages and log the data.
	 * The service worker will send the number of open Playground tabs.
	 */
	public addServiceWorkerMessageListener() {
		navigator.serviceWorker.addEventListener('message', (event) => {
			if (event.data?.numberOfOpenPlaygroundTabs !== undefined) {
				this.addContext({
					numberOfOpenPlaygroundTabs:
						event.data.numberOfOpenPlaygroundTabs,
				});
			}
		});
	}

	/**
	 * Register a listener for the request.end event and log the data.
	 * @param UniversalPHP playground instance
	 */
	public addPlaygroundRequestEndListener(playground: UniversalPHP) {
		playground.addEventListener('request.end', async () => {
			const log = await this.getRequestPhpErrorLog(playground);
			if (log.length > this.lastPHPLogLength) {
				this.logRaw(log.substring(this.lastPHPLogLength));
				this.lastPHPLogLength = log.length;
			}
		});
		playground.addEventListener('request.error', (event) => {
			event = event as PHPRequestErrorEvent;
			if (event.error) {
				this.log(
					`${event.error.message} ${event.error.stack}`,
					'Fatal',
					'PHP-WASM'
				);
				this.dispatchEvent(
					new CustomEvent(this.fatalErrorEvent, {
						detail: {
							logs: this.getLogs(),
							source: event.source,
						},
					})
				);
			}
		});
	}

	/**
	 * Get UTC date in the PHP log format https://github.com/php/php-src/blob/master/main/main.c#L849
	 *
	 * @param date
	 * @returns string
	 */
	private formatLogDate(date: Date): string {
		const formattedDate = new Intl.DateTimeFormat('en-GB', {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			timeZone: 'UTC',
		})
			.format(date)
			.replace(/ /g, '-');

		const formattedTime = new Intl.DateTimeFormat('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
			timeZone: 'UTC',
			timeZoneName: 'short',
		}).format(date);
		return formattedDate + ' ' + formattedTime;
	}

	/**
	 * Format log message and severity and log it.
	 * @param string message
	 * @param LogSeverity severity
	 * @param string prefix
	 */
	public formatMessage(
		message: string,
		severity: LogSeverity,
		prefix: string
	): string {
		const now = this.formatLogDate(new Date());
		return `[${now}] ${prefix} ${severity}: ${message}`;
	}

	/**
	 * Log message with severity and timestamp.
	 * @param string message
	 * @param LogSeverity severity
	 * @param string prefix
	 */
	public log(
		message: string,
		severity?: LogSeverity,
		prefix?: LogPrefix
	): void {
		if (severity === undefined) {
			severity = 'Info';
		}
		const log = this.formatMessage(
			message,
			severity,
			prefix ?? 'Playground'
		);
		this.logRaw(log);
	}

	/**
	 * Log message without severity and timestamp.
	 * @param string log
	 */
	public logRaw(log: string): void {
		this.logs.push(log);
		console.debug(log);
	}

	/**
	 * Get all logs.
	 * @returns string[]
	 */
	public getLogs(): string[] {
		return [...this.logs];
	}

	/**
	 * Add context data.
	 */
	public addContext(data: Record<string, any>): void {
		this.context = { ...this.context, ...data };
	}

	/**
	 * Get context data.
	 */
	public getContext(): Record<string, any> {
		return { ...this.context };
	}
}

/**
 * The logger instance.
 */
export const logger: Logger = new Logger();

/**
 * Collect errors from JavaScript window events like error and log them.
 * @param loggerInstance The logger instance
 */
export function collectWindowErrors(loggerInstance: Logger) {
	loggerInstance.addWindowErrorListener();
	loggerInstance.addServiceWorkerMessageListener();
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
	loggerInstance.addPlaygroundRequestEndListener(playground);
}

/**
 * **Call this inside a service worker.**
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
