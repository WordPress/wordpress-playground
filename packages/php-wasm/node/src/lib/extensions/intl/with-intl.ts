import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	installPHPExtensionFilesSync,
	LatestSupportedPHPVersion,
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

	const dataName = 'icu.dat';
	const moduleDir =
		typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
	const dataPath = path.join(moduleDir, 'shared', dataName);
	const ICUData = fs.readFileSync(dataPath);

	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: PHP_EXTENSIONS_DIR,
			ICU_DATA: '/internal/shared',
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			installPHPExtensionFilesSync(phpRuntime.FS, {
				name: 'intl',
				soBytes,
				loadTiming: 'before-php-startup',
				extraFiles: {
					targetPath: '/internal/shared',
					files: {
						// The Intl extension looks for the hard-coded ICU data name.
						'icudt74l.dat': new Uint8Array(ICUData),
					},
				},
			});
		},
	};
}
