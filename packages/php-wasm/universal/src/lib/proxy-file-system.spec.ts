import { describe, expect, it, vi } from 'vitest';
import type { PHP } from './php';
import type { PHPEvent } from './universal-php';
import { proxyFileSystem } from './proxy-file-system';

describe('proxyFileSystem', () => {
	it('notifies the filesystem owner when a replica request ends', async () => {
		const sourceOfTruth = createFakePhp();
		const replica = createFakePhp();
		const onProxiedRequestEnd = vi.fn();

		sourceOfTruth.php.addEventListener(
			'proxyfs.request.end' as PHPEvent['type'],
			onProxiedRequestEnd
		);
		await proxyFileSystem(sourceOfTruth.php, replica.php, ['/wordpress']);

		replica.dispatchEvent({ type: 'request.end' });

		expect(onProxiedRequestEnd).toHaveBeenCalledOnce();
	});
});

function createFakePhp() {
	const listeners = new Map<
		string,
		Set<(event: { type: string }) => void>
	>();
	const privateSymbol = Symbol('private');
	const runtime = {
		phpVersion: { major: 8 },
		PROXYFS: { stream_ops: { mmap: vi.fn() } },
		FS: {
			mount: vi.fn(),
			unmount: vi.fn(),
		},
	};
	const php = {
		[privateSymbol]: runtime,
		fileExists: vi.fn(() => true),
		mkdir: vi.fn(),
		mount: vi.fn(
			async (
				_path: string,
				mountHandler: (php: PHP) => Promise<() => void>
			) => await mountHandler(php as unknown as PHP)
		),
		addEventListener: vi.fn(
			(
				eventType: string,
				listener: (event: { type: string }) => void
			) => {
				if (!listeners.has(eventType)) {
					listeners.set(eventType, new Set());
				}
				listeners.get(eventType)!.add(listener);
			}
		),
		dispatchEvent: vi.fn((event: { type: string }) => {
			for (const listener of listeners.get(event.type) ?? []) {
				listener(event);
			}
		}),
	} as unknown as PHP;

	return {
		php,
		dispatchEvent: (event: { type: 'request.end' }) =>
			php.dispatchEvent(event),
	};
}
