import { StepHandler } from '.';
import { unzip } from './unzip';
import { basename, joinPaths } from '@php-wasm/util';
import { UniversalPHP, currentJsRuntime } from '@php-wasm/universal';
import { defineSiteUrl } from './define-site-url';
import {
	installPlaygroundMuPlugin,
	installSqliteMuPlugin,
} from '../setup-mu-plugins';
import { runWpInstallationWizard } from './run-wp-installation-wizard';
import { defineWpConfigConsts } from './define-wp-config-consts';

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
 * Any files that Playground recognizes as "exceptd from the export"
 * will carry over from the existing document root into the imported
 * directories. For example, the sqlite-database-integration plugin.
 *
 * @param php Playground client.
 * @param wordPressFilesZip Zipped WordPress site.
 */
export const importWordPressFiles: StepHandler<
	ImportWordPressFilesStep<File>
> = async (php, { wordPressFilesZip, pathInZip = '' }) => {
	await setSnapshot(php, wordPressFilesZip, pathInZip);
	await linkSnapshot(php);
};

export async function setSnapshot(
	php: UniversalPHP,
	snapshotZip: File,
	pathInZip = ''
) {
	const documentRoot = await php.documentRoot;
	// Extract the snapshot to a temporary directory.
	// Use a subdirectory of the document root to avoid a slow recursive
	// copy operation across Emscripten filesystems – in Node.js,
	// the /tmp directory is likely kept in MEMFS, while the document
	// root is typically a NODEFS mount.
	const snapshotPath = joinPaths(documentRoot, '.snapshot');
	await unzipSnapshot(php, snapshotZip, pathInZip, snapshotPath);
	await backfillWordPressCore(php, snapshotPath, documentRoot);
	await removeContents(php, documentRoot, { except: ['.snapshot'] });
	await moveContents(php, snapshotPath, documentRoot);
	await removePath(php, snapshotPath);
}

async function unzipSnapshot(
	php: UniversalPHP,
	snapshotZip: File,
	pathInZip = '',
	targetPath: string
) {
	await unzip(php, {
		zipFile: snapshotZip,
		extractToPath: targetPath,
	});

	// Find WordPress core files in the extracted snapshot.
	let importedFilesPath = targetPath;
	if (pathInZip) {
		// If pathInZip is explicitly provided, use it.
		importedFilesPath = joinPaths(targetPath, pathInZip);
	} else if (
		(await php.fileExists(joinPaths(targetPath, 'wordpress'))) &&
		!(await php.fileExists(joinPaths(targetPath, 'wp-content')))
	) {
		// If importing a WordPress.org zip, it may contain a top-level
		// directory named "wordpress". If so, use that as the import path.
		importedFilesPath = joinPaths(importedFilesPath, 'wordpress');
	}

	// If the imported files were in a nested directory in the zip,
	// move them over to the document root.
	if (importedFilesPath !== targetPath) {
		await moveContents(php, importedFilesPath, targetPath);
	}

	// Ensure wp-config.php is present in the extracted snapshot.
	if (!(await php.fileExists(joinPaths(targetPath, 'wp-config.php')))) {
		const samplePath = joinPaths(targetPath, 'wp-config-sample.php');
		const wpConfig = (await php.fileExists(samplePath))
			? await php.readFileAsText(samplePath)
			: `<?php
				$table_prefix = 'wp_';
				define( 'WP_DEBUG', false );
				if ( ! defined( 'ABSPATH' ) ) {
					define( 'ABSPATH', __DIR__ . '/' );
				}
				require_once ABSPATH . 'wp-settings.php';`;
		await php.writeFile(joinPaths(targetPath, 'wp-config.php'), wpConfig);
	}

	// Ensure the mu-plugins directory is present in the extracted snapshot.
	if (await php.fileExists(joinPaths(targetPath, 'wp-content'))) {
		await php.mkdir(joinPaths(targetPath, 'wp-content', 'mu-plugins'));
	}

	// The SQLite plugin used to be a regular plugin in old Playground exports.
	// This won't work anymore. Let's be nice and clean it up if needed.
	const sqlitePluginPath = joinPaths(
		targetPath,
		'wp-content/plugins/sqlite-database-integration'
	);
	await removePath(php, sqlitePluginPath);
}

