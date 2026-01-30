import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion, FSHelpers } from '@php-wasm/universal';
import fs from 'fs';
import { getRedisExtensionModule } from './get-redis-extension-module';

export async function withRedis(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const extensionName = 'redis.so';
	const extensionPath = await getRedisExtensionModule(version);
	const extension = fs.readFileSync(extensionPath);

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
			/*
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
					'/internal/shared/extensions/redis.ini'
				)
			) {
				phpRuntime.FS.writeFile(
					'/internal/shared/extensions/redis.ini',
					[
						`extension=/internal/shared/extensions/${extensionName}`,
					].join('\n')
				);
			}
		},
	};
}
