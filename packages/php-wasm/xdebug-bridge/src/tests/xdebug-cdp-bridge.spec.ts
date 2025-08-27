import fs from 'fs';
import { vi } from 'vitest';
import { DbgpSession } from '../lib/dbgp-session';
import { CDPServer } from '../lib/cdp-server';
import { XdebugCDPBridge } from '../lib/xdebug-cdp-bridge';
import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '@php-wasm/node';

describe('XdebugCDPBridge', () => {
	let php: PHP;
	let dbgpSession: DbgpSession;
	let cdpServer: CDPServer;
	let bridge: XdebugCDPBridge;
	let fixtures: string;

	beforeEach(async () => {
		php = new PHP(
			await loadNodeRuntime(RecommendedPHPVersion, { withXdebug: true })
		);

		fixtures = `${import.meta.dirname}/fixtures`;

		dbgpSession = new DbgpSession();
		cdpServer = new CDPServer();
		bridge = new XdebugCDPBridge(dbgpSession, cdpServer, {
			knownScriptUrls: fs
				.readdirSync(`${import.meta.dirname}/fixtures`)
				.map((file) => `${fixtures}/${file}`),
			getPHPFile: (file) => php.readFileAsText(file),
		});

		vi.spyOn(dbgpSession, 'sendCommand');
		vi.spyOn(dbgpSession, 'on');
		vi.spyOn(cdpServer, 'sendMessage');
		vi.spyOn(cdpServer, 'on');
	});

	afterEach(() => {
		vi.clearAllMocks();

		bridge.stop();

		php.exit();
	});

	it('initializes with correct script IDs', () => {
		expect(bridge['scriptIdByUrl'].get(`${fixtures}/array.php`)).toBe('1');
		expect(bridge['scriptIdByUrl'].get(`${fixtures}/test.php`)).toBe('2');
	});

	it('registers event handlers in start function', () => {
		bridge.start();

		expect(dbgpSession.on).toHaveBeenCalledWith(
			'connected',
			expect.any(Function)
		);
		expect(dbgpSession.on).toHaveBeenCalledWith(
			'message',
			expect.any(Function)
		);
		expect(dbgpSession.on).toHaveBeenCalledWith(
			'disconnected',
			expect.any(Function)
		);

		expect(cdpServer.on).toHaveBeenCalledWith(
			'message',
			expect.any(Function)
		);
		expect(cdpServer.on).toHaveBeenCalledWith(
			'clientDisconnected',
			expect.any(Function)
		);
	});

	it('sends command with correct transaction ID', () => {
		const txn = bridge['sendDbgpCommand']('run');
		expect(txn).toBe('1');
		expect(dbgpSession.sendCommand).toHaveBeenCalledWith('run -i 1');
	});

	it('formats property fullname with escaping', () => {
		const formatted = bridge['formatPropertyFullName'](
			`$_SERVER["HTTP_HOST"]`
		);
		expect(formatted).toBe('"$_SERVER[\\"HTTP_HOST\\"]"');
	});

	it('handles Debugger.resume and send run command', () => {
		bridge['xdebugConnected'] = true;

		bridge['handleCdpMessage']({
			id: 101,
			method: 'Debugger.resume',
			params: {},
		});

		expect(dbgpSession.sendCommand).toHaveBeenCalledWith(
			expect.stringContaining('run')
		);
		expect(cdpServer.sendMessage).toHaveBeenCalledWith({
			id: 101,
			result: {},
		});
	});

	it('handles Debugger.setBreakpointByUrl when xdebug is not connected', () => {
		bridge['xdebugConnected'] = false;

		bridge['handleCdpMessage']({
			id: 202,
			method: 'Debugger.setBreakpointByUrl',
			params: {
				url: 'file:///test.php',
				lineNumber: 4,
			},
		});

		expect(cdpServer.sendMessage).toHaveBeenCalledWith({
			id: 202,
			result: {
				breakpointId: '1',
				locations: [
					{
						scriptId: '3',
						lineNumber: 4,
						columnNumber: 0,
					},
				],
			},
		});
	});

	it('handles Debugger.removeBreakpoint and update internal state', () => {
		bridge['breakpoints'].set('1', {
			cdpId: '1',
			xdebugId: null,
			fileUri: 'file:///test.php',
			lineNumber: 5,
		});

		bridge['handleCdpMessage']({
			id: 303,
			method: 'Debugger.removeBreakpoint',
			params: { breakpointId: '1' },
		});

		expect(bridge['breakpoints'].has('1')).toBe(false);
		expect(cdpServer.sendMessage).toHaveBeenCalledWith({
			id: 303,
			result: {},
		});
	});

	it('connects to Xdebug and pauses at a given breakpoint', async () => {
		bridge.start();

		bridge['handleCdpMessage']({
			id: 3,
			method: 'Debugger.setBreakpointByUrl',
			params: {
				url: `${fixtures}/test.php`,
				lineNumber: 7,
			},
		});

		await php.runStream({
			scriptPath: `${fixtures}/test.php`,
		});

		await new Promise((resolve) => {
			const original = cdpServer.sendMessage.bind(cdpServer);
			vi.spyOn(cdpServer, 'sendMessage').mockImplementation((msg) => {
				if (msg.method === 'Debugger.paused') resolve(msg);
				return original(msg);
			});
		});

		expect(
			[...bridge['scriptIdByUrl'].entries()].find(
				([, v]) => v === '2'
			)?.[0]
		).toBe(`${fixtures}/test.php`);

		expect(cdpServer.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'Debugger.paused',
				params: expect.objectContaining({
					callFrames: expect.arrayContaining([
						expect.objectContaining({
							location: expect.objectContaining({
								scriptId: '2',
								lineNumber: 7,
							}),
						}),
					]),
				}),
			})
		);
	});

	it('connects to Xdebug, pause at a given breakpoint, steps over and returns correct stack', async () => {
		bridge.start();

		bridge['handleCdpMessage']({
			id: 3,
			method: 'Debugger.setBreakpointByUrl',
			params: {
				url: `${fixtures}/array.php`,
				lineNumber: 15,
			},
		});

		await php.runStream({
			scriptPath: `${fixtures}/array.php`,
		});

		// 5 transactions were already sent before the first pause.
		let steps = 5;
		const transactions: Record<string, { name: string; type: string }[]> =
			{};

		await new Promise<void>((resolve) => {
			const originalSendMessage = cdpServer.sendMessage.bind(cdpServer);
			vi.spyOn(cdpServer, 'sendMessage').mockImplementation((message) => {
				if (message.method === 'Debugger.paused') {
					if (steps == 5) {
						dbgpSession.sendCommand(
							`property_get -d 0 -n $nested_array -p 0 -m 32 -i ${steps}`
						);
					}
					steps++;
				}
				return originalSendMessage(message);
			});

			const originalOnData = (dbgpSession as any).onData.bind(
				dbgpSession
			);
			vi.spyOn(dbgpSession as any, 'onData').mockImplementation(
				(data) => {
					if ((data as string).includes('command="property_get')) {
						if (steps == 6) {
							dbgpSession.sendCommand(
								`property_get -d 0 -n $nested_array["baz"] -p 0 -m 32 -i ${steps}`
							);
						} else if (steps == 7) {
							dbgpSession.sendCommand(
								`property_get -d 0 -n $nested_array["baz"]["corge"] -p 0 -m 32 -i ${steps}`
							);
						} else {
							resolve();
						}
						steps++;

						const id = (data as string).match(
							/transaction_id="([^"]+)"/
						)![1];
						const matches = [
							...(data as string).matchAll(
								/<property\s+([^>]+)>/g
							),
						];

						const children = matches.slice(1).map((m) => {
							const attrs = m[1];
							const nameMatch = attrs.match(/name="([^"]+)"/);
							const typeMatch = attrs.match(/type="([^"]+)"/);
							return {
								name: nameMatch ? nameMatch[1] : '',
								type: typeMatch ? typeMatch[1] : '',
							};
						});

						transactions[id] = children;
					}

					return originalOnData(data);
				}
			);
		});

		expect(transactions[5]).toEqual([
			{ name: 'foo', type: 'string' },
			{ name: 'baz', type: 'array' },
		]);
		expect(transactions[6]).toEqual([
			{ name: 'qux', type: 'string' },
			{ name: 'corge', type: 'array' },
		]);
		expect(transactions[7]).toEqual([
			{ name: 'grault', type: 'string' },
			{ name: 'waldo', type: 'string' },
		]);
	});

	it('connects to Xdebug and pauses on the first line read when breakOnFirstLine enabled', async () => {
		bridge = new XdebugCDPBridge(dbgpSession, cdpServer, {
			knownScriptUrls: fs
				.readdirSync(fixtures)
				.map((file) => `${fixtures}/${file}`),
			getPHPFile: (file) => php.readFileAsText(file),
			breakOnFirstLine: true,
		});

		bridge.start();

		await php.runStream({
			scriptPath: `${fixtures}/test.php`,
		});

		await new Promise((resolve) => {
			const original = cdpServer.sendMessage.bind(cdpServer);
			vi.spyOn(cdpServer, 'sendMessage').mockImplementation((msg) => {
				if (msg.method === 'Debugger.paused') resolve(msg);
				return original(msg);
			});
		});

		expect(
			[...bridge['scriptIdByUrl'].entries()].find(
				([, v]) => v === '3'
			)?.[0]
		).toBe('/internal/shared/auto_prepend_file.php');

		expect(cdpServer.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'Debugger.paused',
				params: expect.objectContaining({
					callFrames: expect.arrayContaining([
						expect.objectContaining({
							location: expect.objectContaining({
								scriptId: '3',
								lineNumber: 2,
							}),
						}),
					]),
				}),
			})
		);
	});
});
