import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	LatestSupportedPHPVersion,
	installPHPExtensionFilesSync,
	PHP_EXTENSIONS_DIR,
} from '@php-wasm/universal';
import fs from 'fs';
import path from 'path';
import { getIntlExtensionModule } from './get-intl-extension-module';

export async function withIntl(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const extensionPath = await getIntlExtensionModule(version);
	const soBytes = new Uint8Array(fs.readFileSync(extensionPath));

	const moduleDir =
		typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
	const icuDataBytes = new Uint8Array(
		fs.readFileSync(path.join(moduleDir, 'shared', 'icu.dat'))
	);
	const icuDataDir = '/internal/shared';

	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: PHP_EXTENSIONS_DIR,
			ICU_DATA: icuDataDir,
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}

			installPHPExtensionFilesSync(phpRuntime.FS, {
				name: 'intl',
				soBytes,
				/*
				 * The Intl extension is hard-coded to look for the `icudt74l`
				 * filename, so we drop the data file under that exact name
				 * inside ICU_DATA.
				 */
				extraFiles: [
					{
						path: `${icuDataDir}/icudt74l.dat`,
						data: icuDataBytes,
					},
				],
			});
		},
	};
}
