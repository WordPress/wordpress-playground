import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion, FSHelpers } from '@php-wasm/universal';
import { getIntlExtensionModule } from './get-intl-extension-module';
import { createMemoizedFetch } from '@wp-playground/common';

export async function withIntl(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const memoizedFetch = createMemoizedFetch(fetch);

	const extensionName = 'intl.so';
	const dataName = 'icu.dat';

	const extensionPath = await getIntlExtensionModule(version);
	// @ts-ignore
	const dataPath = (await import('./shared/icu.dat')).default;

	const [extension, ICUData] = await Promise.all([
		memoizedFetch(extensionPath).then((response) => response.arrayBuffer()),
		memoizedFetch(dataPath).then((response) => response.arrayBuffer()),
	]);

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
			/**
			 * The extension file previously read
			 * is written inside the /extensions directory
			 */
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions'
				)
			) {
				phpRuntime.FS.mkdirTree('/internal/shared/extensions');
			}
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					`/internal/shared/extensions/${extensionName}`
				)
			) {
				phpRuntime.FS.writeFile(
					`/internal/shared/extensions/${extensionName}`,
					new Uint8Array(extension)
				);
			}
			/* The extension has its share of ini entries
			 * to write in a separate ini file
			 */
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
			 * To achieve this, a shared directory is mounted and referenced
			 * via the ICU_DATA environment variable.
			 * By default, this variable is set to '/internal/shared',
			 * which corresponds to the actual file location.
			 *
			 * The Intl extension is hard-coded to look for the `icudt74l` filename,
			 * which means the ICU data file must use that exact name.
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
					new Uint8Array(ICUData)
				);
			}
		},
	};
}
