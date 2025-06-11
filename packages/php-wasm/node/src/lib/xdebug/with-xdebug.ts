import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { fullyQualifiedPHPVersionDirectory } from './supported-php-versions';
import fs from 'fs';

export async function withXdebug(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const fileName = 'xdebug.so';
	const directoryName = fullyQualifiedPHPVersionDirectory(version);
	const filePath = `${__dirname}/jspi/${directoryName}/extensions/${fileName}`;
	const extension = fs.readFileSync(filePath);

	return {
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
			phpRuntime.FS.mkdirTree('/internal/shared/extensions');
			phpRuntime.FS.writeFile(
				`/internal/shared/extensions/${fileName}`,
				new Uint8Array(extension)
			);
			/* The extension has its share of ini entries
			 * to write in a separate ini file
			 */
			phpRuntime.FS.writeFile(
				'/internal/shared/extensions/xdebug.ini',
				[
					'zend_extension=/internal/shared/extensions/xdebug.so',
					'html_errors=Off',
					'xdebug.mode=debug',
					'xdebug.start_with_request=yes',
					'xdebug.log=/xdebug.log',
				].join('\n')
			);
			/* The extension needs to mount the current
			 * working directory in order to sync with
			 * the debugger
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
