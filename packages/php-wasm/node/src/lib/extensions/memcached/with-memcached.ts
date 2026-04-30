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
import { getMemcachedExtensionModule } from './get-memcached-extension-module';

export async function withMemcached(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const extensionPath = await getMemcachedExtensionModule(version);
	const soBytes = new Uint8Array(fs.readFileSync(extensionPath));

	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: PHP_EXTENSIONS_DIR,
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			installPHPExtensionFilesSync(phpRuntime.FS, {
				name: 'memcached',
				soBytes,
			});
		},
	};
}
