/* eslint-disable no-console */
/// <reference lib="WebWorker" />

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
	 * Context data
	 */
	private context: Record<string, any> = {};

	/**
	 * Enable console logging.
	 */
	private consoleLogging = true;

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
		message: any,
		severity: LogSeverity,
		prefix: string
	): string {
		if (typeof message === 'object') {
			message = JSON.stringify(message);
		}
		const now = this.formatLogDate(new Date());
		return `[${now}] ${prefix} ${severity}: ${message}`;
	}

	/**
	 * Log message with severity and timestamp.
	 * @param any message
	 * @param LogSeverity severity
	 * @param string prefix
	 */
	public addLogMessage(
		message: any,
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
		this.addRawLogMessage(log);
		this.consoleLog(log, severity);
	}

	/**
	 * Log message without severity and timestamp.
	 * @param string log
	 * @returns void
	 */
	public addRawLogMessage(log: string): void {
		this.logs.push(log);
	}

	/**
	 * Log message to the console.
	 * @param string log
	 * @param LogSeverity severity
	 * @returns void
	 */
	public consoleLog(log: string, severity?: LogSeverity): void {
		if (!this.consoleLogging) {
			return;
		}
		switch (severity) {
			case 'Debug':
				console.debug(log);
				break;
			case 'Info':
				console.info(log);
				break;
			case 'Warn':
				console.warn(log);
				break;
			case 'Error':
				console.error(log);
				break;
			case 'Fatal':
				console.error(log);
				break;
			default:
				console.log(log);
		}
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

	/**
	 * Log message
	 */
	public log(message: any): void {
		this.addLogMessage(message);
	}

	/**
	 * Log debug message
	 */
	public debug(message: any): void {
		this.addLogMessage(message, 'Debug');
	}

	/**
	 * Log info message
	 */
	public info(message: any): void {
		this.addLogMessage(message, 'Info');
	}

	/**
	 * Log warning message
	 */
	public warn(message: any): void {
		this.addLogMessage(message, 'Warn');
	}

	/**
	 * Log error message
	 */
	public error(message: any): void {
		this.addLogMessage(message, 'Error');
	}

	/**
	 * Enable console logging.
	 */
	public enableConsoleLogging(): void {
		this.consoleLogging = true;
	}
}

/**
 * The logger instance.
 */
export const logger: Logger = new Logger();
