import { LogHandler } from '../log-handlers';
import { Log, prepareLogMessage } from '../logger';

/**
 * Log message to the console.
 */
export const logToConsole: LogHandler = (log: Log, ...args: any[]): void => {
	if (typeof log.message === 'string') {
		log.message = prepareLogMessage(log.message);
	} else if (log.message.message && typeof log.message.message === 'string') {
		log.message.message = prepareLogMessage(log.message.message);
	}
	/* eslint-disable no-console */
	switch (log.severity) {
		case 'Debug':
			console.debug(log.message, ...args);
			break;
		case 'Info':
			console.info(log.message, ...args);
			break;
		case 'Warn':
			console.warn(log.message, ...args);
			break;
		case 'Error':
			console.error(log.message, ...args);
			break;
		case 'Fatal':
			console.error(log.message, ...args);
			break;
		default:
			console.log(log.message, ...args);
	}
	/* eslint-enable no-console */
};
