import type { UniversalPHP, PHPRequestErrorEvent } from '../types';
import { type Logger, LogPrefix, LogSeverity } from '../logger';

export const errorLogPath = '/wordpress/wp-content/debug.log';

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
	let lastPHPLog = '';
	playground.addEventListener('request.end', async () => {
		const log = await getRequestPhpErrorLog(playground);
		// Imports can replace debug.log with a shorter or unrelated file. Track
		// each Playground separately and only skip a prefix we actually read.
		const currentLog = log.startsWith(lastPHPLog)
			? log.substring(lastPHPLog.length)
			: log;
		lastPHPLog = log;
		if (currentLog) {
			loggerInstance.logMessage({
				message: currentLog,
				severity: LogSeverity.Log,
				raw: true,
			});
		}
	});
	playground.addEventListener('request.error', (event) => {
		event = event as PHPRequestErrorEvent;
		if (event.error) {
			loggerInstance.logMessage({
				message: `${event.error.message} ${event.error.stack}`,
				severity: LogSeverity.Fatal,
				prefix:
					event.source === 'request' ? LogPrefix.PHP : LogPrefix.WASM,
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
