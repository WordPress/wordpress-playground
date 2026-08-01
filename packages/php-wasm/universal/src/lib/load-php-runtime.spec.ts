import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RuntimeRegistryKey = Symbol.for('@php-wasm/universal@3.loadedRuntimes');

function deleteRuntimeRegistry() {
	delete (globalThis as Record<symbol, unknown>)[RuntimeRegistryKey];
}

function createLoaderModule() {
	return {
		phpWasmAsyncMode: 'jspi',
		init: vi.fn((_runtime, options) => {
			const phpRuntime = {
				FS: {},
				_exit: vi.fn(),
				outboundNetworkProxyServer: undefined,
			};
			queueMicrotask(() => options.onRuntimeInitialized());
			return phpRuntime;
		}),
	} as any;
}

describe('PHP runtime registry', () => {
	beforeEach(() => {
		deleteRuntimeRegistry();
	});

	afterEach(() => {
		deleteRuntimeRegistry();
	});

	it('shares monotonic runtime IDs across duplicate module instances', async () => {
		vi.resetModules();
		const firstModule = await import('./load-php-runtime');
		const firstRuntimeId =
			await firstModule.loadPHPRuntime(createLoaderModule());

		vi.resetModules();
		const secondModule = await import('./load-php-runtime');
		const secondRuntimeId =
			await secondModule.loadPHPRuntime(createLoaderModule());

		expect(firstRuntimeId).toBe(1);
		expect(secondRuntimeId).toBe(2);

		const firstRuntime = secondModule.popLoadedRuntime(
			firstRuntimeId as any
		);
		const secondRuntime = firstModule.popLoadedRuntime(
			secondRuntimeId as any
		);

		expect(firstRuntime.id).toBe(firstRuntimeId);
		expect(secondRuntime.id).toBe(secondRuntimeId);
		expect(() =>
			secondModule.popLoadedRuntime(firstRuntimeId as any)
		).toThrow(`Runtime with id ${firstRuntimeId} not found`);
	});
});
