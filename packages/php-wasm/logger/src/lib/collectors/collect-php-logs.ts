import {
	UniversalPHP,
	PHPRequestErrorEvent,
} from '@php-wasm/universal/src/lib/universal-php';
import { Logger } from '../logger';

let lastPHPLogLength = 0;
const errorLogPath = '/wordpress/wp-content/debug.log';

/**
 * Read the WordPress debug.log file and return its content.
 *
 * @param UniversalPHP playground instance
 * @returns string The content of the debug.log file
 */
const getRequestPhpErrorLog = async (playground: UniversalPHP) => {
	if (!(await playground.fileExists(errorLogPath))) {
		return '';
	}
	return await playground.readFileAsText(errorLogPath);
};

/**
 * Collect PHP logs from the error_log file and log them.
 * @param UniversalPHP playground instance
 * @param loggerInstance The logger instance
 */
export const collectPhpLogs = (
	loggerInstance: Logger,
	playground: UniversalPHP
) => {
	playground.addEventListener('request.end', async () => {
		const log = await getRequestPhpErrorLog(playground);
		if (log.length > lastPHPLogLength) {
			const currentLog = log.substring(lastPHPLogLength);
			loggerInstance.logMessage({
				message: currentLog,
				raw: true,
			});
			lastPHPLogLength = log.length;
		}
	});
	playground.addEventListener('request.error', (event) => {
		event = event as PHPRequestErrorEvent;
		if (event.error) {
			loggerInstance.logMessage({
				message: `${event.error.message} ${event.error.stack}`,
				severity: 'Fatal',
				prefix: event.source === 'request' ? 'PHP' : 'WASM Crash',
			});
			loggerInstance.dispatchEvent(
				new CustomEvent(loggerInstance.fatalErrorEvent, {
					detail: {
						logs: loggerInstance.getLogs(),
						source: event.source,
					},
				})
			);
		}
	});
};
