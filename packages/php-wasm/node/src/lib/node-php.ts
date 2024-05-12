import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
	BasePHP,
	rethrowFileSystemError,
	__private__dont__use,
	isExitCodeZero,
} from '@php-wasm/universal';

import { lstatSync, readdirSync } from 'node:fs';
import { getPHPLoaderModule } from '.';
import { withNetworking } from './networking/with-networking.js';

export interface PHPLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
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
		return new NodePHP(await NodePHP.loadRuntime(phpVersion, options));
	}

	/**
	 * Does what load() does, but synchronously returns
	 * an object with the PHP instance and a promise that
	 * resolves when the PHP instance is ready.
	 *
	 * @see load
	 */
	static async loadRuntime(
		phpVersion: SupportedPHPVersion,
		options: PHPLoaderOptions = {}
	) {
		const emscriptenOptions: EmscriptenOptions = {
			/**
			 * Emscripten default behavior is to kill the process when
			 * the WASM program calls `exit()`. We want to throw an
			 * exception instead.
			 */
			quit: function (code, error) {
				throw error;
			},
			...(options.emscriptenOptions || {}),
		};
		return await loadPHPRuntime(
			await getPHPLoaderModule(phpVersion),
			await withNetworking(emscriptenOptions)
		);
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
			/*
			 * Don't mount the dev directory – it's polyfilled by Emscripten.
			 */
			.filter((file) => file !== 'dev')
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
	@rethrowFileSystemError('Could not mount {path}')
	mount(localPath: string | MountSettings, virtualFSPath: string, fs: any) {
		const localRoot =
			typeof localPath === 'object' ? localPath.root : localPath;
		if (
			!this.fileExists(virtualFSPath) &&
			lstatSync(localRoot).isDirectory()
		) {
			this.mkdirTree(virtualFSPath);
		}
		this[__private__dont__use].FS.mount(
			fs || this[__private__dont__use].FS.filesystems.NODEFS,
			typeof localPath === 'object' ? localPath : { root: localPath },
			virtualFSPath
		);
	}

	/**
	 * Starts a PHP CLI session with given arguments.
	 *
	 * This method can only be used when PHP was compiled with the CLI SAPI
	 * and it cannot be used in conjunction with `run()`.
	 *
	 * Once this method finishes running, the PHP instance is no
	 * longer usable and should be discarded. This is because PHP
	 * internally cleans up all the resources and calls exit().
	 *
	 * @param  argv - The arguments to pass to the CLI.
	 * @returns The exit code of the CLI session.
	 */
	async cli(argv: string[]): Promise<number> {
		for (const arg of argv) {
			this[__private__dont__use].ccall(
				'wasm_add_cli_arg',
				null,
				[STRING],
				[arg]
			);
		}
		try {
			return await this[__private__dont__use].ccall(
				'run_cli',
				null,
				[],
				[],
				{
					async: true,
				}
			);
		} catch (error) {
			if (isExitCodeZero(error)) {
				return 0;
			}
			throw error;
		}
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
