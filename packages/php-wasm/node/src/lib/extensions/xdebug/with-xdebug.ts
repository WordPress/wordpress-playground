import { DEFAULT_IDE_KEY } from '@php-wasm/cli-util';
import {
	type EmscriptenOptions,
	type PHPRuntime,
	type SupportedPHPVersion,
	installPHPExtensionFilesSync,
	LatestSupportedPHPVersion,
	PHP_EXTENSIONS_DIR,
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

/**
 * Adds Xdebug to Emscripten options before PHP starts.
 *
 * @deprecated Prefer `loadNodeRuntime(version, { extensions: [{ name:
 * 'xdebug', options }] })`. The runtime `extensions` array is the shared path
 * for bundled and external PHP extensions, and it keeps extension setup in one
 * place.
 */
export async function withXdebug(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions,
	xdebugOptions: XdebugOptions
): Promise<EmscriptenOptions> {
	const filePath = await getXdebugExtensionModule(version);
	const soBytes = new Uint8Array(fs.readFileSync(filePath));

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
			const ideKey = xdebugOptions.ideKey || DEFAULT_IDE_KEY;
			installPHPExtensionFilesSync(phpRuntime.FS, {
				name: 'xdebug',
				soBytes,
				loadWithIniDirective: 'zend_extension',
				iniEntries: {
					'xdebug.mode': 'debug,develop',
					'xdebug.start_with_request': 'yes',
					'xdebug.idekey': `"${ideKey}"`,
					// Path mapping is only available starting from Xdebug 3.5,
					// which is used by PHP 8.5+. Previous versions ignore it.
					'xdebug.path_mapping': 'yes',
				},
			});
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
