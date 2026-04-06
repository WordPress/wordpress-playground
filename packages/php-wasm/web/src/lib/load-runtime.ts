import type {
	AllPHPVersion,
	EmscriptenOptions,
	PHPLoaderModule,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LegacyPHPVersions, loadPHPRuntime } from '@php-wasm/universal';
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

	const isLegacy = (LegacyPHPVersions as readonly string[]).includes(
		phpVersion
	);

	// For legacy PHP: pre-create php.ini with disable_functions BEFORE
	// the PHP SAPI starts. ini_get_all() crashes PHP 5.6 WASM (null
	// function pointer in asyncify instrumentation), and OPcache's
	// shared memory allocation fails. preRun runs before initRuntime().
	if (isLegacy) {
		const resolvedOptions = await emscriptenOptions;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		const existingPreRun: Function[] = resolvedOptions['preRun'] || [];
		emscriptenOptions = {
			...resolvedOptions,
			['preRun']: [
				...existingPreRun,
				(module: any) => {
					module.FS.mkdirTree('/internal/shared');
					module.FS.writeFile(
						'/internal/shared/php.ini',
						[
							'auto_prepend_file=/internal/shared/auto_prepend_file.php',
							'memory_limit=256M',
							'ignore_repeated_errors = 1',
							'error_reporting = E_ALL',
							'display_errors = 1',
							'html_errors = 1',
							'display_startup_errors = On',
							'log_errors = 1',
							'always_populate_raw_post_data = -1',
							'upload_max_filesize = 2000M',
							'post_max_size = 2000M',
							'allow_url_fopen = On',
							'allow_url_include = Off',
							'session.save_path = /home/web_user',
							'implicit_flush = 1',
							'output_buffering = 0',
							'max_execution_time = 0',
							'max_input_time = -1',
							'disable_functions = ini_get_all',
							'opcache.enable = 0',
							'opcache.enable_cli = 0',
						].join('\n')
					);
				},
			],
		};
	}

	if (loaderOptions.withIntl) {
		if (isLegacy) {
			throw new Error(
				`The intl extension is not available for legacy PHP ${phpVersion}.`
			);
		}
		emscriptenOptions = withIntl(
			phpVersion as SupportedPHPVersion,
			emscriptenOptions
		);
	}

	const [phpLoaderModule, options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
	]);

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, options);
}
