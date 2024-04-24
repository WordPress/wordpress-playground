import {
	BasePHP,
	EmscriptenOptions,
	loadPHPRuntime,
	PHPLoaderModule,
	PHPRequestHandlerConfiguration,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';

export interface PHPWebLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	requestHandler?: PHPRequestHandlerConfiguration;
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

export class WebPHP extends BasePHP {
	/**
	 * Creates a new PHP instance.
	 *
	 * Dynamically imports the PHP module, initializes the runtime,
	 * and sets up networking. It's a shorthand for the lower-level
	 * functions like `getPHPLoaderModule`, `loadPHPRuntime`, and
	 * `PHP.initializeRuntime`
	 *
	 * @param phpVersion The PHP Version to load
	 * @param options The options to use when loading PHP
	 * @returns A new PHP instance
	 */
	static async load(
		phpVersion: SupportedPHPVersion,
		options: PHPWebLoaderOptions = {}
	) {
		return new WebPHP(
			await WebPHP.loadRuntime(phpVersion, options),
			options.requestHandler
		);
	}

	static async loadRuntime(
		phpVersion: SupportedPHPVersion,
		options: PHPWebLoaderOptions = {}
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
}
