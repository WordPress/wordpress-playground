import { joinPaths } from '@php-wasm/util';

/** @ts-ignore */
import transportFetch from './playground-mu-plugin/playground-includes/wp_http_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './playground-mu-plugin/playground-includes/wp_http_dummy.php?raw';
/** @ts-ignore */
import playgroundMuPlugin from './playground-mu-plugin/0-playground.php?raw';
import { UniversalPHP, writeFiles } from '@php-wasm/universal';
import { unzip } from './steps/unzip';

export async function installPlaygroundMuPlugin(php: UniversalPHP) {
	const muPluginsPath = joinPaths(
		await php.documentRoot,
		'wp-content/mu-plugins/'
	);
	await writeFiles(php, muPluginsPath, {
		'0-playground.php': playgroundMuPlugin,
		'playground-includes/wp_http_dummy.php': transportDummy,
		'playground-includes/wp_http_fetch.php': transportFetch,
	});
}

export async function installSqliteMuPlugin(
	php: UniversalPHP,
	snapshotPath: string
) {
	await ensureSqliteMuPlugin(php, snapshotPath);
	await activateSqliteMuPlugin(php);
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
async function ensureSqliteMuPlugin(php: UniversalPHP, snapshotPath: string) {
	const sqliteMuPluginPath = 'wp-content/plugins/sqlite-database-integration';
	if (await php.fileExists(joinPaths(snapshotPath, sqliteMuPluginPath))) {
		// The SQLite plugin is present in the imported snapshot, we're good.
		return false;
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

export async function activateSqliteMuPlugin(php: UniversalPHP) {
	const docroot = await php.documentRoot;
	const muPluginsPath = joinPaths(docroot, 'wp-content/mu-plugins/');
	const sqlitePluginPath = joinPaths(
		muPluginsPath,
		'sqlite-database-integration'
	);
	if (!(await php.fileExists(sqlitePluginPath))) {
		console.log(
			'sqlite-database-integration not found in mu-plugins, skipping'
		);
		return;
	}
	await php.mkdir(sqlitePluginPath);
	await php.writeFile(
		joinPaths(muPluginsPath, '0-sqlite.php'),
		'<?php require_once __DIR__ . "/sqlite-database-integration/load.php"; '
	);
	const dbPhp = (
		await php.readFileAsText(joinPaths(sqlitePluginPath, 'db.copy'))
	)
		.replace(
			"'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
			"__DIR__.'/mu-plugins/sqlite-database-integration/'"
		)
		.replace(
			"'{SQLITE_PLUGIN}'",
			"__DIR__.'/mu-plugins/sqlite-database-integration/load.php'"
		);
	php.writeFile(joinPaths(docroot, 'wp-content/db.php'), dbPhp);
}
