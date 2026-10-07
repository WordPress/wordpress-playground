import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerPHPWorkerPort, requestPHPWorker } from '../lib/utils';
import { responseTo } from '../lib/messaging';

afterEach(() => vi.unstubAllGlobals());

describe('shared PHP worker routing', () => {
	it('sends one request to the matching bridge, not to every open tab', async () => {
		const foreign = {
			url: 'https://example.com/remote.html?php-worker-id=b&php-worker-scope=other',
			postMessage: vi.fn(),
		};
		const matching = {
			url: 'https://example.com/remote.html?php-worker-id=a&php-worker-scope=site',
			postMessage: vi.fn((message) => {
				message.port.postMessage(
					responseTo(message.requestId, 'same site')
				);
				message.port.close();
			}),
		};
		const duplicate = { ...matching, postMessage: vi.fn() };
		vi.stubGlobal('self', {
			clients: { matchAll: async () => [foreign, matching, duplicate] },
		});

		expect(
			await requestPHPWorker(
				{ method: 'getWordPressModuleDetails' },
				'site'
			)
		).toBe('same site');
		expect(matching.postMessage).toHaveBeenCalledOnce();
		expect(foreign.postMessage).not.toHaveBeenCalled();
		expect(duplicate.postMessage).not.toHaveBeenCalled();
	});

	it('uses the direct PHP port while the last tab is between documents', async () => {
		const { port1, port2 } = new MessageChannel();
		port2.addEventListener('message', (event) => {
			event.data.port.postMessage(
				responseTo(event.data.requestId, 'still running')
			);
			event.data.port.close();
		});
		port2.start();
		registerPHPWorkerPort('reloading-site', port1);
		vi.stubGlobal('self', { clients: { matchAll: async () => [] } });
		try {
			expect(
				await requestPHPWorker({ method: 'request' }, 'reloading-site')
			).toBe('still running');
		} finally {
			port1.close();
			port2.close();
		}
	});
});