async function backfillWordPressCore(
	php: UniversalPHP,
	snapshotPath: string,
	previousCorePath: string
) {
	const importedFiles = await php.listFiles(snapshotPath);
	const snapshotType = detectSnapshotType(importedFiles);
	if (snapshotType === 'wp-core') {
		// Core files are already present in the snapshot, nothing to do.
		return;
	}

	if (snapshotType === 'wp-content') {
		// Bring over WordPress core files from the previous core path
		await moveContents(php, previousCorePath, snapshotPath, {
			except: ['wp-content', 'wp-config.php', basename(snapshotPath)],
		});

		const wpIncludesPath = joinPaths(snapshotPath, 'wp-includes');
		if (!(await php.fileExists(wpIncludesPath))) {
			// @TODO: Download the latest minified WordPress zip and source the files from there.
			// @TODO: Include a Blueprint/manifest with the Playground export, and use it to source
			//        the expected WordPress version.
			throw new Error(
				'Cannot initialize Playground with just the wp-content directory without loading WordPress core first. ' +
					'Most likely you specified a zip file URL as a preferred WordPress version. ' +
					'Either provide a zip file that contains the top-level WordPress files and directories, or ' +
					'import your zip by explicitly listing the "importWordPressFiles" in the Blueprint.'
			);
		}
		return;
	} else {
		throw new Error(
			'WordPress snapshot must contain either the full WordPress core or just wp-config.php and the wp-content directory.'
		);
	}
}

function detectSnapshotType(files: string[]) {
	if (files.includes('wp-includes') && files.includes('wp-admin')) {
		return 'wp-core' as const;
	}

	if (
		(files.length === 1 && files.includes('wp-content')) ||
		(files.length === 2 &&
			files.includes('wp-content') &&
			files.includes('wp-config.php'))
	) {
		return 'wp-content' as const;
	}

	return 'unknown' as const;
}

async function moveContents(
	php: UniversalPHP,
	from: string,
	to: string,
	{ except = [] }: { except?: string[] } = {}
): Promise<void> {
	await php.mkdir(to);
	const files = await php.listFiles(from);
	for (const file of files) {
		if (except.includes(file)) {
			continue;
		}
		await php.mv(joinPaths(from, file), joinPaths(to, file));
	}
}
async function removeContents(
	php: UniversalPHP,
	from: string,
	{ except = [] }: { except?: string[] } = {}
): Promise<void> {
	const files = await php.listFiles(from);
	for (const file of files) {
		if (except.includes(file)) {
			continue;
		}
		await removePath(php, joinPaths(from, file));
	}
}

/**
 * Private API.
 *
 * Turns a static WordPress snapshot present in the document root
 * into a configured, runnable WordPress site.
 *
 * @private
 * @param php
 */
export async function linkSnapshot(php: UniversalPHP) {
	const documentRoot = await php.documentRoot;

	// Enforce the required Playground and SQLite mu-plugins in
	// the browser.
	if (currentJsRuntime === 'WEB' || currentJsRuntime === 'WORKER') {
		await installSqliteMuPlugin(php, documentRoot);
		await installPlaygroundMuPlugin(php);
	}

	// Adjust the site URL
	await defineSiteUrl(php, {
		siteUrl: await php.absoluteUrl,
	});

	// Randomize the WordPress secrets
	await defineWpConfigConsts(php, {
		consts: {
			AUTH_KEY: randomString(40),
			SECURE_AUTH_KEY: randomString(40),
			LOGGED_IN_KEY: randomString(40),
			NONCE_KEY: randomString(40),
			AUTH_SALT: randomString(40),
			SECURE_AUTH_SALT: randomString(40),
			LOGGED_IN_SALT: randomString(40),
			NONCE_SALT: randomString(40),
		},
	});

	// Run the installation wizard if the database is missing
	const dbExists = await php.fileExists(
		joinPaths(documentRoot, 'wp-content', 'database', '.ht.sqlite')
	);
	if (!dbExists) {
		await runWpInstallationWizard(php, {});
	}
}

async function removePath(playground: UniversalPHP, path: string) {
	if (await playground.fileExists(path)) {
		if (await playground.isDir(path)) {
			await playground.rmdir(path);
		} else {
			await playground.unlink(path);
		}
	}
}

export function randomString(length: number) {
	const chars =
		'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+=-[]/.,<>?';
	let result = '';
	for (let i = length; i > 0; --i)
		result += chars[Math.floor(Math.random() * chars.length)];
	return result;
}
