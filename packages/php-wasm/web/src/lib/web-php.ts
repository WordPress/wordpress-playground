import {
	BasePHP,
	DataModule,
	EmscriptenOptions,
	loadPHPRuntime,
	PHPRequestHandlerConfiguration,
	SupportedPHPVersion,
	SupportedPHPExtension,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { getPHPLoaderModule } from './get-php-loader-module';

export interface PHPWebLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	downloadMonitor?: EmscriptenDownloadMonitor;
	requestHandler?: PHPRequestHandlerConfiguration;
	dataModules?: Array<DataModule | Promise<DataModule>>;
	extensions?: SupportedPHPExtension[];
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
		return await WebPHP.loadSync(phpVersion, options).phpReady;
	}

	/**
	 * Does what load() does, but synchronously returns
	 * an object with the PHP instance and a promise that
	 * resolves when the PHP instance is ready.
	 *
	 * @see load
	 */
	static loadSync(
		phpVersion: SupportedPHPVersion,
		options: PHPWebLoaderOptions = {}
	) {
		/**
		 * Keep any changes to the signature of this method in sync with the
		 * `PHP.load` method in the @php-wasm/node package.
		 */
		const php = new WebPHP(undefined, options.requestHandler);

		// Determine which variant to load based on the requested extensions
		const variant = options.extensions?.length ? 'regular' : 'light';

		const doLoad = async () => {
			const allModules = await Promise.all([
				getPHPLoaderModule(phpVersion, variant),
				...(options.dataModules || []),
			]);
			const [phpLoaderModule, ...dataModules] = allModules;
			options.downloadMonitor?.setModules(allModules);

			const runtimeId = await loadPHPRuntime(
				phpLoaderModule,
				{
					...(options.emscriptenOptions || {}),
					...(options.downloadMonitor?.getEmscriptenOptions() || {}),
					...fakeWebsocket(),
				},
				dataModules
			);
			php.initializeRuntime(runtimeId);
		};
		const asyncData = doLoad();

		return {
			php,
			phpReady: asyncData.then(() => php),
		};
	}
}
