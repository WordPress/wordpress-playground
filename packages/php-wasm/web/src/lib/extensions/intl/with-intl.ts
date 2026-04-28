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
				soBytes: new Uint8Array(extension),
				extensionDir: PHP_EXTENSIONS_DIR,
				extraFiles: [
					{
						path: `${icuDataDir}/icudt74l.dat`,
						data: new Uint8Array(ICUData),
					},
				],
			});
		},
	};
}
