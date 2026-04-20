/**
 * Legacy WordPress SQLite preload setup for legacy PHP (< 7) running
 * WP 1.0–4.9 on SQLite. Self-contained mirror of
 * {@link preloadSqliteIntegration} in index.ts — the modern function
 * dispatches here when isLegacyPHPVersion(phpVersion) is true.
 *
 * Uses the shared {@link SQLITE_PRELOAD_LOADER_CLASS} helper so the
 * Playground_SQLite_Integration_Loader class definition stays in
 * sync between modern and legacy preloads.
 */
import type { UniversalPHP } from '@php-wasm/universal';
import { joinPaths, phpVar } from '@php-wasm/util';
import { unzipFile } from '@wp-playground/common';
import type { SqliteIntegrationOptions } from '..';
import { SQLITE_PRELOAD_LOADER_CLASS } from '../sqlite-preload-loader';
import { LEGACY_WP_ERROR_REPORTING_PHP_EXPR } from './legacy-fixes';
import { MYSQL_SHIMS_PHP } from './mysql-shims';

export async function preloadLegacySqliteIntegration(
	php: UniversalPHP,
	sqliteZip: File,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- keep the signature aligned with preloadSqliteIntegration for symmetry
	_options: SqliteIntegrationOptions = {}
): Promise<void> {
	if (await php.isDir('/tmp/sqlite-database-integration')) {
		await php.rmdir('/tmp/sqlite-database-integration', {
			recursive: true,
		});
	}
	await php.mkdir('/tmp/sqlite-database-integration');
	await unzipFile(php, sqliteZip, '/tmp/sqlite-database-integration');
	const SQLITE_PLUGIN_FOLDER = '/internal/shared/sqlite-database-integration';

	// The SQLite integration plugin was extracted into the sole subdirectory
	// of /tmp/sqlite-database-integration. Move it to SQLITE_PLUGIN_FOLDER.
	const temporarySqlitePluginFolder = `/tmp/sqlite-database-integration/${
		(await php.listFiles('/tmp/sqlite-database-integration'))[0]
	}`;
	await php.mv(temporarySqlitePluginFolder, SQLITE_PLUGIN_FOLDER);

	await relaxSqliteDriverSqlModes(php, SQLITE_PLUGIN_FOLDER);

	// Prevents the SQLite integration from trying to call activate_plugin()
	await php.defineConstant('SQLITE_MAIN_FILE', '1');
	const dbCopy = await php.readFileAsText(
		joinPaths(SQLITE_PLUGIN_FOLDER, 'db.copy')
	);
	let dbPhp = dbCopy
		.replace(
			"'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
			phpVar(SQLITE_PLUGIN_FOLDER)
		)
		.replace(
			"'{SQLITE_PLUGIN}'",
			phpVar(joinPaths(SQLITE_PLUGIN_FOLDER, 'load.php'))
		);

	// When loaded via the lazy $wpdb loader on WP < 3.1, the hook
	// API isn't available yet. Skip top-level add_action() calls
	// in that window; the multiline anchor matches all formattings.
	dbPhp = dbPhp.replace(
		/^add_action\(/gm,
		'function_exists("add_action") && add_action('
	);

	const dbPhpPath = joinPaths(await php.documentRoot, 'wp-content/db.php');
	const SQLITE_MUPLUGIN_PATH =
		'/internal/shared/mu-plugins/sqlite-database-integration.php';

	// Recognise our own @playground-managed db.php marker so the
	// preload doesn't skip itself on its own drop-in — only a
	// real user-supplied db.php should abort.
	const dbPhpGuard = `
if(file_exists(${phpVar(dbPhpPath)})) {
	$_pg_db_php = @file_get_contents(${phpVar(dbPhpPath)});
	if (strpos($_pg_db_php, '@playground-managed') === false) {
		return;
	}
	unset($_pg_db_php);
}
`;

	await php.writeFile(SQLITE_MUPLUGIN_PATH, `<?php\n${dbPhpGuard}?>` + dbPhp);
	await php.writeFile(
		`/internal/shared/preload/0-sqlite.php`,
		buildLegacySqlitePreload(dbPhpGuard, SQLITE_MUPLUGIN_PATH)
	);

	/**
	 * Ensure the SQLite integration is loaded and clearly communicate
	 * if it isn't. This is useful because WordPress database errors
	 * may be cryptic and won't mention the SQLite integration.
	 */
	await php.writeFile(
		`/internal/shared/mu-plugins/sqlite-test.php`,
		`<?php
		global $wpdb;
		if(!($wpdb instanceof WP_SQLite_DB)) {
			var_dump(isset($wpdb));
			die("SQLite integration not loaded " . get_class($wpdb));
		}
		`
	);
}

/**
 * Resets the SQLite driver's default `active_sql_modes` to an empty
 * set. Matches the MySQL 4.1–5.5 default `sql_mode` that legacy
 * WordPress (1.0–4.9) was written against — and which WP 3.9+ already
 * achieves at runtime via `wpdb::set_sql_mode()` by stripping
 * `NO_ZERO_DATE`, `STRICT_TRANS_TABLES`, etc. from whatever the
 * server returns. The driver, however, ships with MySQL 8 strict
 * defaults, which reject values old WP (and the legacy installer)
 * emit unchanged — most visibly the `'0000-00-00 00:00:00'` draft
 * placeholder in `wp_insert_post()`.
 *
 * Applying this at the driver source level is simpler than patching
 * every legacy `wp_insert_post()` variant, and it covers WP < 3.9
 * where `wpdb::set_sql_mode()` doesn't exist.
 */
async function relaxSqliteDriverSqlModes(
	php: UniversalPHP,
	sqlitePluginFolder: string
): Promise<void> {
	const driverPath = joinPaths(
		sqlitePluginFolder,
		'wp-includes/database/sqlite/class-wp-pdo-mysql-on-sqlite.php'
	);
	if (!(await php.fileExists(driverPath))) return;
	const content = await php.readFileAsText(driverPath);
	// Two source variants: multi-line `private` in the standard build,
	// single-line `public` in the PHP 5.2-downgraded build. The regex
	// normalises both to an empty array literal.
	const patched = content.replace(
		/\$active_sql_modes\s*=\s*array\s*\([^)]*\)\s*;/,
		'$active_sql_modes = array();'
	);
	if (patched !== content) {
		await php.writeFile(driverPath, patched);
	}
}

