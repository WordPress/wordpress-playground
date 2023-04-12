import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
	PHPRequestHandlerConfiguration,
	BasePHP,
} from '@php-wasm/common';

import { lstatSync, readdirSync } from 'node:fs';
import { getPHPLoaderModule } from './';
import { withNetworking } from './networking/with-networking.js';

export interface PHPLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	requestHandler?: PHPRequestHandlerConfiguration;
}

export class PHP extends BasePHP {
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
		options: PHPLoaderOptions = {}
	) {
		return await PHP.loadSync(phpVersion, options).phpReady;
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
		options: PHPLoaderOptions = {}
	) {
		/**
		 * Keep any changes to the signature of this method in sync with the
		 * `PHP.load` method in the @php-wasm/node package.
		 */
		const php = new PHP(undefined, options.requestHandler);

		const doLoad = async () => {
			const phpLoaderModule = await getPHPLoaderModule(phpVersion);

			let emscriptenOptions = options.emscriptenOptions || {};
			emscriptenOptions = await withNetworking(emscriptenOptions);

			const runtimeId = await loadPHPRuntime(
				phpLoaderModule,
				emscriptenOptions
			);
			php.initializeRuntime(runtimeId);
		};
		const asyncData = doLoad();

		return {
			php,
			phpReady: asyncData.then(() => php),
		};
	}

	/**
	 * Enables host filesystem usage by mounting root
	 * directories (e.g. /, /home, /var) into the in-memory
	 * virtual filesystem used by this PHP instance, and
	 * setting the current working directory to one used by
	 * the current node.js process.
	 */
	useHostFilesystem() {
		const dirs = readdirSync('/')
			.map((file) => `/${file}`)
			.filter((file) => lstatSync(file).isDirectory());
		for (const dir of dirs) {
			if (!this.fileExists(dir)) {
				this.mkdirTree(dir);
			}
			this.mount({ root: dir }, dir);
		}
		this.chdir(process.cwd());
	}
}
