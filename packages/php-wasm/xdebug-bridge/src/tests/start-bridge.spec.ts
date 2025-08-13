import './mocker';
import { vi } from 'vitest';
import type { PHP } from '@php-wasm/universal';
import { EventEmitter } from 'events';
import { startBridge } from '../lib/start-bridge';
import { CDPServer } from '../lib/cdp-server';
import { DbgpSession } from '../lib/dbgp-session';
import { XdebugCDPBridge } from '../lib/xdebug-cdp-bridge';

describe('Bridge', () => {
	beforeEach(async () => {
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

		vi.spyOn(
			await import('../lib/cdp-server'),
			'CDPServer'
		).mockReturnThis();
		vi.spyOn(
			await import('../lib/dbgp-session'),
			'DbgpSession'
		).mockReturnThis();
		vi.spyOn(
			await import('../lib/xdebug-cdp-bridge'),
			'XdebugCDPBridge'
		).mockReturnThis();
	});

	afterEach(() => {
		vi.clearAllMocks();
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
