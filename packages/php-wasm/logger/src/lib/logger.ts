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
		this.log(`${event.reason.stack}`, 'Error');
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
		return this.logs;
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
 * Add a listener for the fatal Playground errors.
 * These errors include Playground errors like Asyncify errors. PHP errors won't trigger this event.
 * The callback function will receive an Event object with logs in the detail property.
 *
 * @param loggerInstance The logger instance
 * @param callback The callback function
 */
export function addFatalErrorListener(
	loggerInstance: Logger,
	callback: EventListenerOrEventListenerObject
) {
	loggerInstance.addEventListener(loggerInstance.fatalErrorEvent, callback);
}
