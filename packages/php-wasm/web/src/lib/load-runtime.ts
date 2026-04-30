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
import {
	withPHPExtensions,
	type PHPWebExtension,
} from './extensions/load-extensions';
import { jspi } from 'wasm-feature-detect';

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	tcpOverFetch?: TCPOverFetchOptions;
	/**
	 * PHP extensions to install before the runtime starts.
	 *
	 * Use built-in names such as `intl`, or pass an external extension source
	 * such as a manifest.
	 */
	extensions?: PHPWebExtension[];
	/**
	 * @deprecated Use `extensions: ['intl']` instead.
	 */
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

	const phpWasmAsyncMode = (await jspi()) ? 'jspi' : 'asyncify';

	let emscriptenOptions: EmscriptenOptions | Promise<EmscriptenOptions> = {
		...fakeWebsocket(),
		...(loaderOptions.emscriptenOptions || {}),
		phpWasmAsyncMode,
	};

	if (loaderOptions.tcpOverFetch) {
		emscriptenOptions = tcpOverFetchWebsocket(
			emscriptenOptions,
			loaderOptions.tcpOverFetch
		);
	}

	const isLegacy = isLegacyPHPVersion(phpVersion);
	const requestedExtensions = [...(loaderOptions.extensions ?? [])];
	if (
		loaderOptions.withIntl &&
		!hasBuiltInExtension(requestedExtensions, 'intl')
	) {
		requestedExtensions.push('intl');
	}

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

	if (isLegacy && requestedExtensions.length) {
		throw new Error(
			`Extensions are not available for legacy PHP ${phpVersion}.`
		);
	}

	if (!isLegacy) {
		emscriptenOptions = withPHPExtensions(
			phpVersion as SupportedPHPVersion,
			phpWasmAsyncMode,
			await emscriptenOptions,
			requestedExtensions
		);
	}

	const [phpLoaderModule, options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
	]);

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, options);
}

/**
 * Checks whether a built-in web extension has already been requested.
 *
 * This keeps deprecated `withIntl` calls backwards compatible without adding a
 * duplicate `intl` install when callers also pass `extensions: ['intl']`.
 * External extension sources are ignored because their names are resolved later
 * from bytes, URLs, or manifests.
 */
function hasBuiltInExtension(
	extensions: PHPWebExtension[],
	name: string
): boolean {
	return extensions.some((extension) => {
		if (typeof extension === 'string') {
			return extension === name;
		}
		return !('source' in extension) && extension.name === name;
	});
}
