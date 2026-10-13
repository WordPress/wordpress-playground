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
