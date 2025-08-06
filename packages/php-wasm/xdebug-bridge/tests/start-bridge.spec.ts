import { startBridge } from '../src/lib/start-bridge';
import { type Log, logger } from '@php-wasm/logger/src';
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

	it('outputs main logs by default', async () => {
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

	it('outputs main logs with verbosity option set to normal', async () => {
		new WebSocket(`ws://localhost:${port}`);

		const bridge = await startBridge({
			cdpPort: port,
			verbosity: 'normal',
		});

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

	it('outputs main logs and the communication inside the bridge with verbosity option set to debug', async () => {
		new WebSocket(`ws://localhost:${port}`);

		const bridge = await startBridge({ cdpPort: port, verbosity: 'debug' });

		bridge.cdp.sendMessage('Hello Xdebug world');

		bridge.stop();

		expect(output).toContain(
			'\x1B[1;32m[CDP][send]\x1B[0m"Hello Xdebug world"'
		);
	});

	it('does not output logs when verbosity option set to quiet', async () => {
		new WebSocket(`ws://localhost:${port}`);

		const bridge = await startBridge({ cdpPort: port, verbosity: 'quiet' });

		bridge.stop();

		expect(output).toEqual([]);
	});
});
