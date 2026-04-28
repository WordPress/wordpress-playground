import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	LatestSupportedPHPVersion,
	installPHPExtensionFilesSync,
	PHP_EXTENSIONS_DIR,
	withPHPExtensionScanDir,
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
	const optionsWithScanDir = withPHPExtensionScanDir(options);

	return {
		...optionsWithScanDir,
		ENV: {
			...optionsWithScanDir.ENV,
			ICU_DATA: icuDataDir,
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			installPHPExtensionFilesSync(phpRuntime.FS, {
				name: 'intl',
				soBytes,
				extensionDir: PHP_EXTENSIONS_DIR,
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
