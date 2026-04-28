import type {
	AllPHPVersion,
	EmscriptenOptions,
	LoadExtensionOptions,
	PHPLoaderModule,
	PHPRuntime,
	PreparedPHPWasmExtension,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	createLegacyPhpIniPreRunStep,
	installPHPExtensionFilesSync,
	isLegacyPHPVersion,
	loadPHPRuntime,
	prepareExtensionFromManifest,
	withPHPExtensionScanDir,
} from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import type { TCPOverFetchOptions } from './tcp-over-fetch-websocket';
import { tcpOverFetchWebsocket } from './tcp-over-fetch-websocket';
import { withIntl } from './extensions/intl/with-intl';

type PHPWasmExtensionManifestReference = Omit<
	LoadExtensionOptions,
	'php' | 'phpVersion' | 'asyncMode' | 'fetch'
>;

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	tcpOverFetch?: TCPOverFetchOptions;
	withIntl?: boolean;
	phpExtensions?: PreparedPHPWasmExtension[];
	phpExtensionManifests?: PHPWasmExtensionManifestReference[];
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

	const phpWasmAsyncMode = await detectPHPWasmAsyncMode();
	const phpExtensions = [
		...(loaderOptions.phpExtensions ?? []),
		...(await Promise.all(
			(loaderOptions.phpExtensionManifests ?? []).map((manifest) =>
				prepareExtensionFromManifest({
					...manifest,
					phpVersion,
					asyncMode: phpWasmAsyncMode,
				})
			)
		)),
	];

	let emscriptenOptions: EmscriptenOptions | Promise<EmscriptenOptions> = {
		...fakeWebsocket(),
		...(loaderOptions.emscriptenOptions || {}),
		phpWasmAsyncMode,
	};

	if (phpExtensions.length) {
		let resolvedOptions = emscriptenOptions as EmscriptenOptions;
		for (const extension of phpExtensions) {
			resolvedOptions = withPHPExtensionScanDir(
				resolvedOptions,
				extension.extensionDir
			);
		}
		const existingOnRuntimeInitialized =
			resolvedOptions.onRuntimeInitialized;
		emscriptenOptions = {
			...resolvedOptions,
			onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
				existingOnRuntimeInitialized?.(phpRuntime);
				for (const extension of phpExtensions) {
					installPHPExtensionFilesSync(phpRuntime.FS, extension);
				}
			},
		};
	}

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

async function detectPHPWasmAsyncMode(): Promise<'jspi' | 'asyncify'> {
	const { jspi } = await import('wasm-feature-detect');
	return (await jspi()) ? 'jspi' : 'asyncify';
}
