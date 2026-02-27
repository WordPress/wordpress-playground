import type {
	SupportedPHPVersion,
	EmscriptenOptions,
	PHPLoaderModule,
} from '@php-wasm/universal';
import { loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import type { TCPOverFetchOptions } from './tcp-over-fetch-websocket';
import { tcpOverFetchWebsocket } from './tcp-over-fetch-websocket';
import { withIntl } from './extensions/intl/with-intl';
import type { SharedChannel } from './jspi-polyfill';
import {
	needsJspiPolyfill,
	installJspiPolyfill,
	createSharedChannel,
	sendRequestFromWorker,
	REQUEST_SLEEP,
} from './jspi-polyfill';

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	tcpOverFetch?: TCPOverFetchOptions;
	withIntl?: boolean;
}

/**
 * Fake a websocket connection to prevent errors in the web app
 * from cascading and breaking the Playground.
 */
const fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor: any) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						try {
							super();
						} catch {
							// pass
						}
					}

					send() {
						return null;
					}
				};
			},
		},
	};
};

interface PHPWorkerGlobalScope extends WorkerGlobalScope {
	setImmediate: (fn: () => void) => void;
}

export async function loadWebRuntime(
	phpVersion: SupportedPHPVersion,
	loaderOptions: LoaderOptions = {}
) {
	/*
	 * Provide `setImmediate` so Emscripten doesn’t install its message-based
	 * polyfill, which retains references to the Wasm HEAP and prevents the
	 * PHP instance from being garbage-collected.
	 *
	 * https://github.com/emscripten-core/emscripten/blob/6d61ffd7076309cb08af37aba496f25c23cdb5a4/src/lib/libeventloop.js#L57
	 */
	if (!('setImmediate' in globalThis)) {
		(globalThis as unknown as PHPWorkerGlobalScope).setImmediate = (
			fn: () => void
		) => setTimeout(fn, 0);
	}

	let emscriptenOptions: EmscriptenOptions | Promise<EmscriptenOptions> = {
		...fakeWebsocket(),
		...(loaderOptions.emscriptenOptions || {}),
	};

	if (loaderOptions.tcpOverFetch) {
		emscriptenOptions = tcpOverFetchWebsocket(
			emscriptenOptions,
			loaderOptions.tcpOverFetch
		);
	}

	if (loaderOptions.withIntl) {
		emscriptenOptions = withIntl(phpVersion, emscriptenOptions);
	}

	const [phpLoaderModule, options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
	]);

	let finalOptions = options;
	if (await needsJspiPolyfill()) {
		// eslint-disable-next-line no-console
		console.info('This browser does not support JSPI. Using a polyfill.');
		installJspiPolyfill();
		const channel = createSharedChannel();
		// The main thread must install the SAB listener
		// (setupJspiPolyfillListener) before the worker
		// reaches this point. This is safe because the
		// worker signals 'worker-script-started' first,
		// the main thread installs the listener upon
		// receiving it, and only then does the worker
		// proceed to call loadWebRuntime().
		self.postMessage({
			type: 'jspi-polyfill-channel',
			sab: channel.sab,
		});
		finalOptions = wrapInstantiateWasmForPolyfill(options, channel);
	}

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, finalOptions);
}

function wrapInstantiateWasmForPolyfill(
	options: EmscriptenOptions,
	channel: SharedChannel
): EmscriptenOptions {
	const originalInstantiateWasm = options.instantiateWasm;
	if (!originalInstantiateWasm) {
		// When Module['instantiateWasm'] is set, Emscripten
		// skips its default instantiation path entirely and
		// expects the hook to call receiveInstance(). Without
		// an original hook to delegate to, we cannot reliably
		// locate and fetch the WASM binary ourselves.
		throw new Error(
			'JSPI polyfill requires emscriptenOptions.instantiateWasm. ' +
				'Provide a custom instantiateWasm hook so the polyfill ' +
				'can intercept WASM imports before instantiation.'
		);
	}
	return {
		...options,
		instantiateWasm(
			info: WebAssembly.Imports,
			receiveInstance: (
				instance: WebAssembly.Instance,
				module: WebAssembly.Module
			) => void
		) {
			patchAsyncImports(info, channel);
			return originalInstantiateWasm(info, receiveInstance);
		},
	};
}

function patchAsyncImports(
	info: WebAssembly.Imports,
	channel: SharedChannel
): void {
	const env = info['env'] as Record<string, unknown> | undefined;
	if (env && typeof env['emscripten_sleep'] === 'function') {
		env['emscripten_sleep'] = (ms: number) => {
			sendRequestFromWorker(channel, REQUEST_SLEEP, [ms]);
		};
	}
}
