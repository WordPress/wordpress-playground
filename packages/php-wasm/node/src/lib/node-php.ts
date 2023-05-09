import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
	PHPRequestHandlerConfiguration,
	BasePHP,
	rethrowFileSystemError,
	__private__dont__use,
} from '@php-wasm/universal';

import { lstatSync, readdirSync } from 'node:fs';
import { getPHPLoaderModule } from '.';
import { withNetworking } from './networking/with-networking.js';

export interface PHPLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	requestHandler?: PHPRequestHandlerConfiguration;
}

export type MountSettings = {
	root: string;
};

const STRING = 'string';
const NUMBER = 'number';

export class NodePHP extends BasePHP {
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
		return await NodePHP.loadSync(phpVersion, {
			...options,
			emscriptenOptions: {
				...(options.emscriptenOptions || {}),
				/**
				 * Emscripten default behavior is to kill the process when
				 * the WASM program calls `exit()`. We want to throw an
				 * exception instead. 
				 */
				quit: function (code, error) {
					throw error;
				},
			},
		}).phpReady;
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
		const php = new NodePHP(undefined, options.requestHandler);

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

	/**
	 * Mounts a Node.js filesystem to a given path in the PHP filesystem.
	 *
	 * @param  localPath - The path of a real local directory you want to mount.
	 * @param  virtualFSPath - Where to mount it in the virtual filesystem.
	 * @see {@link https://emscripten.org/docs/api_reference/Filesystem-API.html#FS.mount}
	 */
	@rethrowFileSystemError('Could not mount a directory')
	mount(localPath: string | MountSettings, virtualFSPath: string) {
		this[__private__dont__use].FS.mount(
			this[__private__dont__use].FS.filesystems.NODEFS,
			typeof localPath === 'object' ? localPath : { root: localPath },
			virtualFSPath
		);
	}

	/**
	 * Starts a PHP CLI session with given arguments.
	 *
	 * Can only be used when PHP was compiled with the CLI SAPI.
	 * Cannot be used in conjunction with `run()`.
	 *
	 * @param  argv - The arguments to pass to the CLI.
	 * @returns The exit code of the CLI session.
	 */
	cli(argv: string[]): Promise<number> {
		for (const arg of argv) {
			this[__private__dont__use].ccall(
				'wasm_add_cli_arg',
				null,
				[STRING],
				[arg]
			);
		}
		return this[__private__dont__use].ccall('run_cli', null, [], [], {
			async: true,
		});
	}

	setSkipShebang(shouldSkip: boolean) {
		this[__private__dont__use].ccall(
			'wasm_set_skip_shebang',
			null,
			[NUMBER],
			[shouldSkip ? 1 : 0]
		);
	}
}
