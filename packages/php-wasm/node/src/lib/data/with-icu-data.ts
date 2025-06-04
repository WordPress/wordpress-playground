import type { EmscriptenOptions, PHPRuntime } from '@php-wasm/universal';
import { FSHelpers } from '@php-wasm/universal';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { basename } from 'path';

export async function withICUData(
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const icuDataUrl = new URL('./shared/icudt74l.dat', import.meta.url);
	const filePath = fileURLToPath(icuDataUrl);
	const fileName = basename(filePath);
	const ICUData = fs.readFileSync(filePath);

	return {
		ENV: {
			...options.ENV,
			ICU_DATA: '/internal/shared',
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			/*
			 * An ICU data file must be loaded to support Intl extension.
			 * To achieve this, a shared directory is mounted and referenced
			 * via the ICU_DATA environment variable.
			 * By default, this variable is set to '/internal/shared',
			 * which corresponds to the actual file location.
			 */
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					`${phpRuntime.ENV.ICU_DATA}/${fileName}`
				)
			) {
				phpRuntime.FS.mkdirTree(phpRuntime.ENV.ICU_DATA);
				phpRuntime.FS.writeFile(
					`${phpRuntime.ENV.ICU_DATA}/${fileName}`,
					new Uint8Array(ICUData)
				);
			}
		},
	};
}
