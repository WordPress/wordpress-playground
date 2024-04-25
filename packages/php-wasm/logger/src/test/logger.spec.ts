import { NodePHP } from '@php-wasm/node';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { Logger, addCrashListener } from '../lib/logger';
import { collectPhpLogs } from '../lib/log-collector';
import { clearMemoryLogs, logToMemory } from '../lib/log-handlers';

describe('Logger', () => {
	let php: NodePHP;
	const logger = new Logger([logToMemory]);
	beforeEach(async () => {
		php = await NodePHP.load(LatestSupportedPHPVersion);
		clearMemoryLogs();
	});
	it('Event listener should work', () => {
		const listener = vi.fn();
		collectPhpLogs(logger, php);
		addCrashListener(logger, listener);
		php.dispatchEvent({
			type: 'request.error',
			error: new Error('test'),
		});
		expect(listener).toBeCalledTimes(1);

		const logs = logger.getLogs();
		expect(logs.length).toBe(1);
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
