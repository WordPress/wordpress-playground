import { Logger } from '../lib/logger';
import { clearMemoryLogs, logToMemory } from '../lib/log-handlers';

describe('Logger', () => {
	const logger = new Logger([logToMemory]);
	beforeEach(async () => {
		clearMemoryLogs();
	});

	it('Log message should be added', () => {
		logger.warn('test');
		const logs = logger.getLogs();
		expect(logs.length).toBe(1);
		expect(logs[0]).toMatch(
			/\[\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2} UTC\] JavaScript Warn: test/
		);
	});
});
