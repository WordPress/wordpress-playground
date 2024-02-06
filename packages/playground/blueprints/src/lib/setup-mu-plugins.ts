import { joinPaths } from '@php-wasm/util';

/** @ts-ignore */
import transportFetch from './playground-mu-plugin/playground-includes/wp_http_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './playground-mu-plugin/playground-includes/wp_http_dummy.php?raw';
/** @ts-ignore */
import playgroundMuPlugin from './playground-mu-plugin/0-playground.php?raw';
import { UniversalPHP, writeFiles } from '@php-wasm/universal';

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

export async function linkSqliteMuPlugin(php: UniversalPHP) {
	const docroot = await php.documentRoot;
	const muPluginsPath = joinPaths(docroot, 'wp-content/mu-plugins/');
	const sqlitePluginPath = joinPaths(
		muPluginsPath,
		'sqlite-database-integration'
	);
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
