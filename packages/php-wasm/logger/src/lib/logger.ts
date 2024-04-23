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
export type LogPrefix = 'PHP-WASM' | 'PHP' | 'JavaScript';

/**
 * A logger for Playground.
 */
export class Logger extends EventTarget {
	public readonly fatalErrorEvent = 'playground-fatal-error';

	/**
	 * Context data
	 */
	private context: Record<string, any> = {};

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
		// TODO use handlers to get logs
		return [...logs];
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

/**
 * The logger instance.
 */
export const logger: Logger = new Logger([logToConsole, logToMemory]);

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
