import type { LogHandler } from '../log-handlers';
import type { Log } from '../logger';
import { logger } from '../logger';

export const logEventType = 'playground-log';

export const logEvent: LogHandler = (log: Log, ...args: any[]): void => {
	logger.dispatchEvent(
		new CustomEvent(logEventType, {
			detail: {
				log,
				args,
			},
		})
	);
};
