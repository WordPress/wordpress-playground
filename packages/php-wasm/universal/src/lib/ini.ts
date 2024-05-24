import { PHP_INI_PATH } from './base-php';
import { UniversalPHP } from './universal-php';
import { stringify, parse } from 'ini';

/**
 * Reads the php.ini file and returns its entries.
 *
 * @param php The PHP instance.
 * @param entries Optional. If provided, only the specified entries will be returned.
 * @returns The php.ini entries.
 */
export async function getPhpIniEntries(php: UniversalPHP, entries?: string[]) {
	const ini = parse(await php.readFileAsText(PHP_INI_PATH));
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
 * Rewrites the php.ini file with the given entries.
 *
 * @param php The PHP instance.
 * @param entries The entries to write to the php.ini file.
 */
export async function setPhpIniEntries(
	php: UniversalPHP,
	entries: Record<string, unknown>
) {
	const ini = parse(await php.readFileAsText(PHP_INI_PATH));
	for (const [key, value] of Object.entries(entries)) {
		if (value === undefined || value === null) {
			delete ini[key];
		} else {
			ini[key] = value;
		}
	}
	await php.writeFile(PHP_INI_PATH, stringify(ini));
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
