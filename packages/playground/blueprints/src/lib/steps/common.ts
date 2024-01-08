import type { UniversalPHP } from '@php-wasm/universal';

/**
 * Used by the export step to exclude the Playground-specific files
 * from the zip file. Keep it in sync with the list of files created
 * by WordPressPatcher.
 */
export const wpContentFilesExcludedFromExport = [
	'db.php',
	'plugins/akismet',
	'plugins/hello.php',
	'plugins/wordpress-importer',
	'plugins/sqlite-database-integration',
	'mu-plugins/playground-includes',
	'mu-plugins/export-wxz.php',
	'mu-plugins/0-playground.php',

	/*
	 * Listing core themes like that here isn't ideal, especially since
	 * developers may actually want to use one of them.
	 * @TODO Let's give the user a choice whether or not to include them.
	 */
	'themes/twentytwenty',
	'themes/twentytwentyone',
	'themes/twentytwentytwo',
	'themes/twentytwentythree',
	'themes/twentytwentyfour',
	'themes/twentytwentyfive',
	'themes/twentytwentysix',
];

// @ts-ignore
import zipFunctions from './zip-functions.php?raw';

export function zipNameToHumanName(zipName: string) {
	const mixedCaseName = zipName.split('.').shift()!.replace(/-/g, ' ');
	return (
		mixedCaseName.charAt(0).toUpperCase() +
		mixedCaseName.slice(1).toLowerCase()
	);
}

type PatchFileCallback = (
	contents: string
) => string | Uint8Array | Promise<string | Uint8Array>;
export async function updateFile(
	php: UniversalPHP,
	path: string,
	callback: PatchFileCallback
) {
	let contents = '';
	if (await php.fileExists(path)) {
		contents = await php.readFileAsText(path);
	}
	await php.writeFile(path, await callback(contents));
}

export async function fileToUint8Array(file: File) {
	return new Uint8Array(await file.arrayBuffer());
}

export async function runPhpWithZipFunctions(
	playground: UniversalPHP,
	code: string
) {
	const result = await playground.run({
		code: zipFunctions + code,
	});
	if (result.exitCode !== 0) {
		console.log(zipFunctions + code);
		console.log(code + '');
		console.log(result.errors);
		throw result.errors;
	}
	return result;
}
