import type {
	SupportedPHPVersion,
	EmscriptenOptions,
	PHPLoaderModule,
} from '@php-wasm/universal';
import { loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import { withICUData } from './with-icu-data';
import { createFindConnector, type NetworkConnector } from '@php-wasm/util';
import { withNetworkConnectors } from './network-websocket';

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	/**
	 * Function to find the appropriate network connector for a connection.
	 *
	 * If not provided, a default HTTP/HTTPS connector with auto-generated
	 * CA certificate will be created automatically.
	 *
	 * Example:
	 * ```
	 * import { createHttpConnector, createSmtpConnector, generateCertificate } from '@php-wasm/web';
	 *
	 * const httpConnector = createHttpConnector({ CAroot });
	 * const smtpConnector = createSmtpConnector();
	 *
	 * function findConnector(info) {
	 *   if (info.port === 80 || info.port === 443) return httpConnector;
	 *   if (info.port === 25 || info.port === 587) return smtpConnector;
	 *   return undefined;
	 * }
	 *
	 * const php = await loadWebRuntime('8.0', { findConnector });
	 * ```
	 */
	networkConnectors?: NetworkConnector[];
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

export async function loadWebRuntime(
	phpVersion: SupportedPHPVersion,
	loaderOptions: LoaderOptions = {}
) {
	let emscriptenOptions: EmscriptenOptions | Promise<EmscriptenOptions> = {
		...fakeWebsocket(),
		...(loaderOptions.emscriptenOptions || {}),
	};

	if (loaderOptions.networkConnectors) {
		emscriptenOptions = withNetworkConnectors(emscriptenOptions, {
			connectTo: createFindConnector(loaderOptions.networkConnectors),
		});
	}

	if (loaderOptions.withICU) {
		emscriptenOptions = withICUData(emscriptenOptions);
	}

	const [phpLoaderModule, options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
	]);

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, options);
}
