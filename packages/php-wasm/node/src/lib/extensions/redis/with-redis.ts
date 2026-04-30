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
import { getRedisExtensionModule } from './get-redis-extension-module';

export async function withRedis(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const extensionPath = await getRedisExtensionModule(version);
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
				name: 'redis',
				soBytes,
			});
		},
	};
}
