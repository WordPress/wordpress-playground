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
import { getIntlExtensionModule } from './get-intl-extension-module';
import { createMemoizedFetch } from '@wp-playground/common';

export async function withIntl(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const memoizedFetch = createMemoizedFetch(fetch);

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
			PHP_INI_SCAN_DIR: PHP_EXTENSIONS_DIR,
			ICU_DATA: '/internal/shared',
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			installPHPExtensionFilesSync(phpRuntime.FS, {
				name: 'intl',
				soBytes: new Uint8Array(extension),
				loadAt: 'before-php-startup',
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
