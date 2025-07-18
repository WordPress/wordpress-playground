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
	const fileName = 'imagick.so';
	const filePath = await getImagickExtensionModule(version);
	const extension = fs.readFileSync(filePath);

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
					`/internal/shared/extensions/${fileName}`
				)
			) {
				phpRuntime.FS.writeFile(
					`/internal/shared/extensions/${fileName}`,
					new Uint8Array(extension)
				);
			}
			/* The extension has its share of ini entries
			 * to write in a separate ini file
			 */
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions/imagick.ini'
				)
			) {
				phpRuntime.FS.writeFile(
					'/internal/shared/extensions/imagick.ini',
					[`extension=/internal/shared/extensions/${fileName}`].join(
						'\n'
					)
				);
			}
			/* The extension needs to mount the current
			 * working directory in order to sync with
			 * the debugger.
			 * This is currently the base step but
			 * we may mount any path – cwd or not cwd.
			 * We may also mount multiple paths in different locations,
			 * or we may not mount any paths at all and just write a
			 * bunch of PHP files into /wordpress, e.g.
			 * when executing a Blueprint.
			 */
			phpRuntime.FS.mkdirTree(process.cwd());
			phpRuntime.FS.mount(
				phpRuntime.FS.filesystems['NODEFS'],
				{ root: process.cwd() },
				process.cwd()
			);
			phpRuntime.FS.chdir(process.cwd());
		},
	};
}
