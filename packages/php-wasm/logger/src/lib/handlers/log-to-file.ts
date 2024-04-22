import { LogHandler } from '../log-handlers';
import { LogSeverity, Logger, Log } from '../logger';

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

const addToLogFile = (message: string): void => {
	// TODO replace with actual file logging
	logs.push(message);
};

/**
 * Log to a file
 */
export const logToFile: LogHandler = (logger: Logger, log: Log): void => {
	if (log.raw === true) {
		addToLogFile(log.message);
	} else {
		const message = formatLogEntry(
			typeof log.message === 'object'
				? prepareLogMessage(log.message)
				: log.message,
			log.severity ?? 'Info',
			log.prefix ?? 'JavaScript'
		);
		addToLogFile(message);
	}
};

export const clearFileLogs = (): void => {
	logs.length = 0;
};
