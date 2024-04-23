import { LogHandler } from '../log-handlers';
import { LogSeverity, Log } from '../logger';

const formatLogDate = (date: Date): string => {
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
};

const prepareLogMessage = (message: any, ...args: any[]): string => {
	return [
		typeof message === 'object' ? JSON.stringify(message) : message,
		...args.map((arg) => JSON.stringify(arg)),
	].join(' ');
};

const formatLogEntry = (
	message: string,
	severity: LogSeverity,
	prefix: string
): string => {
	const now = formatLogDate(new Date());
	return `[${now}] ${prefix} ${severity}: ${message}`;
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
