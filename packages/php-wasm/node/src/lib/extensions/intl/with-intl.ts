import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion, FSHelpers } from '@php-wasm/universal';
import fs from 'fs';
import path from 'path';
import { getIntlExtensionModule } from './get-intl-extension-module';

export async function withIntl(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const extensionName = 'intl.so';
	const extensionPath = await getIntlExtensionModule(version);

	const dataName = 'icu.dat';
	const moduleDir =
		typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
	const dataPath = path.join(moduleDir, 'shared', dataName);

	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: '/internal/shared/extensions',
			ICU_DATA: '/internal/shared',
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions'
				)
			) {
				phpRuntime.FS.mkdirTree('/internal/shared/extensions');
			}
			/*
			 * Only read the extension binary from disk if it hasn't
			 * already been written to the shared VFS by another worker.
			 */
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					`/internal/shared/extensions/${extensionName}`
				)
			) {
				phpRuntime.FS.writeFile(
					`/internal/shared/extensions/${extensionName}`,
					new Uint8Array(fs.readFileSync(extensionPath))
				);
			}
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions/intl.ini'
				)
			) {
				phpRuntime.FS.writeFile(
					'/internal/shared/extensions/intl.ini',
					[
						`extension=/internal/shared/extensions/${extensionName}`,
					].join('\n')
				);
			}
			/*
			 * An ICU data file must be loaded to support Intl extension.
			 * The Intl extension is hard-coded to look for the `icudt74l`
			 * filename, which means the ICU data file must use that exact
			 * name. Only read the 30MB file from disk when it hasn't
			 * already been placed in the shared VFS by another worker.
			 */
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					`${phpRuntime.ENV.ICU_DATA}/${dataName}`
				)
			) {
				phpRuntime.FS.mkdirTree(phpRuntime.ENV.ICU_DATA);
				phpRuntime.FS.writeFile(
					`${phpRuntime.ENV.ICU_DATA}/icudt74l.dat`,
					new Uint8Array(fs.readFileSync(dataPath))
				);
			}
		},
	};
}
