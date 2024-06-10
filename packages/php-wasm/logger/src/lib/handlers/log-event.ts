import { LogHandler } from '../log-handlers';
import { Log, logger } from '../logger';

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
