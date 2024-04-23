import { Log } from './logger';

export interface LogHandler {
	(log: Log, ...args: any[]): void;
}

export * from './handlers/log-to-console';
export * from './handlers/log-to-memory';
