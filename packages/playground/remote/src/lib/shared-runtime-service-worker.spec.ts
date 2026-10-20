import { MessageChannel } from 'node:worker_threads';
import { responseTo } from '@php-wasm/web-service-worker';

describe('direct shared runtime routing', () => {
	beforeEach(() => {
		vi.resetModules();
		const responses = new Map<string, Response>();
		vi.stubGlobal('caches', {
			open: async () => ({
				match: async (key: string) => responses.get(key)?.clone(),
				put: async (key: string, response: Response) => {
					responses.set(key, response.clone());
				},
			}),
		});
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
	// Contract: documents keep their runtime identity when the ServiceWorker is replaced.
	// Independent regression path: worker activation clears all module-level maps.
	it('rejects an old document before forwarding PHP after a ServiceWorker restart', async () => {
		const first = new MessageChannel();
		const second = new MessageChannel();
		const requestsToReplacement = vi.fn();
		try {
			first.port2.on('message', (data) =>
				first.port2.postMessage(
					responseTo(data.requestId, { httpStatusCode: 200 })
				)
			);
			second.port2.on('message', (data) => {
				requestsToReplacement();
				second.port2.postMessage(
					responseTo(data.requestId, { httpStatusCode: 200 })
				);
			});
			const original = await import('./shared-runtime-service-worker');
			original.registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'old',
				},
				ports: [first.port1],
			} as unknown as ExtendableMessageEvent);
			await original.sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site',
				{
					clientId: 'old-host',
					resultingClientId: 'old-document',
				}
			);

			vi.resetModules();
			const replacement = await import('./shared-runtime-service-worker');
			replacement.registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'new',
				},
				ports: [second.port1],
			} as unknown as ExtendableMessageEvent);
			const oldRequest = await replacement.sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site',
				{
					clientId: 'old-document',
					resultingClientId: 'would-be-next-document',
				}
			);
			expect(oldRequest.httpStatusCode).toBe(503);
			expect(oldRequest.headers['x-playground-reload-required']).toEqual([
				'1',
			]);
			expect(requestsToReplacement).not.toHaveBeenCalled();
			const newRequest = await replacement.sendSharedRuntimeRequest(
				{ method: 'request', args: [] },
				'site',
				{
					clientId: 'new-host',
					resultingClientId: 'new-document',
				}
			);
			expect(newRequest.httpStatusCode).toBe(200);
			expect(requestsToReplacement).toHaveBeenCalledOnce();
		} finally {
			for (const channel of [first, second]) {
				channel.port1.close();
				channel.port2.close();
			}
		}
	});
	// Contract: stale-tab announcements cannot hide the live owner, including rediscovery.
	// Independent triggers: controllerchange and ServiceWorker eviction reorder registrations.
	it('discovers a live tab after a retired tab and ignores later stale registrations', async () => {
		const api = await import('./shared-runtime-service-worker');
		const channel = new MessageChannel();
		const retired = () =>
			api.registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'old',
					retired: true,
					closed: true,
				},
				ports: [],
			} as unknown as ExtendableMessageEvent);
		const live = () =>
			api.registerSharedRuntime({
				data: {
					type: 'register-shared-runtime',
					scope: 'site',
					runtimeId: 'live',
				},
				ports: [channel.port1],
			} as unknown as ExtendableMessageEvent);
		vi.stubGlobal('self', {
			location: {
				href: 'https://example.test/sw.js?experimental-shared-worker=1',
			},
			clients: {
				matchAll: async () => [
					{
						url: 'https://example.test/remote.html?experimental-shared-worker=1&scope=site',
						postMessage: retired,
					},
					{
						url: 'https://example.test/remote.html?experimental-shared-worker=1&scope=site',
						postMessage: live,
					},
				],
			},
		});
		try {
			channel.port2.on('message', (data) =>
				channel.port2.postMessage(responseTo(data.requestId, 'served'))
			);
			expect(await api.hasSharedRuntime('site')).toBe(true);
			expect(
				await api.sendSharedRuntimeRequest(
					{ method: 'request', args: [] },
					'site'
				)
			).toBe('served');
			retired();
			expect(
				await api.sendSharedRuntimeRequest(
					{ method: 'request', args: [] },
					'site'
				)
			).toBe('served');
		} finally {
			channel.port1.close();
			channel.port2.close();
		}
	});

	// Contract: optional persistence cannot block requests or erase in-memory ownership.
	// Independent failures: CacheStorage opening, reading, and quota-limited writing.
	it.each(['open', 'match', 'put'])(
		'routes requests with failing cache.%s and retains stale-client protection',
		async (failure) => {
			const cache = {
				match:
					failure === 'match'
						? vi
								.fn()
								.mockRejectedValue(
									new Error('storage unavailable')
								)
						: vi.fn().mockResolvedValue(undefined),
				put:
					failure === 'put'
						? vi.fn().mockRejectedValue(new Error('quota exceeded'))
						: vi.fn().mockResolvedValue(undefined),
			};
			const open =
				failure === 'open'
					? vi
							.fn()
							.mockRejectedValue(new Error('storage unavailable'))
					: vi.fn().mockResolvedValue(cache);
			vi.stubGlobal('caches', { open });
			const api = await import('./shared-runtime-service-worker');
			const channel = new MessageChannel();
			try {
				channel.port2.on('message', (data) =>
					channel.port2.postMessage(
						responseTo(data.requestId, 'served')
					)
				);
				api.registerSharedRuntime({
					data: {
						type: 'register-shared-runtime',
						scope: 'site',
						runtimeId: 'old',
					},
					ports: [channel.port1],
				} as unknown as ExtendableMessageEvent);
				const client = { clientId: 'document', resultingClientId: '' };
				expect(
					await api.sendSharedRuntimeRequest(
						{ method: 'request', args: [] },
						'site',
						client
					)
				).toBe('served');
				const attempts = open.mock.calls.length;
				expect(
					await api.sendSharedRuntimeRequest(
						{ method: 'request', args: [] },
						'site',
						client
					)
				).toBe('served');
				expect(open).toHaveBeenCalledTimes(attempts);
				api.registerSharedRuntime({
					data: {
						type: 'register-shared-runtime',
						scope: 'site',
						runtimeId: 'new',
					},
					ports: [channel.port1],
				} as unknown as ExtendableMessageEvent);
				const stale = await api.sendSharedRuntimeRequest(
					{ method: 'request', args: [] },
					'site',
					client
				);
				expect(stale.httpStatusCode).toBe(503);
			} finally {
				channel.port1.close();
				channel.port2.close();
			}
		}
	);
});
