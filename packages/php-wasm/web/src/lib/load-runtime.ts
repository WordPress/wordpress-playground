import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
	PHPRuntime,
	FSHelpers,
	PHPLoaderModule,
} from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import {
	TCPOverFetchOptions,
	tcpOverFetchWebsocket,
} from './tcp-over-fetch-websocket';

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	tcpOverFetch?: TCPOverFetchOptions;
	withICU?: boolean;
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
						} catch (e) {
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

export async function loadWebRuntime(
	phpVersion: SupportedPHPVersion,
	options: LoaderOptions = {}
) {
	const emscriptenOptions: EmscriptenOptions = {
		...(options.emscriptenOptions || {}),
		onRuntimeInitialized: async (phpRuntime: PHPRuntime) => {
			/*
			 * An ICU data file must be loaded to support Intl extension.
			 * To achieve this, a shared directory is mounted and referenced
			 * via the ICU_DATA environment variable.
			 * By default, this variable is set to '/internal/shared',
			 * which corresponds to the actual file location.
			 * The web version requires a `loaderOption` to load ICU data.
			 */
			if (options?.withICU === true) {
				const icuFileName = 'icudt74l.dat';
				const icuFilePath =
					'node_modules/@php-wasm/web/shared/icudt74l.dat';
				if (
					!FSHelpers.fileExists(
						phpRuntime.FS,
						`${phpRuntime.ENV.ICU_DATA}/${icuFileName}`
					) &&
					(await fetch(icuFilePath, { method: 'HEAD' })).ok
				) {
					phpRuntime.FS.mkdirTree(phpRuntime.ENV.ICU_DATA);
					phpRuntime.FS.writeFile(
						`${phpRuntime.ENV.ICU_DATA}/${icuFileName}`,
						new Uint8Array(
							await (await fetch(icuFilePath)).arrayBuffer()
						)
					);
				}
			}
		},
	};

	const phpLoaderModule = await getPHPLoaderModule(phpVersion);
	options.onPhpLoaderModuleLoaded?.(phpLoaderModule);
	const websocketExtension = options.tcpOverFetch
		? tcpOverFetchWebsocket(options.tcpOverFetch)
		: fakeWebsocket();
	return await loadPHPRuntime(phpLoaderModule, {
		...emscriptenOptions,
		...websocketExtension,
	});
}
