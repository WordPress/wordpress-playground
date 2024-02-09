import { joinPaths } from '@php-wasm/util';
import { UniversalPHP } from '@php-wasm/universal';
import {
	runWpInstallationWizard,
	defineWpConfigConsts,
} from '@wp-playground/blueprints';
import { unzip } from '@wp-playground/php-bridge';

export async function unzipSnapshot(php: UniversalPHP, snapshotZip: File) {
	const targetPath = await php.documentRoot;
	await unzip(php, snapshotZip, targetPath);

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

	// If the snapshot contains a wp-content directory, we're done.
	const files = await php.listFiles(targetPath);
	const filesSet = new Set(files);
	if (filesSet.has('wp-content')) {
		return;
	}

	// wp-content not found, let's find the WordPress core files in
	// the extracted snapshot.
	// @TODO do not infer the path from the snapshot contents.
	//       Instead, let the consumer of this API provide the path.
	let pathInZip = '';
	if (filesSet.size === 1 && !filesSet.has('wp-content')) {
		// If there's only one directory in the snapshot, use that as the import path.
		pathInZip = files[0];
	} else if (filesSet.has('wordpress')) {
		// If importing a WordPress.org zip, it may contain a top-level
		// directory named "wordpress". If so, use that as the import path.
		pathInZip = 'wordpress';
	} else if (filesSet.has('build')) {
		// WordPress CI artifacts are in a "build" directory.
		pathInZip = 'build';
	}
	const importedFilesPath = joinPaths(targetPath, pathInZip);
	await moveContents(php, importedFilesPath, targetPath);
	await removePath(php, importedFilesPath);

	if (!(await php.fileExists(joinPaths(targetPath, 'wp-content')))) {
		throw new Error(
			'The snapshot does not contain a wp-content directory.'
		);
	}
}

export async function backfillWordPressCore(
	php: UniversalPHP,
	wpCoreZip: File
) {
	const documentRoot = await php.documentRoot;
	const files = await php.listFiles(documentRoot);
	if (files.includes('wp-includes') && files.includes('wp-admin')) {
		// Core files are already present in the document root, nothing to do.
		return;
	}

	const filesSet = new Set(files);
	const noop = '#^$#';
	await unzip(php, wpCoreZip, documentRoot, {
		except: [
			// Do not overwrite wp-content files if it's already present.
			filesSet.has('wp-content') ? '#^wp-content#' : noop,
			// Do not overwrite wp-config.php if it's already present.
			filesSet.has('wp-config.php') ? '#^wp-config.php$#' : noop,
		],
	});
}

export async function backfillWpConfig(php: UniversalPHP) {
	const targetPath = await php.documentRoot;

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
		await defineWpConfigConsts(php, {
			consts: {
				// Randomize the WordPress secrets in the freshly created wp-config.php.
				AUTH_KEY: crypto.randomUUID(),
				SECURE_AUTH_KEY: crypto.randomUUID(),
				LOGGED_IN_KEY: crypto.randomUUID(),
				NONCE_KEY: crypto.randomUUID(),
				AUTH_SALT: crypto.randomUUID(),
				SECURE_AUTH_SALT: crypto.randomUUID(),
				LOGGED_IN_SALT: crypto.randomUUID(),
				NONCE_SALT: crypto.randomUUID(),
			},
		});
	}
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

export async function backfillDatabase(php: UniversalPHP) {
	// Run the installation wizard if the database is missing
	const dbExists = await php.fileExists(
		joinPaths(
			await php.documentRoot,
			'wp-content',
			'database',
			'.ht.sqlite'
		)
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
