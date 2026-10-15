import { MessageChannel } from 'node:worker_threads';
import { responseTo } from '@php-wasm/web-service-worker';

describe('direct shared runtime routing', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('self', {
			location: {
				href: 'https://example.test/sw.js?experimental-shared-worker=1',
			},
			clients: { matchAll: async () => [] },
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('retries discovery after a timeout without falling back to tab broadcasts', async () => {
		vi.useFakeTimers();
		const postMessage = vi.fn();
		vi.stubGlobal('self', {
			location: {
				href: 'https://example.test/sw.js?experimental-shared-worker=1',
			},
			clients: {
				matchAll: async () => [
					{
						url: 'https://example.test/remote.html?experimental-shared-worker=1&scope=site',
						postMessage,
					},
				],
			},
		});
		try {
			const { hasSharedRuntime, sendSharedRuntimeRequest } =
				await import('./shared-runtime-service-worker');
			const first = hasSharedRuntime('site');
			await vi.advanceTimersByTimeAsync(5000);
			expect(await first).toBe(true);
			const unavailable = await sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site'
			);
			expect(unavailable.httpStatusCode).toBe(503);
			expect(unavailable.headers).not.toHaveProperty(
				'x-playground-reload-required'
			);
			const retry = hasSharedRuntime('site');
			await vi.advanceTimersByTimeAsync(5000);
			expect(await retry).toBe(true);
			expect(postMessage.mock.calls).toEqual([
				[{ type: 'connect-shared-runtime' }],
				[{ type: 'connect-shared-runtime' }],
			]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('caches module details per connection while still rejecting stale documents', async () => {
		const { registerSharedRuntime, sendSharedRuntimeRequest } =
			await import('./shared-runtime-service-worker');
		const channels = [new MessageChannel(), new MessageChannel()];
		const requests = vi.fn();
		const message = { method: 'getWordPressModuleDetails', args: [] };
		try {
			for (const [index, channel] of channels.entries()) {
				channel.port2.on('message', (data) => {
					requests();
					channel.port2.postMessage(
						responseTo(data.requestId, {
							staticAssetsDirectory: `assets-${index}`,
						})
					);
				});
				registerSharedRuntime({
					data: {
						type: 'register-shared-runtime',
						scope: 'site',
						runtimeId: `runtime-${index}`,
					},
					ports: [channel.port1],
				} as unknown as ExtendableMessageEvent);
				const client = {
					clientId: `client-${index}`,
					resultingClientId: '',
				};
				expect(
					await sendSharedRuntimeRequest(message, 'site', client)
				).toEqual({ staticAssetsDirectory: `assets-${index}` });
				await sendSharedRuntimeRequest(message, 'site', client);
			}
			expect(requests).toHaveBeenCalledTimes(2);
			const stale = await sendSharedRuntimeRequest(message, 'site', {
				clientId: 'client-0',
				resultingClientId: '',
			});
			expect(stale.headers['x-playground-reload-required']).toEqual([
				'1',
			]);
		} finally {
			for (const channel of channels) {
				channel.port1.close();
				channel.port2.close();
			}
		}
	});

	it('keeps in-flight replies alive when another tab registers a connection', async () => {
		const { registerSharedRuntime, sendSharedRuntimeRequest } =
			await import('./shared-runtime-service-worker');
		const first = new MessageChannel();
		const second = new MessageChannel();
		try {
			registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'runtime-a',
				},
				ports: [first.port1],
			} as unknown as ExtendableMessageEvent);
			let answer!: () => void;
			const received = new Promise<void>((resolve) => {
				first.port2.on('message', (data) => {
					answer = () =>
						first.port2.postMessage(
							responseTo(data.requestId, 'served')
						);
					resolve();
				});
			});
			const reply = sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site'
			);
			await received;
			registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'runtime-a',
				},
				ports: [second.port1],
			} as unknown as ExtendableMessageEvent);
			answer();
			expect(await reply).toBe('served');
		} finally {
			first.port1.close();
			first.port2.close();
			second.port1.close();
			second.port2.close();
		}
	});

	it('asks an old WordPress document to reload after a replacement runtime is available', async () => {
		const { registerSharedRuntime, sendSharedRuntimeRequest } =
			await import('./shared-runtime-service-worker');
		const first = new MessageChannel();
		const second = new MessageChannel();
		try {
			first.port2.on('message', (data) =>
				first.port2.postMessage(
					responseTo(data.requestId, { httpStatusCode: 200 })
				)
			);
			second.port2.on('message', (data) =>
				second.port2.postMessage(
					responseTo(data.requestId, { httpStatusCode: 200 })
				)
			);
			registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'runtime-a',
				},
				ports: [first.port1],
			} as unknown as ExtendableMessageEvent);
			await sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site',
				{
					clientId: 'host',
					resultingClientId: 'old-wordpress-document',
				}
			);
			registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'runtime-b',
				},
				ports: [second.port1],
			} as unknown as ExtendableMessageEvent);
			const fresh = await sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site',
				{
					clientId: 'new-host',
					resultingClientId: 'new-wordpress-document',
				}
			);
			expect(fresh.httpStatusCode).toBe(200);
			const stale = await sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site',
				{ clientId: 'old-wordpress-document', resultingClientId: '' }
			);
			expect(stale.httpStatusCode).toBe(503);
			expect(stale.headers['x-playground-runtime-closed']).toEqual(['1']);
		} finally {
			first.port1.close();
			first.port2.close();
			second.port1.close();
			second.port2.close();
		}
	});
});
