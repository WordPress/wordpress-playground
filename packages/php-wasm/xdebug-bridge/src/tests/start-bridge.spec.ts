import './mocker';
import { type MockInstance, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { PHP } from '@php-wasm/universal';
import { EventEmitter } from 'events';
import { CDPServer } from '../lib/cdp-server';
import { DbgpSession } from '../lib/dbgp-session';
import { XdebugCDPBridge } from '../lib/xdebug-cdp-bridge';
import { startBridge } from '../lib/start-bridge';
import { type Log, logger, LogSeverity } from '@php-wasm/logger';

describe('Bridge', () => {
	beforeAll(() => {
		vi.spyOn(global, 'setTimeout').mockImplementation(
			(cb) => global.setImmediate(() => cb()) as unknown as NodeJS.Timeout
		);
		vi.spyOn(EventEmitter.prototype, 'on').mockImplementation(function (
			this: EventEmitter,
			event,
			cb
		) {
			if (event === 'clientConnected') {
				setTimeout(cb, 0);
			}

			return this;
		});
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('Start', () => {
		let CDPServerSpy: MockInstance;
		let DbgpSessionSpy: MockInstance;
		let XdebugCDPBridgeSpy: MockInstance;

		beforeEach(async () => {
			CDPServerSpy = vi
				.spyOn(await import('../lib/cdp-server'), 'CDPServer')
				.mockReturnThis();
			DbgpSessionSpy = vi
				.spyOn(await import('../lib/dbgp-session'), 'DbgpSession')
				.mockReturnThis();
			XdebugCDPBridgeSpy = vi
				.spyOn(
					await import('../lib/xdebug-cdp-bridge'),
					'XdebugCDPBridge'
				)
				.mockReturnThis();
		});

		afterEach(() => {
			CDPServerSpy.mockRestore();
			DbgpSessionSpy.mockRestore();
			XdebugCDPBridgeSpy.mockRestore();
		});

		it('starts the bridge with default config', async () => {
			const bridge = await startBridge({});

			expect(CDPServer).toHaveBeenCalledWith(9229);
			expect(DbgpSession).toHaveBeenCalledWith(9003);
			expect(XdebugCDPBridge).toHaveBeenCalled();
			expect(bridge).toBeInstanceOf(XdebugCDPBridge);
		});

		it('respects custom ports and hosts', async () => {
			await startBridge({
				cdpPort: 9999,
				dbgpPort: 8888,
			});

			expect(CDPServer).toHaveBeenCalledWith(9999);
			expect(DbgpSession).toHaveBeenCalledWith(8888);
		});

		it('finds PHP files', async () => {
			await startBridge({ phpRoot: '/foo/bar' });

			const args = (XdebugCDPBridge as any).mock.calls[0][2];
			expect(args.knownScriptUrls).toContain('file:///foo/bar/baz.php');

			expect(typeof args.getPHPFile).toBe('function');
			const content = await args.getPHPFile('file:///foo/bar/baz.php');
			expect(content).toBe('<?php echo "Hello World";');
		});

		it('uses phpInstance readFileAsText when provided', async () => {
			const php = {
				readFileAsText: vi
					.fn()
					.mockResolvedValue('<?php echo "Hello World";'),
			};

			await startBridge({ phpInstance: php as any as PHP });

			const args = (XdebugCDPBridge as any).mock.calls[0][2];
			const result = await args.getPHPFile('file:///test.php');
			expect(php.readFileAsText).toHaveBeenCalledWith('file:///test.php');
			expect(result).toBe('<?php echo "Hello World";');
		});

		it('uses getPHPFile override if provided', async () => {
			const getPHPFile = vi
				.fn()
				.mockResolvedValue('<?php echo "Hello World";');

			await startBridge({ getPHPFile });

			const args = (XdebugCDPBridge as any).mock.calls[0][2];
			const result = await args.getPHPFile('file:///custom.php');
			expect(getPHPFile).toHaveBeenCalledWith('file:///custom.php');
			expect(result).toBe('<?php echo "Hello World";');
		});
	});

	describe('Log', () => {
		let output: string[];

		function logToVariable(log: Log, arg?: string) {
			output.push(`${log.message}${arg ? arg : ''}`);
		}

		beforeEach(async () => {
			output = [];
			// @ts-ignore
			logger.handlers = [logToVariable];
		});

		it('outputs logs by default', async () => {
			const bridge = await startBridge({});

			expect(output).toEqual([
				'Starting XDebug Bridge...',
				'Connect Chrome DevTools to CDP at:',
				`devtools://devtools/bundled/inspector.html?ws=localhost:9229\n`,
				'Chrome connected! Initializing Xdebug receiver...',
				'XDebug receiver running on port 9003',
				'Running a PHP script with Xdebug enabled...',
			]);

			bridge.cdp.sendMessage('Hello Xdebug world');

			bridge.stop();

			expect(output).not.toContain('[CDP][send]"Hello Xdebug world"');
		});

		it('outputs logs with logger severity set to normal', async () => {
			logger.setSeverityFilterLevel(LogSeverity.Info);

			const bridge = await startBridge({});

			expect(output).toEqual([
				'Starting XDebug Bridge...',
				'Connect Chrome DevTools to CDP at:',
				`devtools://devtools/bundled/inspector.html?ws=localhost:9229\n`,
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
			logger.setSeverityFilterLevel(LogSeverity.Debug);

			const bridge = await startBridge({});

			// @ts-ignore
			bridge.cdp.ws = new WebSocket();

			bridge.cdp.sendMessage('Hello Xdebug world');

			bridge.stop();

			expect(output).toContain(
				'\x1B[1;32m[CDP][send]\x1B[0m"Hello Xdebug world"'
			);
		});

		it('outputs only fatal logs with logger severity set to fatal', async () => {
			logger.setSeverityFilterLevel(LogSeverity.Fatal);

			const bridge = await startBridge({});

			bridge.stop();

			expect(output).toEqual([]);
		});
	});
});