/**
 * Builds the 0-sqlite.php preload content for legacy PHP (< 7).
 * Includes MySQL/MySQLi stubs, str_* polyfills, and error suppression.
 */
function buildLegacySqlitePreload(
	dbPhpGuard: string,
	muPluginPath: string
): string {
	return `<?php
${dbPhpGuard}?>
<?php
// Shim __() etc. only for WP < 1.2 (no l10n layer; the SQLite
// plugin calls __() from print_error()). WP 1.2–1.4 ship
// wp-l10n.php and WP 1.5+ ships l10n.php — defining the shims
// then would fatal on redeclare.
$_pg_doc_root = isset($_SERVER['DOCUMENT_ROOT'])
	? $_SERVER['DOCUMENT_ROOT'] : '/wordpress';
if (
	!file_exists($_pg_doc_root . '/wp-includes/l10n.php')
	&& !file_exists($_pg_doc_root . '/wp-includes/wp-l10n.php')
) {
	if (!function_exists('__')) {
		function __($text, $domain = null) { return $text; }
	}
	if (!function_exists('_e')) {
		function _e($text, $domain = null) { echo $text; }
	}
	if (!function_exists('esc_html__')) {
		function esc_html__($text, $domain = null) {
			return htmlspecialchars($text, ENT_QUOTES);
		}
	}
	if (!function_exists('esc_html_e')) {
		function esc_html_e($text, $domain = null) {
			echo htmlspecialchars($text, ENT_QUOTES);
		}
	}
}
?>
<?php
${SQLITE_PRELOAD_LOADER_CLASS(
	// WP < 3.0's wpdb does mysql_connect() inline so the SQLite
	// plugin's db_connect() never runs; reinitialize_sqlite()
	// swaps the dbh in place after the integration is loaded.
	`require_once ${phpVar(muPluginPath)};
        if (
            isset($GLOBALS['wpdb']) &&
            method_exists($GLOBALS['wpdb'], 'reinitialize_sqlite')
        ) {
            $GLOBALS['wpdb']->reinitialize_sqlite();
        }`
)}
${MYSQL_SHIMS_PHP}
if (PHP_MAJOR_VERSION < 7) {
	// E_DEPRECATED (8192) / E_STRICT (2048) are PHP 5.3+ symbols;
	// LEGACY_WP_ERROR_REPORTING_PHP_EXPR uses numeric literals.
	$level = ${LEGACY_WP_ERROR_REPORTING_PHP_EXPR};
	error_reporting($level);
	ini_set('error_reporting', $level);
}

		`;
}
