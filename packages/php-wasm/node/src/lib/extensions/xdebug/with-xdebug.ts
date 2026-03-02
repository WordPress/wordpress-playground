import { DEFAULT_IDE_KEY } from '@php-wasm/cli-util';
import {
	type EmscriptenOptions,
	type PHPRuntime,
	type SupportedPHPVersion,
	FSHelpers,
	LatestSupportedPHPVersion,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import fs from 'fs';
import { getXdebugExtensionModule } from './get-xdebug-extension-module';

export interface PathMapping {
	hostPath: string;
	vfsPath: string;
}

export interface XdebugOptions {
	ideKey?: string;
	pathMappings?: PathMapping[];
	pathSkippings?: string[];
}

export async function withXdebug(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions,
	xdebugOptions: XdebugOptions
): Promise<EmscriptenOptions> {
	const fileName = 'xdebug.so';
	const filePath = await getXdebugExtensionModule(version);
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
					`/internal/shared/extensions/${fileName}`
				)
			) {
				phpRuntime.FS.writeFile(
					`/internal/shared/extensions/${fileName}`,
					new Uint8Array(extension)
				);
			}
			/*
			 * The extension has its share of ini entries
			 * to write in a separate ini file
			 */
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions/xdebug.ini'
				)
			) {
				const ideKey = xdebugOptions.ideKey || DEFAULT_IDE_KEY;
				phpRuntime.FS.writeFile(
					'/internal/shared/extensions/xdebug.ini',
					[
						'zend_extension=/internal/shared/extensions/xdebug.so',
						'xdebug.mode=debug,develop',
						'xdebug.start_with_request=yes',
						`xdebug.idekey="${ideKey}"`,
						// Path mapping is only available starting
						// from Xdebug 3.5, which is used by PHP 8.5+
						// Previous versions will ignore this entry.
						'xdebug.path_mapping=yes',
					].join('\n')
				);
			}
			/*
			 * Path mapping and skipping is only
			 * available starting from Xdebug 3.5,
			 * which is used by PHP 8.5 or higher.
			 */
			const isPHP85orHigher =
				SupportedPHPVersionsList.indexOf(version) <=
				SupportedPHPVersions.indexOf('8.5');

			if (isPHP85orHigher) {
				const { pathMappings, pathSkippings } = xdebugOptions;

				if (!pathMappings && !pathSkippings) return;

				phpRuntime.FS.mkdir('/.xdebug');
				// Path mapping
				if (pathMappings) {
					phpRuntime.FS.writeFile(
						'/.xdebug/path.map',
						pathMappings
							.map((map) => `${map.vfsPath} = ${map.hostPath}`)
							.join('\n')
					);
				}
				// Path skipping
				if (pathSkippings) {
					phpRuntime.FS.writeFile(
						'/.xdebug/skip.map',
						pathSkippings.map((path) => `${path} = SKIP`).join('\n')
					);
				}
			}
		},
	};
}
