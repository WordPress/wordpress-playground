import { LogHandler } from '../log-handlers';
import { formatLogEntry, Log } from '../logger';

const prepareLogMessage = (message: any, ...args: any[]): string => {
	return [
		typeof message === 'object' ? JSON.stringify(message) : message,
		...args.map((arg) => JSON.stringify(arg)),
	].join(' ');
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
