import { logger } from '../lib/logger';
import { clearMemoryLogs } from '../lib/log-handlers';

describe('Logger', () => {
	beforeEach(async () => {
		clearMemoryLogs();
	});

	it('Log message should be added', () => {
		logger.warn('test');
		const logs = logger.getLogs();
		expect(logs.length).toBe(1);
		expect(logs[0]).toMatch(
			/\[\d{2}-[A-Za-z]{3,4}-\d{4} \d{2}:\d{2}:\d{2} UTC\] JavaScript Warn: test/
		);
	});

	it('Log event should be dispatched', () => {
		const eventListener = vitest.fn();
		logger.addEventListener('playground-log', eventListener);
		logger.warn('test');
		expect(eventListener).toHaveBeenCalled();
	});
});
