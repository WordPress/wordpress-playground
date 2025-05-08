import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
	PHPLoaderModule,
} from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import {
	TCPOverFetchOptions,
	tcpOverFetchWebsocket,
} from './tcp-over-fetch-websocket';
import { withICUData } from './with-icu-data';

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
	loaderOptions: LoaderOptions = {}
) {
	const emscriptenOptions: EmscriptenOptions = {
		...(loaderOptions.emscriptenOptions || {}),
	};

	const websocketExtension: EmscriptenOptions = loaderOptions.tcpOverFetch
		? tcpOverFetchWebsocket(loaderOptions.tcpOverFetch)
		: fakeWebsocket();

	const dataExtension: EmscriptenOptions = loaderOptions.withICU
		? withICUData()
		: Promise.resolve({});

	const [phpLoaderModule, ...options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
		websocketExtension,
		dataExtension,
	]);

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, ...options);
}
