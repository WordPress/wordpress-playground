import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion, FSHelpers } from '@php-wasm/universal';
import fs from 'fs';
import { getImagickExtensionModule } from './get-imagick-extension-module';

export async function withImagick(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const extensionName = 'imagick.so';
	let extension: Buffer | null = null;
	try {
		const extensionPath = await getImagickExtensionModule(version);
		extension = fs.readFileSync(extensionPath);
	} catch (e) {
		// Surface a clear error at callsite if requested but not available
		throw new Error(
			'Imagick extension requested but not found. Please build it via "nx run php-wasm-compile-shared:imagick:jspi".'
		);
	}

	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: '/internal/shared/extensions',
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			// Ensure the extensions directory exists
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions'
				)
			) {
				phpRuntime.FS.mkdirTree('/internal/shared/extensions');
			}
			// Write the extension binary
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					`/internal/shared/extensions/${extensionName}`
				)
			) {
				phpRuntime.FS.writeFile(
					`/internal/shared/extensions/${extensionName}`,
					new Uint8Array(extension!)
				);
			}
			// Provide a minimal ini to load imagick
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions/imagick.ini'
				)
			) {
				phpRuntime.FS.writeFile(
					'/internal/shared/extensions/imagick.ini',
					[
						`extension=/internal/shared/extensions/${extensionName}`,
					].join('\n')
				);
			}
		},
	};
}
