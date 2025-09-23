import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { PHP } from '@php-wasm/universal';
import { describe, expect, test, vi } from 'vitest';

import { PlaygroundCliBlueprintV1Worker } from '../src/blueprints-v1/worker-thread-v1';
import { PlaygroundCliBlueprintV2Worker } from '../src/blueprints-v2/worker-thread-v2';

type PhpEvent = { type: string; [key: string]: unknown };
type PhpEventListener = (event: PhpEvent) => void | Promise<void>;
type PhpMessageListener = (message: unknown) => unknown | Promise<unknown>;

const createMonitor = () =>
	({
		addEventListener: vi.fn(),
	} as unknown as EmscriptenDownloadMonitor);

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
			await Promise.all([...listeners].map((listener) => listener(event)));
		},
		emitMessage: async (message: unknown) => {
			await Promise.all([...messageListeners].map((listener) => listener(message)));
		},
	};
};

class TestableV2Worker extends PlaygroundCliBlueprintV2Worker {
	constructor() {
		super(createMonitor());
	}

	attachPhp(php: PHP) {
		this.registerWorkerListeners(php);
	}
}

class TestableV1Worker extends PlaygroundCliBlueprintV1Worker {
	constructor() {
		super(createMonitor());
	}

	attachPhp(php: PHP) {
		this.registerWorkerListeners(php);
	}
}

describe('Playground CLI blueprint workers', () => {
	test('V2 worker listeners receive events from every PHP instance', async () => {
		const worker = new TestableV2Worker();
		const phpA = createMockPHP();
		const phpB = createMockPHP();
		const received: any[] = [];

		worker.addEventListener('blueprint.progress', (event) => {
			received.push(event);
		});

		worker.attachPhp(phpA as unknown as PHP);
		worker.attachPhp(phpB as unknown as PHP);

		await phpA.emitEvent({
			type: 'blueprint.progress',
			source: 'A',
		});
		await phpB.emitEvent({
			type: 'blueprint.progress',
			source: 'B',
		});

		expect(received).toEqual([
			expect.objectContaining({ type: 'blueprint.progress', source: 'A' }),
			expect.objectContaining({ type: 'blueprint.progress', source: 'B' }),
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

	test('V1 worker listeners receive events from every PHP instance', async () => {
		const worker = new TestableV1Worker();
		const phpA = createMockPHP();
		const phpB = createMockPHP();
		const received: any[] = [];

		worker.addEventListener('runtime.exit', (event) => {
			received.push(event);
		});

		worker.attachPhp(phpA as unknown as PHP);
		worker.attachPhp(phpB as unknown as PHP);

		await phpA.emitEvent({ type: 'runtime.exit', source: 'A' });
		await phpB.emitEvent({ type: 'runtime.exit', source: 'B' });

		expect(received).toEqual([
			expect.objectContaining({ type: 'runtime.exit', source: 'A' }),
			expect.objectContaining({ type: 'runtime.exit', source: 'B' }),
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
