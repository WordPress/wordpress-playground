import { NodePHP } from '@php-wasm/node';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { logger, addCrashListener, collectPhpLogs } from '../lib/logger';

describe('Logger', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(LatestSupportedPHPVersion);
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
});
