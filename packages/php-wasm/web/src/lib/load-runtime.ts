import {
	EmscriptenOptions,
	loadPHPRuntime,
	PHPLoaderModule,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';

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
	// Determine which variant to load based on the requested extensions
	const variant = options.loadAllExtensions ? 'kitchen-sink' : 'light';

	const phpLoaderModule = await getPHPLoaderModule(phpVersion, variant);
	options.onPhpLoaderModuleLoaded?.(phpLoaderModule);
	return await loadPHPRuntime(phpLoaderModule, {
		...(options.emscriptenOptions || {}),
		...fakeWebsocket(),
	});
}
