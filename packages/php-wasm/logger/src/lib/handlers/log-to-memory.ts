import { LogHandler } from '../log-handlers';
import { formatLogEntry, Log } from '../logger';

const prepareLogMessage = (logMessage: object): string => {
	if (logMessage instanceof Error) {
		return [logMessage.message, logMessage.stack].join('\n');
	}
	return JSON.stringify(logMessage, null, 2);
};

export const logs: string[] = [];

const addToLogArray = (message: string): void => {
	logs.push(message);
};

/**
 * Log to memory
 */
export const logToMemory: LogHandler = (log: Log): void => {
	if (log.raw === true) {
		addToLogArray(log.message);
	} else {
		const message = formatLogEntry(
			typeof log.message === 'object'
				? prepareLogMessage(log.message)
				: log.message,
			log.severity ?? 'Info',
			log.prefix ?? 'JavaScript'
		);
		addToLogArray(message);
	}
};

export const clearMemoryLogs = (): void => {
	logs.length = 0;
};
