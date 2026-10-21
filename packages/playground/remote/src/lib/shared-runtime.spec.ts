import { MessageChannel } from 'node:worker_threads';
import { exposeAPI, consumeAPI } from '@php-wasm/universal';
import { SharedRuntime, RELOAD_REQUIRED } from './shared-runtime';
import type {
	PlaygroundWorkerEndpoint,
	WorkerBootOptions,
} from './playground-worker-endpoint';

// Protect shared initialization and persistence across independently arriving tab connections.
describe('SharedRuntime', () => {
	let endpoint: PlaygroundWorkerEndpoint;
	let close: ReturnType<typeof vi.fn>;
	let runtime: SharedRuntime;

	beforeEach(() => {
		close = vi.fn();
		endpoint = {
			boot: vi.fn(async () => {}),
			run: vi.fn(async () => 'done'),
			unmounts: { '/wordpress': () => {} },
			unmountOpfs: vi.fn(async () => {}),
			[Symbol.asyncDispose]: vi.fn(async () => {}),
		} as unknown as PlaygroundWorkerEndpoint;
		runtime = new SharedRuntime(endpoint, 'build-a', close);
	});

	it('boots once and makes other connections wait for the initial Blueprint', async () => {
		const api = runtime.api() as PlaygroundWorkerEndpoint & {
			beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
			finishSharedRuntimeInitialization(): void;
		};
		const options = { scope: 'default', withNetworking: true };
		expect(await api.beginSharedBoot(options)).toBe(true);
		let attached = false;
		const second = api.beginSharedBoot(options).then((owner) => {
			attached = true;
			return owner;
		});
		await Promise.resolve();
		expect(attached).toBe(false);
		api.finishSharedRuntimeInitialization();
		expect(await second).toBe(false);
		expect(endpoint.boot).toHaveBeenCalledTimes(1);
	});

	it('exposes shared initialization through the real MessagePort API transport', async () => {
		const channel = new MessageChannel();
		try {
			const [ready] = exposeAPI(
				runtime.api(),
				undefined,
				channel.port1 as unknown as globalThis.MessagePort
			);
			ready();
			const client = consumeAPI<{
				beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
				finishSharedRuntimeInitialization(): Promise<void>;
			}>(channel.port2 as unknown as globalThis.MessagePort);
			await client.isConnected();
			expect(
				await client.beginSharedBoot({
					scope: 'default',
					withNetworking: true,
				})
			).toBe(true);
			await client.finishSharedRuntimeInitialization();
			expect(
				await client.beginSharedBoot({
					scope: 'default',
					withNetworking: true,
				})
			).toBe(false);
		} finally {
			channel.port1.close();
			channel.port2.close();
		}
	});

	it('rejects waiting connections and saves partial startup when the initializer disconnects', async () => {
		const owner = new MessageChannel();
		const waiting = new MessageChannel();
		try {
			const ownerPort = owner.port1 as unknown as globalThis.MessagePort;
			runtime.connect(ownerPort, vi.fn(), vi.fn());
			const api = runtime.api(ownerPort) as PlaygroundWorkerEndpoint & {
				beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
			};
			await api.beginSharedBoot({
				scope: 'default',
				withNetworking: true,
			});
			const second = runtime.api(
				waiting.port1 as unknown as globalThis.MessagePort
			) as typeof api;
			const attachment = second.beginSharedBoot({
				scope: 'default',
				withNetworking: true,
			});
			const rejected =
				expect(attachment).rejects.toThrow(RELOAD_REQUIRED);
			const closed = new Promise<void>((resolve) =>
				close.mockImplementationOnce(resolve)
			);
			owner.port2.postMessage({ type: 'shared-runtime-disconnect' });
			await rejected;
			await closed;
			expect(endpoint.unmountOpfs).toHaveBeenCalledWith('/wordpress');
		} finally {
			owner.port1.close();
			owner.port2.close();
			waiting.port1.close();
			waiting.port2.close();
		}
	});

	it('shares concurrent retirement while draining PHP, then flushes before disposal', async () => {
		let complete!: () => void;
		const exitCode = new Promise<void>((resolve) => {
			complete = resolve;
		});
		vi.mocked(endpoint.run).mockResolvedValue({ exitCode } as any);
		await runtime.api().run({ code: '<?php' });
		const retirement = Promise.all([runtime.retire(), runtime.retire()]);
		await expect(runtime.api().run({ code: '<?php' })).rejects.toThrow(
			RELOAD_REQUIRED
		);
		expect(endpoint.unmountOpfs).not.toHaveBeenCalled();
		complete();
		await retirement;
		expect(endpoint.unmountOpfs).toHaveBeenCalledWith('/wordpress');
		expect(
			vi.mocked(endpoint.unmountOpfs).mock.invocationCallOrder[0]
		).toBeLessThan(
			vi.mocked(endpoint[Symbol.asyncDispose]).mock.invocationCallOrder[0]
		);
		expect(close).toHaveBeenCalledTimes(1);
	});

	it('drains a directly routed response body before flushing or closing', async () => {
		let bodyController!: ReadableStreamDefaultController<Uint8Array>;
		const stdout = new ReadableStream<Uint8Array>({
			start(controller) {
				bodyController = controller;
			},
		});
		(endpoint as any).requestStreamed = vi.fn(async () => ({
			stdout,
			headers: Promise.resolve({}),
			httpStatusCode: Promise.resolve(200),
			exitCode: Promise.resolve(0),
		}));
		let replied!: () => void;
		const reply = new Promise<void>((resolve) => {
			replied = resolve;
		});
		const port = {
			postMessage: vi.fn(() => replied()),
		} as unknown as globalThis.MessagePort;
		const request = runtime.handleServiceWorkerRequest(
			{ method: 'request', args: [{}], requestId: 1 },
			port
		);
		await reply;
		const retirement = runtime.retire();
		await Promise.resolve();
		expect(endpoint.unmountOpfs).not.toHaveBeenCalled();
		bodyController.enqueue(new TextEncoder().encode('last bytes'));
		bodyController.close();
		await request;
		await retirement;
		expect(close).toHaveBeenCalledTimes(1);
		const message = vi.mocked(port.postMessage).mock.calls[0][0];
		message.response.bodyPort.close();
	});

	it('waits for PHP after a response body is cancelled or errors', async () => {
		let bodyController!: ReadableStreamDefaultController<Uint8Array>;
		let finishPHP!: () => void;
		const exitCode = new Promise<void>((resolve) => {
			finishPHP = resolve;
		});
		const stdout = new ReadableStream<Uint8Array>({
			start(controller) {
				bodyController = controller;
			},
		});
		(endpoint as any).requestStreamed = vi.fn(async () => ({
			stdout,
			headers: Promise.resolve({}),
			httpStatusCode: Promise.resolve(200),
			exitCode,
		}));
		let replied!: () => void;
		const reply = new Promise<void>((resolve) => {
			replied = resolve;
		});
		const port = {
			postMessage: vi.fn(() => replied()),
		} as unknown as globalThis.MessagePort;
		const request = runtime.handleServiceWorkerRequest(
			{ method: 'request', args: [{}], requestId: 1 },
			port
		);
		const rejected = expect(request).rejects.toThrow('body cancelled');
		await reply;
		bodyController.error(new Error('body cancelled'));
		const retirement = runtime.retire();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(endpoint.unmountOpfs).not.toHaveBeenCalled();
		finishPHP();
		await rejected;
		await retirement;
		expect(close).toHaveBeenCalledTimes(1);
		vi.mocked(port.postMessage).mock.calls[0][0].response.bodyPort.close();
	});

	it('keeps the runtime alive if flushing fails', async () => {
		const api = runtime.api() as PlaygroundWorkerEndpoint & {
			beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
		};
		await api.beginSharedBoot({ scope: 'default', withNetworking: true });
		vi.mocked(endpoint.unmountOpfs).mockRejectedValue(
			new Error('disk full')
		);
		await expect(runtime.retire()).rejects.toThrow('disk full');
		expect(close).not.toHaveBeenCalled();
		expect(endpoint[Symbol.asyncDispose]).not.toHaveBeenCalled();
	});

	it('retries a failed save without accepting operations before shutdown completes', async () => {
		const api = runtime.api() as PlaygroundWorkerEndpoint & {
			beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
		};
		await api.beginSharedBoot({ scope: 'default', withNetworking: true });
		vi.mocked(endpoint.unmountOpfs).mockRejectedValueOnce(
			new Error('disk full')
		);
		await expect(runtime.retire()).rejects.toThrow('disk full');
		await expect(api.run({ code: '<?php echo 1;' })).rejects.toThrow(
			RELOAD_REQUIRED
		);
		await expect(
			api.beginSharedBoot({ scope: 'default', withNetworking: true })
		).rejects.toThrow(RELOAD_REQUIRED);
		await runtime.retire();
		expect(endpoint.unmountOpfs).toHaveBeenCalledTimes(2);
		expect(endpoint[Symbol.asyncDispose]).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledTimes(1);
	});
	// A failed boot must release its worker even when the initializer tab stays open.
	it('retires after boot failure without waiting for the initializer to disconnect', async () => {
		vi.mocked(endpoint.boot).mockRejectedValueOnce(
			new Error('startup failed')
		);
		const channel = new MessageChannel();
		const failed = vi.fn();
		const closed = new Promise<void>((resolve) =>
			close.mockImplementation(resolve)
		);
		try {
			const port = channel.port1 as unknown as globalThis.MessagePort;
			runtime.connect(port, vi.fn(), failed);
			const api = runtime.api(port) as PlaygroundWorkerEndpoint & {
				beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
			};
			await expect(
				api.beginSharedBoot({
					scope: 'default',
					withNetworking: true,
				})
			).rejects.toThrow('startup failed');
			await closed;
			expect(failed).toHaveBeenCalledOnce();
			expect(endpoint[Symbol.asyncDispose]).toHaveBeenCalledOnce();
			await expect(api.run({ code: '<?php' })).rejects.toThrow(
				RELOAD_REQUIRED
			);
		} finally {
			channel.port1.close();
			channel.port2.close();
		}
	});
});
