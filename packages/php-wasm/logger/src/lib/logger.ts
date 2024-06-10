import { logEvent } from './handlers/log-event';
import { logToMemory, logToConsole, logs } from './log-handlers';

export type Log = {
	message: any;
	severity?: LogSeverity;
	prefix?: LogPrefix;
	raw?: boolean;
};

/**
 * Log severity levels.
 */
export type LogSeverity = 'Debug' | 'Info' | 'Warn' | 'Error' | 'Fatal';

/**
 * Log prefix.
 */
export type LogPrefix = 'WASM Crash' | 'PHP' | 'JavaScript';

/**
 * A logger for Playground.
 */
export class Logger extends EventTarget {
	public readonly fatalErrorEvent = 'playground-fatal-error';

	// constructor
	constructor(
		// Log handlers
		private readonly handlers: Function[] = []
	) {
		super();
	}

	/**
	 * Get all logs.
	 * @returns string[]
	 */
	public getLogs(): string[] {
		if (!this.handlers.includes(logToMemory)) {
			this
				.error(`Logs aren't stored because the logToMemory handler isn't registered.
				If you're using a custom logger instance, make sure to register logToMemory handler.
			`);
			return [];
		}
		return [...logs];
	}

	/**
	 * Log message with severity.
	 *
	 * @param message any
	 * @param severity LogSeverity
	 * @param raw boolean
	 * @param args any
	 */
	public logMessage(log: Log, ...args: any[]): void {
		for (const handler of this.handlers) {
			handler(log, ...args);
		}
	}

	/**
	 * Log message
	 *
	 * @param message any
	 * @param args any
	 */
	public log(message: any, ...args: any[]): void {
		this.logMessage(
			{
				message,
				severity: undefined,
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}

	/**
	 * Log debug message
	 *
	 * @param message any
	 * @param args any
	 */
	public debug(message: any, ...args: any[]): void {
		this.logMessage(
			{
				message,
				severity: 'Debug',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}

	/**
	 * Log info message
	 *
	 * @param message any
	 * @param args any
	 */
	public info(message: any, ...args: any[]): void {
		this.logMessage(
			{
				message,
				severity: 'Info',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}

	/**
	 * Log warning message
	 *
	 * @param message any
	 * @param args any
	 */
	public warn(message: any, ...args: any[]): void {
		this.logMessage(
			{
				message,
				severity: 'Warn',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}

	/**
	 * Log error message
	 *
	 * @param message any
	 * @param args any
	 */
	public error(message: any, ...args: any[]): void {
		this.logMessage(
			{
				message,
				severity: 'Error',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
}

const getDefaultHandlers = () => {
	try {
		if (process.env['NODE_ENV'] === 'test') {
			return [logToMemory, logEvent];
		}
	} catch (e) {
		// Process.env is not available in the browser
	}
	return [logToMemory, logToConsole, logEvent];
};

/**
 * The logger instance.
 */
export const logger: Logger = new Logger(getDefaultHandlers());

export const prepareLogMessage = (message: string) => {
	return message.replace(/\t/g, '');
};

export const formatLogEntry = (
	message: string,
	severity: LogSeverity,
	prefix: string
): string => {
	const date = new Date();
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
	const now = formattedDate + ' ' + formattedTime;
	message = prepareLogMessage(message);
	return `[${now}] ${prefix} ${severity}: ${message}`;
};

/**
 * Add a listener for the Playground crashes.
 * These crashes include Playground errors like Asyncify errors.
 * The callback function will receive an Event object with logs in the detail property.
 *
 * @param loggerInstance The logger instance
 * @param callback The callback function
 */
export const addCrashListener = (
	loggerInstance: Logger,
	callback: EventListenerOrEventListenerObject
) => {
	loggerInstance.addEventListener(loggerInstance.fatalErrorEvent, callback);
};
