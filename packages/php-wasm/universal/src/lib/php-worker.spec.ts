import { PHPWorker } from './php-worker';
import { describe, expect, test, vi } from 'vitest';
import type { PHP } from './php';

type PhpEvent = { type: string; [key: string]: unknown };
type PhpEventListener = (event: PhpEvent) => void | Promise<void>;
type PhpMessageListener = (message: unknown) => unknown | Promise<unknown>;

const createMockPHP = () => {
	const eventListeners = new Map<string, Set<PhpEventListener>>();
	const messageListeners = new Set<PhpMessageListener>();

	return {
		addEventListener: vi.fn(
			(eventType: string, listener: PhpEventListener) => {
				if (!eventListeners.has(eventType)) {
					eventListeners.set(eventType, new Set());
				}
				eventListeners.get(eventType)!.add(listener);
			}
		),
		onMessage: vi.fn((listener: PhpMessageListener) => {
			messageListeners.add(listener);
			return Promise.resolve(() => {
				messageListeners.delete(listener);
			});
		}),
		emitEvent: async (event: PhpEvent) => {
			const listeners = eventListeners.get('*');
			if (!listeners) {
				return;
			}
			await Promise.all(
				[...listeners].map((listener) => listener(event))
			);
		},
		emitMessage: async (message: unknown) => {
			await Promise.all(
				[...messageListeners].map((listener) => listener(message))
			);
		},
	};
};

class TestEndpoint extends PHPWorker {
	attachPhp(php: PHP) {
		this.registerWorkerListeners(php);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async boot(_: unknown = undefined) {}
}

describe('PlaygroundWorkerEndpoint', () => {
	test('listeners receive events from each PHP instance', async () => {
		const endpoint = new TestEndpoint();
		const phpA = createMockPHP();
		const phpB = createMockPHP();
		const received: any[] = [];

		endpoint.addEventListener('worker.ready', (event) => {
			received.push(event);
		});

		endpoint.attachPhp(phpA as unknown as PHP);
		endpoint.attachPhp(phpB as unknown as PHP);

		await phpA.emitEvent({ type: 'worker.ready', source: 'A' });
		await phpB.emitEvent({ type: 'worker.ready', source: 'B' });

		expect(received).toEqual([
			expect.objectContaining({ type: 'worker.ready', source: 'A' }),
			expect.objectContaining({ type: 'worker.ready', source: 'B' }),
		]);
		expect(phpA.addEventListener).toHaveBeenCalledWith(
			'*',
			expect.any(Function)
		);
		expect(phpB.addEventListener).toHaveBeenCalledWith(
			'*',
			expect.any(Function)
		);
	});
});
