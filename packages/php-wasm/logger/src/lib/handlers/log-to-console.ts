import type { LogHandler } from '../log-handlers';
import { type Log, LogSeverity, prepareLogMessage } from '../logger';

/**
 * Log message to the console.
 */
export const logToConsole: LogHandler = (log: Log, ...args: any[]): void => {
	if (typeof log.message === 'string') {
		// Some errors have a read-only message property where direct
		// assignment will throw an error. The assignment is merely for
		// formatting, so let's assign with Reflect.set and avoid the error.
		Reflect.set(log, 'message', prepareLogMessage(log.message));
	} else if (log.message.message && typeof log.message.message === 'string') {
		// Some errors have a read-only message property where direct
		// assignment will throw an error. The assignment is merely for
		// formatting, so let's assign with Reflect.set and avoid the error.
		Reflect.set(
			log.message,
			'message',
			prepareLogMessage(log.message.message)
		);
	}
	/* eslint-disable no-console */
	switch (log.severity) {
		case LogSeverity.Debug:
			console.debug(log.message, ...args);
			break;
		case LogSeverity.Info:
			console.info(log.message, ...args);
			break;
		case LogSeverity.Warn:
			console.warn(log.message, ...args);
			break;
		case LogSeverity.Error:
			console.error(log.message, ...args);
			break;
		case LogSeverity.Fatal:
			console.error(log.message, ...args);
			break;
		default:
			console.log(log.message, ...args);
	}
	/* eslint-enable no-console */
};
