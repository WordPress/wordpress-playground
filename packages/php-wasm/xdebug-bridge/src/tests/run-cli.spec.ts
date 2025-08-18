import { vi } from 'vitest';
import { logger, LogSeverity } from '@php-wasm/logger';
import { main } from '../lib/run-cli';
import type { XdebugCDPBridge } from '../lib/xdebug-cdp-bridge';

describe('CLI', () => {
	const argv = process.argv;

	beforeEach(async () => {
		process.argv = [...argv.slice(0, 2)];

		vi.spyOn(
			await import('../lib/start-bridge'),
			'startBridge'
		).mockResolvedValue({ start: vi.fn() } as unknown as XdebugCDPBridge);
		vi.spyOn(logger, 'filterBySeverity');
	});

	afterEach(() => {
		process.argv = argv;

		vi.clearAllMocks();
	});

	it('runs cli with verbosity option set to quiet', async () => {
		process.argv.push('--verbosity', 'quiet');

		await main();

		expect(logger.filterBySeverity).toHaveBeenCalledWith(LogSeverity.Fatal);
	});

	it('runs cli with verbosity option set to normal', async () => {
		process.argv.push('--verbosity', 'normal');

		await main();

		expect(logger.filterBySeverity).toHaveBeenCalledWith(LogSeverity.Info);
	});

	it('runs cli with verbosity option set to debug', async () => {
		process.argv.push('--verbosity', 'debug');

		await main();

		expect(logger.filterBySeverity).toHaveBeenCalledWith(LogSeverity.Debug);
	});
});
