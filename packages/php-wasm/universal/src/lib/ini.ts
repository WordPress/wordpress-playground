import { PHP_INI_PATH } from './base-php';
import { UniversalPHP } from './universal-php';
import { stringify, parse } from 'ini';

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

export async function setPhpIniEntries(
	php: UniversalPHP,
	entries: Record<string, unknown>
) {
	const ini = parse(await php.readFileAsText(PHP_INI_PATH));
	for (const [key, value] of Object.entries(entries)) {
		ini[key] = value;
	}
	await php.writeFile(PHP_INI_PATH, stringify(ini));
}

export async function withPHPIniValues(
	php: UniversalPHP,
	phpIniValues: Record<string, string>,
	callback: () => Promise<void>
) {
	const iniBefore = await php.readFileAsText(PHP_INI_PATH);
	try {
		await setPhpIniEntries(php, phpIniValues);
		await callback();
	} finally {
		await php.writeFile(PHP_INI_PATH, iniBefore);
	}
}
