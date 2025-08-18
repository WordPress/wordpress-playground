import { startBridge } from '../lib/start-bridge';
import { type Log, logger, LogSeverity } from '@php-wasm/logger';
import { WebSocket } from 'ws';

describe('verbosity', () => {
	const port = 9229;
	let output: string[];

	function logToVariable(log: Log, arg?: string) {
		output.push(`${log.message}${arg ? arg : ''}`);
	}

	beforeEach(() => {
		output = [];
		// @ts-ignore
		logger.handlers = [logToVariable];
	});

	it('outputs logs by default', async () => {
		new WebSocket(`ws://localhost:${port}`);

		const bridge = await startBridge({ cdpPort: port });

		expect(output).toEqual([
			'Starting XDebug Bridge...',
			'Connect Chrome DevTools to CDP at:',
			`devtools://devtools/bundled/inspector.html?ws=localhost:${port}\n`,
			'Chrome connected! Initializing Xdebug receiver...',
			'XDebug receiver running on port 9003',
			'Running a PHP script with Xdebug enabled...',
		]);

		bridge.cdp.sendMessage('Hello Xdebug world');

		bridge.stop();

		expect(output).not.toContain('[CDP][send]"Hello Xdebug world"');
	});

	it('outputs logs with logger severity set to normal', async () => {
		new WebSocket(`ws://localhost:${port}`);

		logger.filterBySeverity(LogSeverity.Info);

		const bridge = await startBridge({ cdpPort: port });

		expect(output).toEqual([
			'Starting XDebug Bridge...',
			'Connect Chrome DevTools to CDP at:',
			`devtools://devtools/bundled/inspector.html?ws=localhost:${port}\n`,
			'Chrome connected! Initializing Xdebug receiver...',
			'XDebug receiver running on port 9003',
			'Running a PHP script with Xdebug enabled...',
		]);

		bridge.cdp.sendMessage('Hello Xdebug world');

		bridge.stop();

		expect(output).not.toContain(
			'\x1B[1;32m[CDP][send]\x1B[0m"Hello Xdebug world"'
		);
	});

	it('outputs logs and communication inside the bridge with logger severity set to debug', async () => {
		new WebSocket(`ws://localhost:${port}`);

		logger.filterBySeverity(LogSeverity.Debug);

		const bridge = await startBridge({ cdpPort: port });

		bridge.cdp.sendMessage('Hello Xdebug world');

		bridge.stop();

		expect(output).toContain(
			'\x1B[1;32m[CDP][send]\x1B[0m"Hello Xdebug world"'
		);
	});

	it('outputs only fatal logs with logger severity set to fatal', async () => {
		new WebSocket(`ws://localhost:${port}`);

		logger.filterBySeverity(LogSeverity.Fatal);

		const bridge = await startBridge({ cdpPort: port });

		bridge.stop();

		expect(output).toEqual([]);
	});
});
