import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion, FSHelpers } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import path from 'path';
import fs from 'fs';

export async function withXdebug(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	if (!(await jspi())) {
		throw new Error('Xdebug is currently only supported in JSPI mode.');
	}

	const fileName = 'xdebug.so';
	const directoryName = version.replace('.', '_');
	/**
	 * Hack: Keeping the path working in both
	 * the source file and the final bundle requires
	 * esbuild to rewrite the below path.
	 * `import.meta.dirname, ../../../` is auto replaced with
	 * `__dirname, './' in build.js since target directories are
	 * not identically located in built and unbuilt versions.
	 */
	const filePath = path.resolve(
		import.meta.dirname,
		`../../../jspi/extensions/xdebug/${directoryName}/${fileName}`
	);
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
			/* The extension file previously read
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
					'/internal/shared/extensions/xdebug.ini'
				)
			) {
				phpRuntime.FS.writeFile(
					'/internal/shared/extensions/xdebug.ini',
					[
						'zend_extension=/internal/shared/extensions/xdebug.so',
						'xdebug.mode=debug,develop',
						'xdebug.start_with_request=yes',
						'xdebug.start_upon_error=yes',
					].join('\n')
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
