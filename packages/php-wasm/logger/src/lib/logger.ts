import { logEvent } from './handlers/log-event';
import {
	logToMemory,
	logToConsole,
	logs,
	type LogHandler,
} from './log-handlers';

export { logEventType } from './handlers/log-event';

export { errorLogPath } from './collectors/collect-php-logs';

export type Log = {
	message: any;
	severity: LogSeverity;
	prefix?: LogPrefix;
	raw?: boolean;
};

/**
 * Log verbosity levels
 */
export const LogVerbosity = {
	Normal: 'normal',
	Quiet: 'quiet',
	Debug: 'debug',
} as const;

export type LogVerbosity = (typeof LogVerbosity)[keyof typeof LogVerbosity];

/**
 * Log severity levels.
 */
export const LogSeverity = {
	Log: { name: 'log', level: 1 },
	Info: { name: 'info', level: 1 },
	Warn: { name: 'warn', level: 1 },
	Error: { name: 'error', level: 1 },
	Fatal: { name: 'fatal', level: 1 },
	Debug: { name: 'debug', level: 2 },
} as const;

export type LogSeverity = (typeof LogSeverity)[keyof typeof LogSeverity];

/**
 * Log prefix.
 */
export const LogPrefix = {
	WASM: 'Wasm Crash',
	PHP: 'PHP',
	JS: 'JavaScript',
} as const;

export type LogPrefix = (typeof LogPrefix)[keyof typeof LogPrefix];

/**
 * A logger for Playground.
 */
export class Logger extends EventTarget {
	public readonly fatalErrorEvent = 'playground-fatal-error';
	private handlers: LogHandler[];
	private verbosity = 1;

	// constructor
	constructor(
		// Log handlers
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		handlers: LogHandler[] = []
	) {
		super();
		this.handlers = handlers;
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
	 * @param log Log
	 * @param args any
	 */
	public logMessage(
		log: Omit<Log, 'severity'> & { severity?: LogSeverity },
		...args: any[]
	): void {
		const logWithSeverity: Log = {
			...log,
			severity: log.severity ?? LogSeverity.Log,
		};
		for (const handler of this.handlers) {
			if (logWithSeverity.severity.level <= this.verbosity) {
				handler(logWithSeverity, ...args);
			}
		}
	}

	/**
	 * Filter message based on verbosiy
	 * @param verbosity LogVerbosity
	 */
	public filterByVerbosity(verbosity: LogVerbosity): void {
		switch (verbosity) {
			case LogVerbosity.Quiet:
				this.verbosity = 0;
				break;
			case LogVerbosity.Normal:
				this.verbosity = 1;
				break;
			case LogVerbosity.Debug:
				this.verbosity = 2;
				break;
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
				severity: LogSeverity.Log,
				prefix: LogPrefix.JS,
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
				severity: LogSeverity.Debug,
				prefix: LogPrefix.JS,
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
				severity: LogSeverity.Info,
				prefix: LogPrefix.JS,
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
				severity: LogSeverity.Warn,
				prefix: LogPrefix.JS,
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
				severity: LogSeverity.Error,
				prefix: LogPrefix.JS,
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
	} catch {
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
	return `[${now}] ${prefix} ${severity.name}: ${message}`;
};

/**
 * Add a listener for the Playground crashes.
 * These crashes include Playground errors like Asyncify errors.
 * The callback function will receive an Event object with logs in the detail
 * property.
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
