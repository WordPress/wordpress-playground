import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { phpEventStdinTransfer } from '@php-wasm/util';

const bootRequestHandlerMock = vi.hoisted(() => vi.fn());
const sendmailSpawnHandlerMock = vi.hoisted(() =>
	vi.fn<(eventTarget: { dispatchEvent(event: unknown): void }) => () => void>(
		() => vi.fn()
	)
);

vi.mock('@wp-playground/wordpress', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	bootRequestHandler: bootRequestHandlerMock,
}));
vi.mock('@php-wasm/util', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	sendmailSpawnHandler: sendmailSpawnHandlerMock,
}));

describe('remote sendmail transport', () => {
	afterEach(() => {
		bootRequestHandlerMock.mockReset();
		sendmailSpawnHandlerMock.mockClear();
		vi.unstubAllGlobals();
	});

	it('routes sendmail events from created PHP instances through the endpoint', async () => {
		vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
		vi.stubGlobal('location', { href: 'http://playground.test/' });
		const setCommandSpawnHandler = vi.fn();
		const php = {
			requestHandler: undefined,
			setCommandSpawnHandler,
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
		const listener = vi.fn();
		endpoint.addEventListener('sendmail.spawned', listener);

		await endpoint.createRequestHandlerForTest();

		expect(setCommandSpawnHandler).toHaveBeenCalledOnce();
		expect(setCommandSpawnHandler).toHaveBeenCalledWith(
			'sendmail',
			expect.any(Function)
		);

		const event = {
			type: 'sendmail.spawned',
			stdin: new ReadableStream<Uint8Array>(),
			[phpEventStdinTransfer]: true,
		} as const;
		const eventTarget = sendmailSpawnHandlerMock.mock.calls[0][0];
		eventTarget.dispatchEvent(event);

		expect(listener).toHaveBeenCalledOnce();
		expect(listener).toHaveBeenCalledWith(event);
	});
});
