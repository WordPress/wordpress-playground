import { joinPaths } from '@php-wasm/util';
import type { Emscripten } from './emscripten-types';
import { FSHelpers } from './fs-helpers';
import { PHP_INI_PATH } from './php';
import type { UniversalPHP } from './universal-php';

/**
 * Directory scanned by PHP for additional .ini files. Runtimes that
 * load extensions via this module must set `PHP_INI_SCAN_DIR` to this
 * path in their Emscripten ENV (the node `with*` wrappers do).
 */
export const PHP_EXTENSIONS_DIR = '/internal/shared/extensions';

export interface LoadPHPExtensionOptions {
	/**
	 * A short identifier used as the file name on disk, e.g. `wp_mysql_parser`.
	 * The `.so` and `.ini` files are written as `<name>.so` / `<name>.ini`.
	 */
	name: string;
	/**
	 * The compiled side-module bytes. Caller is responsible for fetching them
	 * (from a URL, npm package, mounted directory, …) before calling this.
	 */
	soBytes: Uint8Array;
	/**
	 * Whether this is a Zend extension (e.g. opcache, xdebug) or a regular
	 * PHP extension. Defaults to `extension` which matches almost every
	 * userland module.
	 */
	kind?: 'extension' | 'zend_extension';
	/**
	 * Extra ini directives scoped to this extension, written into the same
	 * `<name>.ini` file. Use this for things like `xdebug.mode=debug`.
	 */
	iniEntries?: Record<string, string>;
	/**
	 * Companion files to drop into the runtime alongside the `.so`. Used by
	 * extensions that need data shipped next to the binary — e.g. intl
	 * needs `icu.dat`, MaxMind GeoIP needs `.mmdb` files.
	 */
	extraFiles?: Array<{ path: string; data: Uint8Array }>;
}

interface BuiltExtensionFiles {
	soPath: string;
	iniPath: string;
	iniContent: string;
}

/**
 * Pure: returns the canonical paths and ini content for an extension,
 * without writing anything. Shared by the async (`loadPHPExtension`) and
 * sync (`installPHPExtensionFilesSync`) paths so both stay in lockstep.
 */
function buildExtensionFiles(
	options: LoadPHPExtensionOptions
): BuiltExtensionFiles {
	const { name, kind = 'extension', iniEntries = {} } = options;
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`loadPHPExtension: invalid extension name ${JSON.stringify(
				name
			)}. Use only [a-zA-Z0-9_-].`
		);
	}
	const soPath = joinPaths(PHP_EXTENSIONS_DIR, `${name}.so`);
	const iniPath = joinPaths(PHP_EXTENSIONS_DIR, `${name}.ini`);
	const iniLines = [`${kind}=${soPath}`];
	for (const [key, value] of Object.entries(iniEntries)) {
		iniLines.push(`${key}=${value}`);
	}
	return { soPath, iniPath, iniContent: iniLines.join('\n') };
}

/**
 * Loads a pre-built PHP extension into a running PHP runtime exposed
 * through the `UniversalPHP` interface (typically called from a blueprint
 * step). The extension takes effect on the next runtime startup — PHP
 * only reads `extension=` during MINIT, so we cannot dlopen into a
 * live interpreter from JS.
 *
 * The runtime must have `PHP_INI_SCAN_DIR=/internal/shared/extensions`
 * set. As a belt-and-braces measure for runtimes that don't, we also
 * append the `extension=` directive to php.ini directly.
 */
export async function loadPHPExtension(
	php: UniversalPHP,
	options: LoadPHPExtensionOptions
): Promise<void> {
	const { soBytes, extraFiles = [] } = options;
	const { soPath, iniPath, iniContent } = buildExtensionFiles(options);

	if (!(await php.isDir(PHP_EXTENSIONS_DIR))) {
		await php.mkdir(PHP_EXTENSIONS_DIR);
	}

	await php.writeFile(soPath, soBytes);
	await php.writeFile(iniPath, iniContent);

	for (const file of extraFiles) {
		await php.writeFile(file.path, file.data);
	}

	const directive = iniContent.split('\n', 1)[0];
	const phpIni = await php.readFileAsText(PHP_INI_PATH);
	if (!phpIni.includes(directive)) {
		await php.writeFile(
			PHP_INI_PATH,
			phpIni.replace(/\n*$/, '\n') + directive + '\n'
		);
	}
}

/**
 * Synchronous, raw-FS variant of `loadPHPExtension`. Intended for use
 * inside Emscripten's `onRuntimeInitialized` callback, where only the
 * raw `PHPRuntime.FS` is available and the universal PHP class hasn't
 * been constructed yet.
 *
 * Skips the php.ini append because php.ini is written *later* by the
 * `PHP` constructor; callers using this path must set
 * `PHP_INI_SCAN_DIR=/internal/shared/extensions` in Emscripten ENV.
 */
export function installPHPExtensionFilesSync(
	fs: Emscripten.RootFS,
	options: LoadPHPExtensionOptions
): void {
	const { soBytes, extraFiles = [] } = options;
	const { soPath, iniPath, iniContent } = buildExtensionFiles(options);

	if (!FSHelpers.fileExists(fs, PHP_EXTENSIONS_DIR)) {
		fs.mkdirTree(PHP_EXTENSIONS_DIR);
	}
	if (!FSHelpers.fileExists(fs, soPath)) {
		fs.writeFile(soPath, soBytes);
	}
	if (!FSHelpers.fileExists(fs, iniPath)) {
		fs.writeFile(iniPath, iniContent);
	}
	for (const file of extraFiles) {
		if (FSHelpers.fileExists(fs, file.path)) {
			continue;
		}
		const dir = file.path.substring(0, file.path.lastIndexOf('/'));
		if (dir && !FSHelpers.fileExists(fs, dir)) {
			fs.mkdirTree(dir);
		}
		fs.writeFile(file.path, file.data);
	}
}
