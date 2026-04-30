import { PHPWorker } from './php-worker';
import { describe, expect, test, vi } from 'vitest';
import type { PHP } from './php';
import type { PHPRequestHandler } from './php-request-handler';

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

class EndpointWithoutRequestHandler extends TestEndpoint {
	protected override getRequestHandler(required?: true): PHPRequestHandler;
	protected override getRequestHandler(
		required: false
	): PHPRequestHandler | undefined;
	protected override getRequestHandler(
		required?: boolean
	): PHPRequestHandler | undefined {
		void required;
		throw new Error(
			'request handler lookup should not run before primary PHP fallback'
		);
	}
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

	test('recovers request handler from the primary PHP instance', async () => {
		const endpoint = new TestEndpoint();
		const response = {
			finished: Promise.resolve(),
		};
		const cliPhp = {
			chdir: vi.fn(),
			cli: vi.fn().mockResolvedValue(response),
			addEventListener: vi.fn(),
			onMessage: vi.fn(),
		};
		const requestHandler = {
			absoluteUrl: 'http://127.0.0.1/',
			documentRoot: '/wordpress',
			instanceManager: {
				acquirePHPInstance: vi.fn().mockResolvedValue({
					php: cliPhp,
					reap: vi.fn(),
				}),
			},
		};
		const primaryPhp = {
			...createMockPHP(),
			requestHandler,
		};

		await endpoint.setPrimaryPHP(primaryPhp as unknown as PHP);
		await endpoint.cli(['php', '/tmp/script.php']);

		expect(
			requestHandler.instanceManager.acquirePHPInstance
		).toHaveBeenCalled();
		expect(cliPhp.cli).toHaveBeenCalledWith(
			['php', '/tmp/script.php'],
			undefined
		);
	});

	test('runs CLI on the primary PHP instance without a request handler', async () => {
		const endpoint = new TestEndpoint();
		const response = {
			finished: Promise.resolve(),
		};
		const primaryPhp = {
			...createMockPHP(),
			cli: vi.fn().mockResolvedValue(response),
		};

		await endpoint.setPrimaryPHP(primaryPhp as unknown as PHP);
		const actualResponse = await endpoint.cli(['php', '/tmp/script.php']);

		expect(actualResponse).toBe(response);
		expect(primaryPhp.cli).toHaveBeenCalledWith(
			['php', '/tmp/script.php'],
			undefined
		);
	});

	test('uses the primary PHP instance before resolving a missing request handler', async () => {
		const endpoint = new EndpointWithoutRequestHandler();
		const cliResponse = {
			finished: Promise.resolve(),
		};
		const runResponse = {};
		const primaryPhp = {
			...createMockPHP(),
			cli: vi.fn().mockResolvedValue(cliResponse),
			run: vi.fn().mockResolvedValue(runResponse),
		};

		await endpoint.setPrimaryPHP(primaryPhp as unknown as PHP);

		await expect(endpoint.cli(['php', '/tmp/script.php'])).resolves.toBe(
			cliResponse
		);
		await expect(endpoint.run({ code: "<?php echo 'hi!';" })).resolves.toBe(
			runResponse
		);
		expect(primaryPhp.cli).toHaveBeenCalledWith(
			['php', '/tmp/script.php'],
			undefined
		);
		expect(primaryPhp.run).toHaveBeenCalledWith({
			code: "<?php echo 'hi!';",
		});
	});
});
