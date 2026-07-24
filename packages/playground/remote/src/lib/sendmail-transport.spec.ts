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

	it('forwards one sendmail event from an acquired PHP instance', async () => {
		vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
		vi.stubGlobal('location', { href: 'http://playground.test/' });
		const setCommandSpawnHandler = vi.fn();
		const eventListeners = new Map<
			string,
			Set<(event: { type: string }) => void>
		>();
		const event = {
			type: 'sendmail.spawned',
			stdin: new ReadableStream<Uint8Array>(),
		};
		const php = {
			requestHandler: undefined,
			setCommandSpawnHandler,
			addEventListener: vi.fn(
				(
					eventType: string,
					listener: (event: { type: string }) => void
				) => {
					if (!eventListeners.has(eventType)) {
						eventListeners.set(eventType, new Set());
					}
					eventListeners.get(eventType)!.add(listener);
				}
			),
			onMessage: vi.fn(),
			chdir: vi.fn(),
			run: vi.fn(async () => {
				for (const eventType of [event.type, '*']) {
					for (const listener of eventListeners.get(eventType) ??
						[]) {
						listener(event);
					}
				}
				return {};
			}),
		};
		const requestHandler = {
			absoluteUrl: 'http://playground.test/',
			documentRoot: '/wordpress',
			getPrimaryPhp: vi.fn(async () => php),
			instanceManager: {
				acquirePHPInstance: vi.fn(async () => ({
					php,
					reap: vi.fn(),
				})),
			},
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
		const forwardedEvents: Array<{ type: string }> = [];
		endpoint.addEventListener('sendmail.spawned', (event) => {
			forwardedEvents.push(event);
		});

		await endpoint.createRequestHandlerForTest();

		expect(setCommandSpawnHandler).toHaveBeenCalledOnce();
		expect(setCommandSpawnHandler).toHaveBeenCalledWith(
			'sendmail',
			expect.any(Function)
		);

		await endpoint.run({
			code: "<?php mail('to@example.com', 'Subject', 'Body');",
		});

		expect(forwardedEvents).toEqual([event]);
	});
});
