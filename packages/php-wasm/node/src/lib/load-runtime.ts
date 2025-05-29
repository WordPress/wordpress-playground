import type {
	SupportedPHPVersion,
	EmscriptenOptions,
	RemoteAPI,
} from '@php-wasm/universal';
import { loadPHPRuntime } from '@php-wasm/universal';

import { getPHPLoaderModule } from '.';
import { withNetworking } from './networking/with-networking';
import type { FileLockManager } from './file-lock-manager';

export interface PHPLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
}

type PHPLoaderOptionsForNode = PHPLoaderOptions & {
	emscriptenOptions?: EmscriptenOptions & {
		// Used to divide runtime IDs into unique ranges per worker.
		// TODO: Consider also passing upper bound of ID range
		// TODO: Consider implementing getpid() to return this number.
		// TODO: Explain why
		processId?: number;

		// TODO: Document this
		fileLockManager?: RemoteAPI<FileLockManager>;
	};
};

/**
 * Does what load() does, but synchronously returns
 * an object with the PHP instance and a promise that
 * resolves when the PHP instance is ready.
 *
 * @see load
 */
export async function loadNodeRuntime(
	phpVersion: SupportedPHPVersion,
	options: PHPLoaderOptionsForNode = {}
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
