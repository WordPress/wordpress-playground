import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';

const bootRequestHandlerMock = vi.hoisted(() => vi.fn());

vi.mock('@wp-playground/wordpress', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	bootRequestHandler: bootRequestHandlerMock,
}));

describe('remote sendmail transport', () => {
	afterEach(() => {
		bootRequestHandlerMock.mockReset();
		vi.unstubAllGlobals();
	});

	it('captures and forwards sendmail events from a created PHP instance', async () => {
		vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
		vi.stubGlobal('location', { href: 'http://playground.test/' });
		const setCommandSpawnHandler = vi.fn();
		const phpListeners: Array<(event: { type: string }) => void> = [];
		const php = {
			requestHandler: undefined,
			setCommandSpawnHandler,
			addEventListener: vi.fn(
				(
					eventType: string,
					listener: (event: { type: string }) => void
				) => {
					if (eventType === '*') {
						phpListeners.push(listener);
					}
				}
			),
			onMessage: vi.fn(),
		};
		const requestHandler = {
			documentRoot: '/wordpress',
			getPrimaryPhp: vi.fn(async () => php),
		};
		bootRequestHandlerMock.mockImplementationOnce(async (options) => {
			await options.onPHPInstanceCreated(php, { isPrimary: true });
			return requestHandler;
		});

		const { PlaygroundWorkerEndpoint } =
			await import('./playground-worker-endpoint');
		class TestEndpoint extends PlaygroundWorkerEndpoint {
			async boot() {}

			createRequestHandlerForTest() {
				return this.createRequestHandler({
					siteUrl: 'http://playground.test/',
					sapiName: 'cli',
					knownRemoteAssetPaths: new Set<string>(),
					withNetworking: false,
					phpVersion: '8.4',
				});
			}
		}
		const endpoint = new TestEndpoint({} as EmscriptenDownloadMonitor);
		const received: Array<{ type: string }> = [];
		endpoint.addEventListener('sendmail.spawned', (event) => {
			received.push(event);
		});

		await endpoint.createRequestHandlerForTest();

		expect(setCommandSpawnHandler).toHaveBeenCalledOnce();
		expect(setCommandSpawnHandler).toHaveBeenCalledWith(
			'sendmail',
			expect.any(Function)
		);

		const event = { type: 'sendmail.spawned' };
		await Promise.all(phpListeners.map((listener) => listener(event)));

		expect(received).toEqual([event]);
	});
});
