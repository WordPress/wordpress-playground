import { UniversalPHP, writeFiles } from '@php-wasm/universal';
// @ts-ignore
import playgroundLibrary from './playground-library.php?raw';

interface UnzipOptions {
	except?: string[];
}

/**
 * Unzip a zip file.
 *
 * @param php Playground client.
 * @param zipPath The zip file to unzip.
 * @param extractTo The directory to extract the zip file to.
 */
export async function unzip(
	php: UniversalPHP,
	zipFile: File,
	extractToPath: string,
	options: UnzipOptions = {}
) {
	return await withPlaygroundLibrary(
		php,
		`<?php unzip($zipFile, $extractToPath, $options);`,
		{
			zipFile,
			extractToPath,
			options,
		}
	);
}

export async function withPlaygroundLibrary(
	php: UniversalPHP,
	code: string,
	inputs: Record<string, any> = {}
) {
	const vars: Record<string, any> = {};
	const files: Record<string, File> = {};
	for (const [key, value] of Object.entries(inputs)) {
		if (value instanceof File) {
			files[key] = value;
		} else {
			vars[key] = value;
		}
	}

	const tmpRoot = `/tmp/${randomFilename(8)}`;
	const tmpPaths = await writeFiles(php, tmpRoot, files);

	try {
		await php.writeFile(`/tmp/playground-library.php`, playgroundLibrary);
		return await php.run({
			throwOnError: true,
			code: `<?php
                require "/tmp/playground-library.php";
            ?>${code}`,
			variables: { ...vars, ...tmpPaths },
		});
	} finally {
		await php.rmdir(tmpRoot);
	}
}

/**
 * @TODO: Rebase this PH and import this from @php-wasm/utils
 */
export function randomFilename(length: number) {
	const chars =
		'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let result = '';
	for (let i = length; i > 0; --i)
		result += chars[Math.floor(Math.random() * chars.length)];
	return result;
}
