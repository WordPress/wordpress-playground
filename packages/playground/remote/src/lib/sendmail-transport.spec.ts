import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';

const bootRequestHandlerMock = vi.hoisted(() => vi.fn());
const sandboxedSpawnHandlerFactoryMock = vi.hoisted(() => vi.fn());

vi.mock('@wp-playground/wordpress', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	bootRequestHandler: bootRequestHandlerMock,
}));

vi.mock('@php-wasm/universal', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	sandboxedSpawnHandlerFactory: sandboxedSpawnHandlerFactoryMock,
}));

describe('remote sendmail transport', () => {
	afterEach(() => {
		bootRequestHandlerMock.mockReset();
		sandboxedSpawnHandlerFactoryMock.mockReset();
		vi.unstubAllGlobals();
	});

	it('constructs the sandboxed handler with the current PHP instance', async () => {
		vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
		vi.stubGlobal('location', { href: 'http://playground.test/' });
		let spawnHandler:
			| ((getPHPInstance?: unknown, currentPHP?: unknown) => unknown)
			| undefined;
		bootRequestHandlerMock.mockImplementationOnce(async (options) => {
			spawnHandler = options.spawnHandler;
			return {
				documentRoot: '/wordpress',
				getPrimaryPhp: vi.fn(async () => ({
					requestHandler: undefined,
				})),
			};
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

		await new TestEndpoint(
			{} as EmscriptenDownloadMonitor
		).createRequestHandlerForTest();
		const getPHPInstance = vi.fn();
		const currentPHP = {};
		expect(spawnHandler).toBeDefined();
		spawnHandler!(getPHPInstance, currentPHP);

		expect(sandboxedSpawnHandlerFactoryMock).toHaveBeenCalledWith(
			getPHPInstance,
			undefined,
			currentPHP
		);
	});

	it('registers sendmail capture when a PHP instance is created', async () => {
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

		await endpoint.createRequestHandlerForTest();

		expect(setCommandSpawnHandler).toHaveBeenCalledOnce();
		expect(setCommandSpawnHandler).toHaveBeenCalledWith(
			'sendmail',
			expect.any(Function)
		);
	});
});
