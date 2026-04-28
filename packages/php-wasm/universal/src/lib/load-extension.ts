import { joinPaths } from '@php-wasm/util';
import type { UniversalPHP } from './universal-php';
import { PHP_INI_PATH } from './php';

/**
 * Directory scanned by PHP for additional .ini files. Matches the
 * convention already used by `withXdebug` / `withIntl` in the node
 * extension wrappers, so an extension dropped here is picked up by
 * any runtime that has `PHP_INI_SCAN_DIR` pointing at it.
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
	 * `<name>.ini` file. Use this for things like `wp_mysql_parser.debug=1`.
	 */
	iniEntries?: Record<string, string>;
}

/**
 * Loads a pre-built PHP extension into a running PHP runtime.
 *
 * The extension takes effect on the next runtime startup — typically the
 * next request, or after `rotatePHPRuntime()`. PHP only reads `extension=`
 * directives during module init, so we cannot dlopen into an already-booted
 * interpreter from JS.
 *
 * The runtime must have `PHP_INI_SCAN_DIR` pointing at `PHP_EXTENSIONS_DIR`.
 * The node extension wrappers (`withXdebug`, `withIntl`, …) already set this
 * env var; for fresh runtimes that don't, also append `extension=` lines to
 * php.ini so the extension still loads.
 *
 * @example
 * ```ts
 * const soBytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
 * await loadPHPExtension(php, { name: 'wp_mysql_parser', soBytes });
 * ```
 */
export async function loadPHPExtension(
	php: UniversalPHP,
	options: LoadPHPExtensionOptions
): Promise<void> {
	const { name, soBytes, kind = 'extension', iniEntries = {} } = options;

	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`loadPHPExtension: invalid extension name ${JSON.stringify(
				name
			)}. Use only [a-zA-Z0-9_-].`
		);
	}

	if (!(await php.isDir(PHP_EXTENSIONS_DIR))) {
		await php.mkdir(PHP_EXTENSIONS_DIR);
	}

	const soPath = joinPaths(PHP_EXTENSIONS_DIR, `${name}.so`);
	const iniPath = joinPaths(PHP_EXTENSIONS_DIR, `${name}.ini`);

	await php.writeFile(soPath, soBytes);

	const iniLines = [`${kind}=${soPath}`];
	for (const [key, value] of Object.entries(iniEntries)) {
		iniLines.push(`${key}=${value}`);
	}
	await php.writeFile(iniPath, iniLines.join('\n') + '\n');

	/*
	 * Belt-and-braces: also append the extension directive to the main
	 * php.ini. If `PHP_INI_SCAN_DIR` is set, this is redundant; if it
	 * isn't, this is what makes the extension actually load.
	 *
	 * We append rather than parse-and-rewrite to avoid the `ini` package
	 * mangling repeated keys (multiple `extension=` entries are valid).
	 */
	const phpIni = await php.readFileAsText(PHP_INI_PATH);
	const directive = `${kind}=${soPath}`;
	if (!phpIni.includes(directive)) {
		await php.writeFile(
			PHP_INI_PATH,
			phpIni.replace(/\n*$/, '\n') + directive + '\n'
		);
	}
}
