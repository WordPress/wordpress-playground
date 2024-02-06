import { StepHandler } from '.';
import { unzip } from './unzip';
import { basename, joinPaths } from '@php-wasm/util';
import { UniversalPHP, currentJsRuntime } from '@php-wasm/universal';
import { defineSiteUrl } from './define-site-url';
import {
	installPlaygroundMuPlugin,
	linkSqliteMuPlugin,
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
	await backfillWpConfig(php, snapshotPath, documentRoot);
	await backfillSqliteMuPlugin(php, snapshotPath, documentRoot);

	// Remove previous core files
	for (const file of await php.listFiles(documentRoot)) {
		if (file === '.snapshot') {
			continue;
		}
		await removePath(php, joinPaths(documentRoot, file));
	}
	await moveContents(php, snapshotPath, documentRoot);
	await removePath(php, joinPaths(documentRoot, '.snapshot'));
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
}

async function backfillWordPressCore(
	php: UniversalPHP,
	snapshotPath: string,
	previousCorePath: string
) {
	const importedFiles = await php.listFiles(snapshotPath);
	const snapshotType = detectSnapshotType(importedFiles);
	if (snapshotType === 'unknown') {
		throw new Error(
			'WordPress snapshot must contain either the full WordPress core or just wp-config.php and the wp-content directory.'
		);
	}

	if (snapshotType === 'wp-core') {
		return;
	}

	if (snapshotType === 'wp-content') {
		// Bring over WordPress core files from the previous core path
		await moveContents(php, previousCorePath, snapshotPath, {
			except: ['wp-content', 'wp-config.php', basename(snapshotPath)],
		});
		return;
	}

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

/**
 * Ensure the SQLite integration plugin is installed.
 * The prebuilt Playground WordPress zips include it,
 * but this worker may also be initialized with a custom zip
 * or an OPFS directory handle.
 *
 * The same logic is present in packages/playground/wordpress/build/Dockerfile
 * be sure to keep it in sync.
 */
export async function backfillSqliteMuPlugin(
	php: UniversalPHP,
	snapshotPath: string,
	previousCorePath?: string
) {
	// The SQLite plugin used to be a regular plugin in old Playground exports.
	// Let's be nice and clean it up if it's present.
	const sqlitePluginPath = joinPaths(
		snapshotPath,
		'wp-content/plugins/sqlite-database-integration'
	);
	await removePath(php, sqlitePluginPath);

	await php.mkdir(joinPaths(snapshotPath, 'wp-content', 'mu-plugins'));
	const sqliteMuPluginPath = 'wp-content/plugins/sqlite-database-integration';
	if (await php.fileExists(joinPaths(snapshotPath, sqliteMuPluginPath))) {
		// The SQLite plugin is present in the imported snapshot, we're good.
		return false;
	}

	if (previousCorePath) {
		const prevMuPluginPath = joinPaths(
			previousCorePath,
			sqliteMuPluginPath
		);
		if (await php.fileExists(prevMuPluginPath)) {
			// The SQLite plugin was present in the previous core, let's carry it over.
			await moveContents(php, prevMuPluginPath, sqliteMuPluginPath, {
				except: ['sqlite-database-integration'],
			});
			return true;
		}
	}

	// Otherwise, let's download and install the SQLite plugin
	const muPluginsPath = joinPaths(snapshotPath, 'wp-content/mu-plugins/');
	const plugin = await fetch(
		'https://downloads.wordpress.org/plugin/sqlite-database-integration.zip'
	);
	await unzip(php, {
		// The zip file contains a directory with the same name as the plugin.
		extractToPath: muPluginsPath,
		zipFile: new File(
			[await plugin.blob()],
			'sqlite-database-integration.latest.zip'
		),
	});

	return true;
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

async function backfillWpConfig(
	php: UniversalPHP,
	snapshotPath: string,
	previousCorePath?: string
) {
	// Vanilla WordPress core has no wp-config.php. Let's backfill it
	// using the bundled wp-config-sample.php.
	if (await php.fileExists(joinPaths(snapshotPath, 'wp-config.php'))) {
		return;
	}
	const candidates = [joinPaths(snapshotPath, 'wp-config-sample.php')];
	if (previousCorePath) {
		candidates.push(
			joinPaths(previousCorePath, 'wp-config-sample.php'),
			joinPaths(previousCorePath, 'wp-config.php')
		);
	}
	for (const candidate of candidates) {
		if (await php.fileExists(candidate)) {
			await php.mv(candidate, joinPaths(snapshotPath, 'wp-config.php'));
			return;
		}
	}
	throw new Error(
		'Neither wp-config.php nor wp-config-sample.php found in the imported WordPress snapshot'
	);
}

async function linkWpConfig(php: UniversalPHP) {
	const snapshotPath = await php.documentRoot;
	// Vanilla WordPress core has no wp-config.php. Let's backfill it
	// using the bundled wp-config-sample.php.
	if (await php.fileExists(joinPaths(snapshotPath, 'wp-config.php'))) {
		return;
	}
	const wpConfigSample = joinPaths(snapshotPath, 'wp-config-sample.php');
	if (!(await php.fileExists(wpConfigSample))) {
		throw new Error(
			'Neither wp-config.php nor wp-config-sample.php found in the imported WordPress snapshot'
		);
	}
	await php.mv(wpConfigSample, joinPaths(snapshotPath, 'wp-config.php'));
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

	await linkWpConfig(php);
	await linkSqliteMuPlugin(php);

	// Ensure the Playground mu-plugin is present if we're running in the
	// browser. This will overwrite the existing Playground mu-plugin if
	// it's present, but that's fine. We always want to run the latest version.
	if (currentJsRuntime === 'WEB' || currentJsRuntime === 'WORKER') {
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

	// If the database is missing, run the installation wizard
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
