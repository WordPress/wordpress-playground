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

	const importedWpContentPath = joinPaths(importPath, 'wp-content');
	const wpContentPath = joinPaths(documentRoot, 'wp-content');
	for (const relativePath of wpContentFilesExcludedFromExport) {
		// Remove any paths that were supposed to be excluded from the export
		// but maybe weren't
		const excludedImportPath = joinPaths(
			importedWpContentPath,
			relativePath
		);
		if (await playground.fileExists(excludedImportPath)) {
			if (await playground.isDir(excludedImportPath)) {
				await playground.rmdir(excludedImportPath);
			} else {
				await playground.unlink(excludedImportPath);
			}
		}

		// Replace them with files sourced from the live wp-content directory
		const restoreFromPath = joinPaths(wpContentPath, relativePath);
		if (await playground.fileExists(restoreFromPath)) {
			await playground.mv(restoreFromPath, excludedImportPath);
		}
	}

	// Swap wp-content with the imported one
	await playground.rmdir(wpContentPath);
	await playground.mv(importedWpContentPath, wpContentPath);

	// Clean up any remaining files
	await playground.rmdir(importPath);

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
