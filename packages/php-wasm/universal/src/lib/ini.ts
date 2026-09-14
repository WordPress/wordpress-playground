import { dirname } from '@php-wasm/util';
import { PHP_INI_PATH } from './php';
import type { UniversalPHP } from './universal-php';
import { stringify, parse } from 'ini';

/**
 * Reads an ini file and returns its entries.
 *
 * @param php The PHP instance.
 * @param entries Optional. If provided, only the specified entries will be returned.
 * @param path The ini file to read. Defaults to the php.ini file.
 * @returns The ini file entries.
 */
export async function getPhpIniEntries(
	php: UniversalPHP,
	entries?: string[],
	path = PHP_INI_PATH
) {
	const ini = parse(await php.readFileAsText(path));
	if (entries === undefined) {
		return ini;
	}
	const result: Record<string, unknown> = {};
	for (const key of entries) {
		result[key] = ini[key];
	}
	return result;
}

/**
 * Rewrites an ini file with the given entries.
 *
 * PHP reads `php.ini` first, then every `.ini` file in `PHP_INI_SCAN_DIR`,
 * and the last value read wins. Pass `path` to write to one of those files,
 * such as the `.ini` file an extension ships. Entries already in the file are
 * kept. The file and its directory are created when they do not exist yet.
 *
 * @param php The PHP instance.
 * @param entries The entries to write to the ini file.
 * @param path The ini file to rewrite. Defaults to the php.ini file.
 */
export async function setPhpIniEntries(
	php: UniversalPHP,
	entries: Record<string, unknown>,
	path = PHP_INI_PATH
) {
	const exists = await php.fileExists(path);
	const ini = parse(exists ? await php.readFileAsText(path) : '');
	for (const [key, value] of Object.entries(entries)) {
		if (value === undefined || value === null) {
			delete ini[key];
		} else {
			ini[key] = value;
		}
	}
	if (!exists) {
		await php.mkdirTree(dirname(path));
	}
	await php.writeFile(path, stringify(ini));
}

/**
 * Sets php.ini values to the given values, executes a callback,
 * and restores the original php.ini values. This is useful for
 * running code with temporary php.ini values, such as when
 * disabling network-related PHP functions just to run WordPress
 * installer.
 *
 * @example
 * ```ts
 *	await withPHPIniValues(
 *		php,
 *		{
 *			disable_functions: 'fsockopen',
 *			allow_url_fopen: '0',
 *		},
 *		async () => await runWpInstallationWizard(php, {
 *			options: {},
 *		})
 *	);
 *	```
 *
 * @param php The PHP instance.
 * @param phpIniValues The php.ini values to set.
 * @param callback The callback to execute.
 * @returns The result of the callback.
 */
export async function withPHPIniValues(
	php: UniversalPHP,
	phpIniValues: Record<string, string>,
	callback: () => Promise<any>
) {
	const iniBefore = await php.readFileAsText(PHP_INI_PATH);
	try {
		await setPhpIniEntries(php, phpIniValues);
		return await callback();
	} finally {
		await php.writeFile(PHP_INI_PATH, iniBefore);
	}
}
