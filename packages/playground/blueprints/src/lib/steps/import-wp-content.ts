import { StepHandler } from '.';
import { unzip } from './unzip';
import { joinPaths, phpVar } from '@php-wasm/util';
import { wpContentFilesExcludedFromExport } from './common';

/**
 * @inheritDoc importWpContent
 * @example
 *
 * <code>
 * {
 * 		"step": "importWpContentStep",
 * 		"wpContentZip": {
 *         "resource": "fetch",
 *         "url": "https://mysite.com/import.zip"
 *      }
 * }
 * </code>
 */
export interface ImportWpContentStep<ResourceType> {
	step: 'importWpContent';
	/** The zip file containing the wp-content directory */
	wpContentZip: ResourceType;
}

/**
 * Replace the current wp-content directory with one from the provided zip file.
 *
 * @param playground Playground client.
 * @param wpContentZip Zipped WordPress site.
 */
export const importWpContent: StepHandler<ImportWpContentStep<File>> = async (
	playground,
	{ wpContentZip }
) => {
	const zipPath = '/import.zip';
	await playground.writeFile(
		zipPath,
		new Uint8Array(await wpContentZip.arrayBuffer())
	);

	const documentRoot = await playground.documentRoot;

	// Unzip
	const importPath = joinPaths('/tmp', 'import');
	await playground.mkdir(importPath);
	await unzip(playground, { zipPath, extractToPath: importPath });
	await playground.unlink(zipPath);

	// Swap wp-content with the imported one
	const wpContentSwapPath = joinPaths('/tmp', 'swap');
	const wpContentPath = joinPaths(documentRoot, 'wp-content');
	await playground.mv(wpContentPath, wpContentSwapPath);
	await playground.mv(importPath, wpContentPath);
	await playground.mkdir(joinPaths(wpContentPath, 'mu-plugins'));

	// Restore the required php files from the swap
	for (const relativePath of wpContentFilesExcludedFromExport) {
		await playground.mv(
			joinPaths(wpContentSwapPath, relativePath),
			joinPaths(wpContentPath, relativePath)
		);
	}
	await playground.rmdir(wpContentSwapPath);

	// Upgrade the database
	const upgradePhp = phpVar(
		joinPaths(documentRoot, 'wp-admin', 'upgrade.php')
	);
	await playground.run({
		code: `<?php
            $_GET['step'] = 'upgrade_db';
            require ${upgradePhp};
            `,
	});
};
