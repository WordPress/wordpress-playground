import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
	PHPRuntime,
	FSHelpers,
} from '@php-wasm/universal';

import { getPHPLoaderModule } from '.';
import { withNetworking } from './networking/with-networking.js';

import fs from 'fs';

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
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			/*
			 * An ICU data file must be loaded to support Intl extension.
			 * To achieve this, a shared directory is mounted and referenced
			 * via the ICU_DATA environment variable.
			 * By default, this variable is set to '/internal/shared',
			 * which corresponds to the actual file location.
			 */
			const icuFileName = 'icudt74l.dat';
			const icuFilePath = `${__dirname}/shared/${icuFileName}`;
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					`${phpRuntime.ENV.ICU_DATA}/${icuFileName}`
				) &&
				fs.existsSync(icuFilePath)
			) {
				phpRuntime.FS.mkdirTree(phpRuntime.ENV.ICU_DATA);
				phpRuntime.FS.writeFile(
					`${phpRuntime.ENV.ICU_DATA}/${icuFileName}`,
					new Uint8Array(fs.readFileSync(icuFilePath))
				);
			}
		},
	};

	const id = await loadPHPRuntime(
		await getPHPLoaderModule(phpVersion),
		await withNetworking(emscriptenOptions)
	);

	return id;
}
