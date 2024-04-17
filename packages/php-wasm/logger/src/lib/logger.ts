/* eslint-disable no-console */

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
	// TODO set to false and allow to enable it via APIs
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
	public formatLogEntry(
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
	public addLogEntry(
		message: any,
		severity?: LogSeverity,
		prefix?: LogPrefix
	): void {
		if (severity === undefined) {
			severity = 'Info';
		}
		const log = this.formatLogEntry(
			message,
			severity,
			prefix ?? 'Playground'
		);
		this.addRawLogEntry(log);
	}

	/**
	 * Log message without severity and timestamp.
	 * @param string log
	 * @returns void
	 */
	public addRawLogEntry(log: string): void {
		this.logs.push(log);
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

	private prepareLogMessage(message: any, ...args: any[]): string {
		return [
			typeof message === 'object' ? JSON.stringify(message) : message,
			...args.map((arg) => JSON.stringify(arg)),
		].join(' ');
	}

	/**
	 * Log message with severity.
	 *
	 * @param message any
	 * @param severity LogSeverity
	 * @param args any
	 */
	private logMessage(
		message: any,
		severity?: LogSeverity,
		...args: any[]
	): void {
		this.addLogEntry(this.prepareLogMessage(message, ...args), severity);
		this.consoleLog(message, severity, ...args);
	}

	/**
	 * Log message
	 *
	 * @param message any
	 * @param args any
	 */
	public log(message: any, ...args: any[]): void {
		this.logMessage(message, undefined, ...args);
	}

	/**
	 * Log debug message
	 *
	 * @param message any
	 * @param args any
	 */
	public debug(message: any, ...args: any[]): void {
		this.logMessage(message, 'Debug', ...args);
	}

	/**
	 * Log info message
	 *
	 * @param message any
	 * @param args any
	 */
	public info(message: any, ...args: any[]): void {
		this.logMessage(message, 'Info', ...args);
	}

	/**
	 * Log warning message
	 *
	 * @param message any
	 * @param args any
	 */
	public warn(message: any, ...args: any[]): void {
		this.logMessage(message, 'Warn', ...args);
	}

	/**
	 * Log error message
	 *
	 * @param message any
	 * @param args any
	 */
	public error(message: any, ...args: any[]): void {
		this.logMessage(message, 'Error', ...args);
	}

	/**
	 * Log message to the console.
	 * @param string log
	 * @param LogSeverity severity
	 * @param any args
	 * @returns void
	 */
	public consoleLog(
		log: string,
		severity?: LogSeverity,
		...args: any[]
	): void {
		if (!this.consoleLogging) {
			return;
		}
		switch (severity) {
			case 'Debug':
				console.debug(log, ...args);
				break;
			case 'Info':
				console.info(log, ...args);
				break;
			case 'Warn':
				console.warn(log, ...args);
				break;
			case 'Error':
				console.error(log, ...args);
				break;
			case 'Fatal':
				console.error(log, ...args);
				break;
			default:
				console.log(log, ...args);
		}
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
