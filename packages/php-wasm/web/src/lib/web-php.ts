import {
	BasePHP,
	DataModule,
	EmscriptenOptions,
	loadPHPRuntime,
	PHPRequestHandlerConfiguration,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { getPHPLoaderModule } from './get-php-loader-module';
import * as tls from './tls-proxy';

export interface PHPWebLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	downloadMonitor?: EmscriptenDownloadMonitor;
	requestHandler?: PHPRequestHandlerConfiguration;
	dataModules?: Array<DataModule | Promise<DataModule>>;
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
						console.log('Called constructor()!');
						try {
							super();
						} catch (e) {
							// pass
						}
					}

					send() {
						console.log('Called send()!');
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
		options.downloadMonitor?.expectAssets({
			[phpLoaderModule.dependencyFilename]:
				phpLoaderModule.dependenciesTotalSize,
		});
		return await loadPHPRuntime(phpLoaderModule, {
			...(options.emscriptenOptions || {}),
			...tls.fetchingWebsocket(),
		});
	}
}
