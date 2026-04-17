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

	// Guard every top-level add_action() call for WordPress < 3.1
	// compatibility: when loaded via the lazy $wpdb loader,
	// WordPress hooks may not be available yet. Wrap the call so
	// it short-circuits to a no-op when add_action is undefined.
	// Anchors on start-of-line regardless of how the call is
	// formatted (single-line, multi-line, with or without space).
	dbPhp = dbPhp.replace(
		/^add_action\(/gm,
		'function_exists("add_action") && add_action('
	);

	const dbPhpPath = joinPaths(await php.documentRoot, 'wp-content/db.php');
	const SQLITE_MUPLUGIN_PATH =
		'/internal/shared/mu-plugins/sqlite-database-integration.php';

	// Playground writes a @playground-managed db.php drop-in for
	// legacy WordPress (see legacy-wp/legacy-boot.ts). The preload
	// guard must therefore recognise our own marker and *not* skip
	// itself on its own file — a blind `file_exists` guard would
	// short-circuit the lazy-$wpdb setup on every request. Only a
	// real user-supplied db.php should abort the preload.
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
// Shim __() etc. for WP 1.0, which predates the l10n layer:
// the SQLite plugin calls __() from print_error(). Skip if WP
// already ships an l10n file to avoid a redeclare fatal
// (WP 1.2–1.4 used wp-l10n.php; WP 1.5+ uses l10n.php).
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
	// Call reinitialize_sqlite() for old WordPress (< 3.0) where
	// the SQLite plugin's db_connect() is never called because old
	// wpdb does mysql_connect() inline.
	`require_once ${phpVar(muPluginPath)};
        if (
            isset($GLOBALS['wpdb']) &&
            method_exists($GLOBALS['wpdb'], 'reinitialize_sqlite')
        ) {
            $GLOBALS['wpdb']->reinitialize_sqlite();
        }`
)}
// These stubs return truthy values because old WordPress (< 3.0)
// calls mysql_connect() directly in wpdb::__construct() and calls
// bail() on a falsy return.
if(!function_exists('mysqli_connect')) {
	function mysqli_connect() { return true; }
}
if(!function_exists('mysqli_init')) {
	function mysqli_init() { return true; }
}
if(!function_exists('mysql_connect')) {
	function mysql_connect() { return true; }
}
if(!function_exists('mysql_select_db')) {
	function mysql_select_db() { return true; }
}
${MYSQL_SHIMS_PHP}
if (!function_exists('str_contains')) {
	function str_contains($haystack, $needle) {
		return $needle === '' || strpos($haystack, $needle) !== false;
	}
}
if (!function_exists('str_starts_with')) {
	function str_starts_with($haystack, $needle) {
		return strncmp($haystack, $needle, strlen($needle)) === 0;
	}
}
if (!function_exists('str_ends_with')) {
	function str_ends_with($haystack, $needle) {
		return $needle === '' || substr($haystack, -strlen($needle)) === $needle;
	}
}
if (PHP_MAJOR_VERSION < 7) {
	// E_DEPRECATED (8192) and E_STRICT (2048) are constants
	// added in PHP 5.3 - use numeric values for PHP 5.2 compat.
	$level = ${LEGACY_WP_ERROR_REPORTING_PHP_EXPR};
	error_reporting($level);
	ini_set('error_reporting', $level);
}
if (!isset($_SERVER['SERVER_PROTOCOL'])) {
	$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
}
if (!ini_get('date.timezone')) {
	date_default_timezone_set('UTC');
}

		`;
}
