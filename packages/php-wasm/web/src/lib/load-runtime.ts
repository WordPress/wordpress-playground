import type {
	AllPHPVersion,
	EmscriptenOptions,
	PHPLoaderModule,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	createLegacyPhpIniPreRunStep,
	isLegacyPHPVersion,
	loadPHPRuntime,
} from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import type { TCPOverFetchOptions } from './tcp-over-fetch-websocket';
import { tcpOverFetchWebsocket } from './tcp-over-fetch-websocket';
import { withIntl } from './extensions/intl/with-intl';

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
	phpVersion: AllPHPVersion,
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

	const isLegacy = isLegacyPHPVersion(phpVersion);

	// For legacy PHP: pre-create php.ini via a preRun step. See
	// createLegacyPhpIniPreRunStep for why this must run before the
	// PHP SAPI starts.
	if (isLegacy) {
		const resolvedOptions = await emscriptenOptions;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		const existingPreRun: Function[] = resolvedOptions['preRun'] || [];
		emscriptenOptions = {
			...resolvedOptions,
			['preRun']: [...existingPreRun, createLegacyPhpIniPreRunStep()],
		};
	}

	if (isLegacy && loaderOptions.withIntl) {
		throw new Error(
			`The intl extension is not available for legacy PHP ${phpVersion}.`
		);
	}

	if (!isLegacy) {
		if (loaderOptions.withIntl) {
			emscriptenOptions = withIntl(
				phpVersion as SupportedPHPVersion,
				emscriptenOptions
			);
		}
	}

	const [phpLoaderModule, options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
	]);

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, options);
}
