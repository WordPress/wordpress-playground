import './mocker';
import { vi } from 'vitest';
import { main } from '../lib/run-cli';
import { logger, LogSeverity } from '@php-wasm/logger';
import { startBridge } from '../lib/start-bridge';
import type { XdebugCDPBridge } from '../lib/xdebug-cdp-bridge';

describe('CLI', () => {
	const argv = process.argv;

	beforeEach(async () => {
		process.argv = [...argv.slice(0, 2)];

		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(logger, 'setSeverityFilterLevel');
		vi.spyOn(
			await import('../lib/start-bridge'),
			'startBridge'
		).mockResolvedValue({ start: vi.fn() } as unknown as XdebugCDPBridge);
	});

	afterEach(() => {
		process.argv = argv;

		vi.clearAllMocks();
	});

	it('calls startBridge with default arguments', async () => {
		await main();

		expect(startBridge).toHaveBeenCalledWith({
			cdpPort: 9229,
			cdpHost: 'localhost',
			dbgpPort: 9003,
		});

		const bridge = await (startBridge as any).mock.results[0].value;
		expect(bridge.start).toHaveBeenCalled();
	});

	it('passes custom arguments correctly', async () => {
		process.argv.push(
			'--port',
			'9000',
			'--host',
			'127.0.0.1',
			'--php-root',
			'/var/www'
		);

		await main();

		expect(startBridge).toHaveBeenCalledWith({
			cdpPort: 9229,
			cdpHost: '127.0.0.1',
			dbgpPort: 9000,
			phpRoot: '/var/www',
		});
	});

	it('does not start bridge when help argument is passed', async () => {
		process.argv.push('--help');

		try {
			await main();
		} catch (e: any) {
			expect(e.message).toBe('process.exit unexpectedly called with "0"');
		}

		expect(startBridge).not.toHaveBeenCalled();
	});

	it('runs cli with verbosity option set to quiet', async () => {
		process.argv.push('--verbosity', 'quiet');

		await main();

		expect(logger.setSeverityFilterLevel).toHaveBeenCalledWith(
			LogSeverity.Fatal
		);
	});

	it('runs cli with verbosity option set to normal', async () => {
		process.argv.push('--verbosity', 'normal');

		await main();

		expect(logger.setSeverityFilterLevel).toHaveBeenCalledWith(
			LogSeverity.Info
		);
	});

	it('runs cli with verbosity option set to debug', async () => {
		process.argv.push('--verbosity', 'debug');

		await main();

		expect(logger.setSeverityFilterLevel).toHaveBeenCalledWith(
			LogSeverity.Debug
		);
	});
});
