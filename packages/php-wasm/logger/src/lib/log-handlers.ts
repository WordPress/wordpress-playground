import { Logger, Log } from './logger';

export interface LogHandler {
	(logger: Logger, log: Log, ...args: any[]): void;
}

export * from './handlers/log-to-console';
export * from './handlers/log-to-file';
