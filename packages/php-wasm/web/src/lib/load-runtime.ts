import {
	EmscriptenOptions,
	loadPHPRuntime,
	PHPLoaderModule,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import * as tls from './tcp-over-fetch';

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	/** @deprecated To be replaced with `extensions` in the future */
	loadAllExtensions?: boolean;
}

/**
 * Fake a websocket connection to prevent errors in the web app
 * from cascading and breaking the Playground.
 */
// const fakeWebsocket = () => {
// 	return {
// 		websocket: {
// 			decorator: (WebSocketConstructor: any) => {
// 				return class FakeWebsocketConstructor extends WebSocketConstructor {
// 					constructor() {
// 						try {
// 							super();
// 						} catch (e) {
// 							// pass
// 						}
// 					}

// 					send() {
// 						return null;
// 					}
// 				};
// 			},
// 		},
// 	};
// };

export async function loadWebRuntime(
	phpVersion: SupportedPHPVersion,
	options: LoaderOptions = {}
) {
	const phpLoaderModule = await getPHPLoaderModule(phpVersion);
	options.onPhpLoaderModuleLoaded?.(phpLoaderModule);
	return await loadPHPRuntime(phpLoaderModule, {
		...(options.emscriptenOptions || {}),
		...tls.tcpOverFetchWebsocket(options.emscriptenOptions!['websocket']),
	});
}
