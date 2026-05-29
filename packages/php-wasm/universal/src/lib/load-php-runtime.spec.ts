import { describe, expect, it, vi } from 'vitest';

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
	it('shares loaded runtimes across duplicate module instances', async () => {
		vi.resetModules();
		const firstModule = await import('./load-php-runtime');
		const runtimeId =
			await firstModule.loadPHPRuntime(createLoaderModule());

		vi.resetModules();
		const secondModule = await import('./load-php-runtime');
		const runtime = secondModule.popLoadedRuntime(runtimeId as any);

		expect(runtime.id).toBe(runtimeId);
	});
});
