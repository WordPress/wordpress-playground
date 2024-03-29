import { StepHandler } from '.';
import { unzip } from './unzip';
import { dirname, joinPaths, phpVar } from '@php-wasm/util';
import { UniversalPHP } from '@php-wasm/universal';
import { wpContentFilesExcludedFromExport } from '../utils/wp-content-files-excluded-from-exports';
import { defineSiteUrl } from './define-site-url';

/**
 * @inheritDoc importWordPressFiles
 * @example
 *
 * <code>
 * {
 * 		"step": "importWordPressFilesStep",
 * 		"wordPressFilesZip": {
 * 		"resource": "fetch",
 * 		"url": "https://mysite.com/import.zip"
 *      }
 * }
 * </code>
 */
export interface ImportWordPressFilesStep<ResourceType> {
	step: 'importWordPressFiles';
	/**
	 * The zip file containing the top-level WordPress files and
	 * directories.
	 */
	wordPressFilesZip: ResourceType;
	/**
	 * The path inside the zip file where the WordPress files are.
	 */
	pathInZip?: string;
}

/**
 * Imports top-level WordPress files from a given zip file into
 * the documentRoot. For example, if a zip file contains the
 * `wp-content` and `wp-includes` directories, they will replace
 * the corresponding directories in Playground's documentRoot.
 *
 * Any files that Playground recognizes as "excluded from the export"
 * will carry over from the existing document root into the imported
 * directories. For example, the sqlite-database-integration plugin.
 *
 * @param playground Playground client.
 * @param wordPressFilesZip Zipped WordPress site.
 */
export const importWordPressFiles: StepHandler<
	ImportWordPressFilesStep<File>
> = async (playground, { wordPressFilesZip, pathInZip = '' }) => {
	const documentRoot = await playground.documentRoot;

	// Unzip
	let importPath = joinPaths('/tmp', 'import');
	await playground.mkdir(importPath);
	await unzip(playground, {
		zipFile: wordPressFilesZip,
		extractToPath: importPath,
	});
	importPath = joinPaths(importPath, pathInZip);

	// Carry over any Playground-related files, such as the
	// SQLite database plugin, from the current wp-content
	// into the one that's about to be imported
	const importedWpContentPath = joinPaths(importPath, 'wp-content');
	const wpContentPath = joinPaths(documentRoot, 'wp-content');
	for (const relativePath of wpContentFilesExcludedFromExport) {
		// Remove any paths that were supposed to be excluded from the export
		// but maybe weren't
		const excludedImportPath = joinPaths(
			importedWpContentPath,
			relativePath
		);
		await removePath(playground, excludedImportPath);

		// Replace them with files sourced from the live wp-content directory
		const restoreFromPath = joinPaths(wpContentPath, relativePath);
		if (await playground.fileExists(restoreFromPath)) {
			await playground.mkdir(dirname(excludedImportPath));
			await playground.mv(restoreFromPath, excludedImportPath);
		}
	}

	// Carry over the database directory if the imported zip file doesn't
	// already contain one.
	const importedDatabasePath = joinPaths(
		importPath,
		'wp-content',
		'database'
	);
	if (!(await playground.fileExists(importedDatabasePath))) {
		await playground.mv(
			joinPaths(documentRoot, 'wp-content', 'database'),
			importedDatabasePath
		);
	}

	// Move all the paths from the imported directory into the document root.
	// Overwrite, if needed.
	const importedFilenames = await playground.listFiles(importPath);
	for (const fileName of importedFilenames) {
		await removePath(playground, joinPaths(documentRoot, fileName));
		await playground.mv(
			joinPaths(importPath, fileName),
			joinPaths(documentRoot, fileName)
		);
	}

	// Remove the directory where we unzipped the imported zip file.
	await playground.rmdir(importPath);

	// Adjust the site URL
	await defineSiteUrl(playground, {
		siteUrl: await playground.absoluteUrl,
	});

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

async function removePath(playground: UniversalPHP, path: string) {
	if (await playground.fileExists(path)) {
		if (await playground.isDir(path)) {
			await playground.rmdir(path);
		} else {
			await playground.unlink(path);
		}
	}
}
