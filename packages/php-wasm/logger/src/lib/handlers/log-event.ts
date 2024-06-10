import { LogHandler } from '../log-handlers';
import { Log, logger } from '../logger';

export const logEvent: LogHandler = (log: Log, ...args: any[]): void => {
	logger.dispatchEvent(
		new CustomEvent('playground-log', {
			detail: {
				log,
				args,
			},
		})
	);
};
