import { startBridge } from '../src/lib/start-bridge';
import { logger, Log } from '../../logger/src';
import type { LogHandler } from '../../logger/src/lib/log-handlers';
import { WebSocket } from 'ws';

describe('startBridge logging', () => {
	let port = 9229;
	let output: string[];
	let handlers: LogHandler[];

	beforeEach(() => {
		output = [];
		// @ts-ignore
		handlers = logger.handlers;
		// @ts-ignore
		logger.handlers = [
			(log: Log, arg?: string) =>
				output.push(`${log.message}${arg ? arg : ''}`),
		];
	});

	afterEach(() => {
		// @ts-ignore
		logger.handlers = handlers;
	});

	it('logs by default', async () => {
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

		expect(output).not.toContain('[CDP][send]"Hello Xdebug world"');

		bridge.stop();
	});

	it('does not log when quiet option is enabled', async () => {
		new WebSocket(`ws://localhost:${port}`);

		const bridge = await startBridge({ cdpPort: port, quiet: true });

		expect(output).toEqual([]);

		bridge.stop();
	});

	it('logs the communication inside the bridge when verbose option is enabled', async () => {
		new WebSocket(`ws://localhost:${port}`);

		const bridge = await startBridge({ cdpPort: port, verbose: true });

		bridge.cdp.sendMessage('Hello Xdebug world');

		expect(output).toContain(
			'\x1B[1;32m[CDP][send]\x1B[0m"Hello Xdebug world"'
		);

		bridge.stop();
	});
});
