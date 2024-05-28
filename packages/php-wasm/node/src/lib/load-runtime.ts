import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
} from '@php-wasm/universal';

import { getPHPLoaderModule } from '.';
import { withNetworking } from './networking/with-networking.js';

export interface PHPLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
}

/**
 * Does what load() does, but synchronously returns
 * an object with the PHP instance and a promise that
 * resolves when the PHP instance is ready.
 *
 * @see load
 */
export async function loadNodeRuntime(
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
