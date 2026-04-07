/**
 * Legacy WordPress version fixes.
 *
 * Patches WordPress source files at boot time to make WP 1.0 through
 * 2.8 work on the SQLite integration layer with the PHP 5.6 WASM
 * binary. Also patches the SQLite integration plugin itself for
 * PHP 5.6 compatibility.
 *
 * All functions here are only needed for old WP versions or old PHP.
 * Modern WordPress (3.0+) on PHP 7+ doesn't need any of these.
 */
import type { PHP, UniversalPHP } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';
import { MYSQL_SHIMS_PHP } from './mysql-shims';
import {
	replaceNullCoalescing,
	replacePhp7ErrorClasses,
	stripPhp7TypeDeclarations,
} from './legacy-php-compat';

/**
 * Patches WordPress source files for legacy version compatibility.
 *
 * Applies all necessary patches to make old WordPress versions
 * (1.0 through 2.8) work with modern PHP and the SQLite integration.
 */
export async function patchWordPressSourceFiles(
	php: PHP,
	documentRoot: string,
	phpMajor: number
) {
	await ensureVersionPhp(php, documentRoot);
	await ensureWpLoadPhp(php, documentRoot);
	await patchWp10DoubleQuotedSqlLiterals(php, documentRoot);
	await patchWpSettingsPhp(php, documentRoot, phpMajor);
	await patchWpFunctionsPhp(php, documentRoot);
	await patchWpInstallPhp(php, documentRoot);
	await patchWpDbPhp(php, documentRoot);
	await patchWpSchemaPhp(php, documentRoot);
	await patchWpAdminRelativePaths(php, documentRoot);
	if (phpMajor < 7) {
		// Only stub update check files for old WP where http.php
		// was skipped by patchWpSettingsPhp (WP 2.8-2.9). For WP
		// 3.0+, the original update.php works fine after comment
		// stripping and stubbing it breaks the install.
		const wpSettingsPath = joinPaths(documentRoot, 'wp-settings.php');
		if (
			php.fileExists(wpSettingsPath) &&
			php
				.readFileAsText(wpSettingsPath)
				.includes('Skipped for PHP 5.6 parser size limit')
		) {
			await disableUpdateChecks(php, documentRoot);
		}
		await ensureLegacyAdminAuth(php, documentRoot);
		await patchAdminAuthRedirect(php, documentRoot);
	}
}

/**
 * Returns the PHP content for wp-content/db.php.
 *
 * This db.php provides MySQL/MySQLi function stubs and, for WP < 3.0,
 * loads the SQLite integration directly. Modern WP only needs this file
 * to *exist* (to bypass the extension_loaded('mysql') check), but old
 * WP actually uses the stubs defined here.
 */
export function generateDbPhpContent(): string {
	return `<?php
// @playground-managed — Playground-generated db.php.
//
// WordPress < 3.0 loads ONLY db.php and skips wp-db.php
// entirely when db.php exists. We need the wpdb class
// definition from wp-db.php for the SQLite driver.
if (defined('ABSPATH') && defined('WPINC') && !class_exists('wpdb', false)) {
	require_once(ABSPATH . WPINC . '/wp-db.php');
}
// For old WordPress (< 3.0), load the SQLite integration directly
// from db.php and call reinitialize_sqlite(). Old wpdb has no
// db_connect() method; it does mysql_connect() inline, leaving
// $this->dbh as a boolean stub.
//
// Only do this for old WP: check if wpdb lacks db_connect()
// as a method defined in the class itself (not inherited).
// Modern WP (3.0+) uses the lazy $wpdb loader successfully.
if (
	class_exists('wpdb', false) &&
	isset($GLOBALS['wpdb']) &&
	!($GLOBALS['wpdb'] instanceof wpdb) &&
	!method_exists('wpdb', 'db_connect') &&
	file_exists('/internal/shared/mu-plugins/sqlite-database-integration.php')
) {
	// This block loads SQLite integration for old WP (< 3.0).
	// Uses eval() instead of require_once to work around a PHP 5.6
	// WASM parser bug where require_once produces spurious parse errors.
	eval('?>' . file_get_contents('/internal/shared/mu-plugins/sqlite-database-integration.php'));
	if (
		isset($GLOBALS['wpdb']) &&
		$GLOBALS['wpdb'] instanceof wpdb &&
		method_exists($GLOBALS['wpdb'], 'reinitialize_sqlite')
	) {
		$GLOBALS['wpdb']->reinitialize_sqlite();
	}
}
//
// Polyfills for PHP functions used by the SQLite integration
// but missing on older PHP versions.
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
// Provides MySQL/MySQLi function stubs so WordPress 4.x
// doesn't die on the extension_loaded() check.
// The actual SQLite database is set up by the
// 0-sqlite.php preload via auto_prepend_file.
//
// mysql_connect and mysql_select_db return truthy values because
// WordPress < 3.0 calls mysql_connect() directly in wpdb::__construct
// and dies on false. The return value is never used for real queries.
if (!function_exists('mysql_connect')) {
	function mysql_connect() { return true; }
}
if (!function_exists('mysql_select_db')) {
	function mysql_select_db() { return true; }
}
if (!function_exists('mysqli_connect')) {
	function mysqli_connect() { return true; }
}
if (!function_exists('mysqli_init')) {
	function mysqli_init() { return true; }
}
if (!function_exists('mysqli_real_connect')) {
	function mysqli_real_connect() { return true; }
}
if (!function_exists('mysqli_error')) {
	function mysqli_error() { return ''; }
}
if (!function_exists('mysqli_errno')) {
	function mysqli_errno() { return 0; }
}
if (!function_exists('mysqli_query')) {
	function mysqli_query() { return false; }
}
if (!function_exists('mysqli_set_charset')) {
	function mysqli_set_charset() { return true; }
}
if (!function_exists('mysqli_select_db')) {
	function mysqli_select_db() { return true; }
}
if (!function_exists('mysqli_close')) {
	function mysqli_close() { return true; }
}
${MYSQL_SHIMS_PHP}
`;
}

/**
 * Pre-creates WP 1.x database tables via PDO before the installer runs.
 *
 * The WP 1.x installer uses mysql_* calls that the SQLite driver can't
 * fully handle. By creating tables with the correct schema first, the
 * installer's CREATE TABLE statements become no-ops.
 */
export async function preCreateLegacyTables(php: PHP): Promise<void> {
	await php.run({
		code: `<?php
			$db_dir = getenv('DOCUMENT_ROOT') . '/wp-content/database/';
			if (!is_dir($db_dir)) @mkdir($db_dir, 0777, true);
			$pdo = new PDO('sqlite:' . $db_dir . '.ht.sqlite');
			$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			$p = 'wp_';
			// Only create if this is WP 1.x (has multi-step installer
			// with mysql_list_tables, not the dbDelta-based installer).
			$install = getenv('DOCUMENT_ROOT') . '/wp-admin/install.php';
			if (file_exists($install) && strpos(file_get_contents($install), 'mysql_list_tables') !== false) {
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}categories (cat_ID INTEGER PRIMARY KEY AUTOINCREMENT, cat_name TEXT NOT NULL DEFAULT '', category_nicename TEXT NOT NULL DEFAULT '', category_description TEXT NOT NULL DEFAULT '', category_parent INTEGER NOT NULL DEFAULT 0)");
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}post2cat (rel_id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL DEFAULT 0, category_id INTEGER NOT NULL DEFAULT 0)");
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}postmeta (meta_id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL DEFAULT 0, meta_key TEXT NOT NULL DEFAULT '', meta_value TEXT NOT NULL DEFAULT '')");
				// WP 1.0 options table has more columns than WP 1.2
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}options (option_id INTEGER PRIMARY KEY AUTOINCREMENT, blog_id INTEGER NOT NULL DEFAULT 0, option_name TEXT NOT NULL DEFAULT '', option_can_override TEXT NOT NULL DEFAULT 'Y', option_type INTEGER NOT NULL DEFAULT 1, option_value TEXT NOT NULL DEFAULT '', option_width INTEGER NOT NULL DEFAULT 20, option_height INTEGER NOT NULL DEFAULT 8, option_description TEXT NOT NULL DEFAULT '', option_admin_level INTEGER NOT NULL DEFAULT 1, autoload TEXT NOT NULL DEFAULT 'yes')");
				// Seed essential options so WordPress can boot
				try {
					if (!$pdo->query("SELECT COUNT(*) FROM {$p}options WHERE option_name='siteurl'")->fetchColumn()) {
						$pdo->exec("INSERT INTO {$p}options (option_name, option_value) VALUES ('siteurl', 'http://localhost')");
						$pdo->exec("INSERT INTO {$p}options (option_name, option_value) VALUES ('blogname', 'My WordPress Website')");
						$pdo->exec("INSERT INTO {$p}options (option_name, option_value) VALUES ('blogdescription', 'Just another WordPress weblog')");
						$pdo->exec("INSERT INTO {$p}options (option_name, option_value) VALUES ('home', 'http://localhost')");
					}
				} catch (Exception $e) {}
				// Links tables (WP 1.2 install step 1 uses mysql_list_tables)
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}links (link_id INTEGER PRIMARY KEY AUTOINCREMENT, link_url TEXT NOT NULL DEFAULT '', link_name TEXT NOT NULL DEFAULT '', link_image TEXT NOT NULL DEFAULT '', link_target TEXT NOT NULL DEFAULT '', link_category INTEGER NOT NULL DEFAULT 0, link_description TEXT NOT NULL DEFAULT '', link_visible TEXT NOT NULL DEFAULT 'Y', link_owner INTEGER NOT NULL DEFAULT 1, link_rating INTEGER NOT NULL DEFAULT 0, link_updated TEXT NOT NULL DEFAULT '0000-00-00 00:00:00', link_rel TEXT NOT NULL DEFAULT '', link_notes TEXT NOT NULL DEFAULT '', link_rss TEXT NOT NULL DEFAULT '')");
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}linkcategories (cat_id INTEGER PRIMARY KEY AUTOINCREMENT, cat_name TEXT NOT NULL DEFAULT '', auto_toggle TEXT NOT NULL DEFAULT 'N', show_images TEXT NOT NULL DEFAULT 'Y', show_description TEXT NOT NULL DEFAULT 'N', show_rating TEXT NOT NULL DEFAULT 'Y', show_updated TEXT NOT NULL DEFAULT 'Y', sort_order TEXT NOT NULL DEFAULT 'name', sort_desc TEXT NOT NULL DEFAULT 'ASC', text_before_link TEXT NOT NULL DEFAULT '<li>', text_after_link TEXT NOT NULL DEFAULT '</li>', text_after_all TEXT NOT NULL DEFAULT '</ul>', list_limit INTEGER NOT NULL DEFAULT -1)");
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}comments (comment_ID INTEGER PRIMARY KEY AUTOINCREMENT, comment_post_ID INTEGER NOT NULL DEFAULT 0, comment_author TEXT NOT NULL DEFAULT '', comment_author_email TEXT NOT NULL DEFAULT '', comment_author_url TEXT NOT NULL DEFAULT '', comment_author_IP TEXT NOT NULL DEFAULT '', comment_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00', comment_date_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00', comment_content TEXT NOT NULL DEFAULT '', comment_karma INTEGER NOT NULL DEFAULT 0, comment_approved TEXT NOT NULL DEFAULT '1', comment_agent TEXT NOT NULL DEFAULT '', comment_type TEXT NOT NULL DEFAULT '', comment_parent INTEGER NOT NULL DEFAULT 0, user_id INTEGER NOT NULL DEFAULT 0)");
				// Seed Hello world post
				$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}posts (ID INTEGER PRIMARY KEY AUTOINCREMENT, post_author INTEGER NOT NULL DEFAULT 0, post_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00', post_date_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00', post_content TEXT NOT NULL DEFAULT '', post_title TEXT NOT NULL DEFAULT '', post_category INTEGER NOT NULL DEFAULT 0, post_excerpt TEXT NOT NULL DEFAULT '', post_status TEXT NOT NULL DEFAULT 'publish', comment_status TEXT NOT NULL DEFAULT 'open', ping_status TEXT NOT NULL DEFAULT 'open', post_password TEXT NOT NULL DEFAULT '', post_name TEXT NOT NULL DEFAULT '', to_ping TEXT NOT NULL DEFAULT '', pinged TEXT NOT NULL DEFAULT '', post_modified TEXT NOT NULL DEFAULT '0000-00-00 00:00:00', post_modified_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00', post_content_filtered TEXT NOT NULL DEFAULT '')");
				try {
					if (!$pdo->query("SELECT COUNT(*) FROM {$p}posts")->fetchColumn()) {
						$now = date('Y-m-d H:i:s');
						$pdo->exec("INSERT INTO {$p}posts (ID, post_author, post_date, post_date_gmt, post_content, post_title, post_status, post_name, post_modified, post_modified_gmt) VALUES (1, 1, '{$now}', '{$now}', 'Welcome to WordPress. This is your first post. Edit or delete it, then start blogging!', 'Hello world!', 'publish', 'hello-world', '{$now}', '{$now}')");
					}
				} catch (Exception $e) {}
			}
		`,
		env: { DOCUMENT_ROOT: php.documentRoot },
	});
}

/**
 * Runs post-install fixups for old WordPress versions.
 *
 * Two-stage approach:
 * 1. Load WordPress and fix data via $wpdb (admin password, seed content)
 * 2. PDO fallback that directly creates tables and seeds data when the
 *    WordPress-based fixup fails (WP 1.x where loading WP may crash)
 */
export async function runPostInstallLegacyFixups(php: PHP): Promise<void> {
	// Derive siteUrl from the PHP request handler if available.
	const siteUrl = (php as any).requestHandler?.siteUrl?.toString() || '';
	// Stage 1: wpdb-based fixups (loads WordPress)
	try {
		const result = await php.run({
			code: `<?php
				// WP_INSTALLING allows bypassing WP 1.x's "not installed"
				// die() check in wp-settings.php.
				define('WP_INSTALLING', true);
				// Enable error display for legacy WP debugging — safe in
				// the sandboxed WASM environment, never exposed to end users.
				error_reporting(E_ALL);
				ini_set('display_errors', '1');
				ob_start();
				$wp_load = getenv('DOCUMENT_ROOT') . '/wp-load.php';
				if (!file_exists($wp_load)) { exit; }
				require $wp_load;
				ob_clean();
				global $wpdb;
				if (!isset($wpdb) || !method_exists($wpdb, 'query')) { exit; }

				// Fix siteurl for WP 1.x where the installer didn't run.
				// The pre-create step set siteurl to 'http://localhost'
				// which doesn't match the Playground's scoped URL.
				// Derive the correct URL from ABSPATH and the scope-based
				// path that WordPress will be served under.
				$_pg_opts = !empty($wpdb->options) ? $wpdb->options : $GLOBALS['table_prefix'] . 'options';
				try {
					$_pg_current = $wpdb->get_var("SELECT option_value FROM {$_pg_opts} WHERE option_name = 'siteurl'");
					if ($_pg_current === 'http://localhost' || empty($_pg_current)) {
						// Use the PLAYGROUND_SITE_URL env if provided, otherwise
						// keep the placeholder — it will be overridden by the
						// first real HTTP request's $_SERVER values.
						$_pg_url = getenv('PLAYGROUND_SITE_URL');
						if ($_pg_url) {
							$wpdb->query("UPDATE {$_pg_opts} SET option_value = '{$_pg_url}' WHERE option_name = 'siteurl'");
							$wpdb->query("UPDATE {$_pg_opts} SET option_value = '{$_pg_url}' WHERE option_name = 'home'");
						}
					}
				} catch (Exception $e) {}

				// Fix admin password for WP < 2.5.
				// Use $wpdb->users if available (WP 1.5+),
				// fall back to $table_prefix . 'users' (WP 1.2).
				$users_table = !empty($wpdb->users) ? $wpdb->users : $GLOBALS['table_prefix'] . 'users';

				// WP 1.2/1.0: the installer may fail to create the
				// users table or the admin user. Create both if missing.
				$wpdb->query("CREATE TABLE IF NOT EXISTS {$users_table} (
					ID int(10) unsigned NOT NULL auto_increment,
					user_login varchar(20) NOT NULL default '',
					user_pass varchar(64) NOT NULL default '',
					user_firstname varchar(50) NOT NULL default '',
					user_lastname varchar(50) NOT NULL default '',
					user_nickname varchar(50) NOT NULL default '',
					user_icq int(10) unsigned NOT NULL default '0',
					user_email varchar(100) NOT NULL default '',
					user_url varchar(100) NOT NULL default '',
					user_ip varchar(15) NOT NULL default '',
					user_domain varchar(200) NOT NULL default '',
					user_browser varchar(200) NOT NULL default '',
					dateYMDhour datetime NOT NULL default '0000-00-00 00:00:00',
					user_level int(2) unsigned NOT NULL default '0',
					user_aim varchar(50) NOT NULL default '',
					user_msn varchar(100) NOT NULL default '',
					user_yim varchar(50) NOT NULL default '',
					user_idmode varchar(20) NOT NULL default '',
					PRIMARY KEY (ID),
					UNIQUE KEY user_login (user_login)
				)");
				if (!$wpdb->get_var("SELECT COUNT(*) FROM {$users_table}")) {
					$now = date('Y-m-d H:i:s');
					$wpdb->query(
						"INSERT INTO {$users_table} (ID, user_login, user_pass, user_email, user_level, dateYMDhour, user_nickname) " .
						"VALUES (1, 'admin', MD5('password'), 'admin@localhost.com', 10, '{$now}', 'admin')"
					);
				}
				$wpdb->query(
					"UPDATE {$users_table} SET user_pass = MD5('password') WHERE user_login = 'admin'"
				);

				// Ensure WordPress roles exist and the admin user has
				// admin capabilities. The installer calls populate_roles()
				// but it may fail on SQLite. Set up roles and user caps
				// directly via database queries as a fallback.
				$p = $GLOBALS['table_prefix'];
				$roles_key = $p . 'user_roles';
				$_diag = array('prefix' => $p, 'roles_key' => $roles_key);
				try {
					$has_roles = $wpdb->get_var(
						"SELECT COUNT(*) FROM {$p}options WHERE option_name = '{$roles_key}'"
					);
					$_diag['has_roles'] = $has_roles;
				} catch (Exception $e) {
					$has_roles = 0;
					$_diag['roles_error'] = $e->getMessage();
				}
				if (!$has_roles) {
					// Minimal administrator role with essential capabilities.
					$roles = array('administrator' => array(
						'name' => 'Administrator',
						'capabilities' => array(
							'switch_themes'=>true, 'edit_themes'=>true,
							'activate_plugins'=>true, 'edit_plugins'=>true,
							'edit_users'=>true, 'edit_files'=>true,
							'manage_options'=>true, 'moderate_comments'=>true,
							'manage_categories'=>true, 'manage_links'=>true,
							'upload_files'=>true, 'import'=>true,
							'unfiltered_html'=>true, 'edit_posts'=>true,
							'edit_others_posts'=>true, 'edit_published_posts'=>true,
							'publish_posts'=>true, 'edit_pages'=>true,
							'read'=>true, 'level_10'=>true, 'level_9'=>true,
							'level_8'=>true, 'level_7'=>true, 'level_6'=>true,
							'level_5'=>true, 'level_4'=>true, 'level_3'=>true,
							'level_2'=>true, 'level_1'=>true, 'level_0'=>true,
							'edit_others_pages'=>true, 'edit_published_pages'=>true,
							'publish_pages'=>true, 'delete_pages'=>true,
							'delete_others_pages'=>true, 'delete_published_pages'=>true,
							'delete_posts'=>true, 'delete_others_posts'=>true,
							'delete_published_posts'=>true, 'delete_private_posts'=>true,
							'edit_private_posts'=>true, 'read_private_posts'=>true,
							'delete_private_pages'=>true, 'edit_private_pages'=>true,
							'read_private_pages'=>true,
						)
					));
					$wpdb->query("INSERT INTO {$p}options (option_name, option_value, autoload) VALUES ('{$roles_key}', '" . addslashes(serialize($roles)) . "', 'yes')");
				}
				// Set admin user capabilities and level in usermeta.
				$um = isset($wpdb->usermeta) ? $wpdb->usermeta : $p . 'usermeta';
				try {
					$has_cap = $wpdb->get_var("SELECT COUNT(*) FROM {$um} WHERE user_id=1 AND meta_key='{$p}capabilities'");
					if (!$has_cap) {
						$cap_val = addslashes(serialize(array('administrator' => true)));
						$wpdb->query("INSERT INTO {$um} (user_id, meta_key, meta_value) VALUES (1, '{$p}capabilities', '{$cap_val}')");
					}
					$has_level = $wpdb->get_var("SELECT COUNT(*) FROM {$um} WHERE user_id=1 AND meta_key='{$p}user_level'");
					if (!$has_level) {
						$wpdb->query("INSERT INTO {$um} (user_id, meta_key, meta_value) VALUES (1, '{$p}user_level', '10')");
					}
				} catch (Exception $e) {
					$_diag['usermeta_error'] = $e->getMessage();
				}
				// Also check usermeta
				try {
					$_diag['all_usermeta'] = $wpdb->get_results(
						"SELECT meta_key, meta_value FROM {$um} WHERE user_id=1", ARRAY_A
					);
				} catch (Exception $e) {
					$_diag['usermeta_read_error'] = $e->getMessage();
				}
				echo 'ROLES_DIAG:' . json_encode($_diag);

				// Seed default content when the posts table is empty.
				// Covers both old WP 1.5 (SQLite NOT NULL fix) and
				// WP 2.5+ where the install may have failed to seed
				// data due to the PHP 5.6 WASM parser bug.
				$posts_table = !empty($wpdb->posts) ? $wpdb->posts : $GLOBALS['table_prefix'] . 'posts';
				$has_posts = false;
				try { $has_posts = (bool)$wpdb->get_var("SELECT COUNT(*) FROM {$posts_table}"); } catch (Exception $e) {}
				if (!$has_posts) {
					$now = date('Y-m-d H:i:s');
					$now_gmt = gmdate('Y-m-d H:i:s');

					// Default category
					if (isset($wpdb->categories)) {
						$wpdb->query("INSERT INTO {$wpdb->categories} (cat_ID, cat_name, category_nicename, category_description, category_parent) VALUES (1, 'Uncategorized', 'uncategorized', '', 0)");
					}

					// Default post — use only basic columns that exist
					// in all WP versions (1.0+).
					$wpdb->query("INSERT INTO {$posts_table} (ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered) VALUES (1, 1, '{$now}', '{$now_gmt}', 'Welcome to WordPress. This is your first post. Edit or delete it, then start blogging!', 'Hello world!', '', 'publish', 'open', 'open', '', 'hello-world', '', '', '{$now}', '{$now_gmt}', '')");

					// Default comment
					if (isset($wpdb->comments)) {
						$wpdb->query("INSERT INTO {$wpdb->comments} (comment_post_ID, comment_author, comment_author_email, comment_author_url, comment_author_IP, comment_date, comment_date_gmt, comment_content, comment_karma, comment_approved, comment_agent, comment_type, comment_parent, user_id) VALUES (1, 'Mr WordPress', '', 'http://wordpress.org', '127.0.0.1', '{$now}', '{$now_gmt}', 'Hi, this is a comment. To delete a comment, just log in and view the post comments. There you will have the option to edit or delete them.', 0, '1', '', '', 0, 0)");
					}

					// Link post to category
					if (isset($wpdb->post2cat)) {
						$wpdb->query("INSERT INTO {$wpdb->post2cat} (rel_id, post_id, category_id) VALUES (1, 1, 1)");
					}
				}
			`,
			env: {
				DOCUMENT_ROOT: php.documentRoot,
				PLAYGROUND_SITE_URL: siteUrl || '',
			},
		});
		// TEMPORARY: Log diagnostic output
		if (result.text.includes('ROLES_DIAG:')) {
			const diagStr = result.text.split('ROLES_DIAG:')[1]?.split('\n')[0];
			logger.warn('Legacy roles diagnostic:', diagStr);
		}
	} catch (error) {
		// Non-fatal: post-install fixups may fail on some WP versions
		logger.warn('Legacy WP post-install fixups failed (non-fatal):', error);
	}

	// Stage 2: PDO fallback for WP 1.x where loading WordPress crashes
	try {
		await php.run({
			code: `<?php
				$db_dir = getenv('DOCUMENT_ROOT') . '/wp-content/database/';
				if (!is_dir($db_dir)) { @mkdir($db_dir, 0777, true); }
				$db_path = $db_dir . '.ht.sqlite';
				// Create database file if it doesn't exist yet
				// (the SQLite driver may have failed to initialize)
				$pdo = new PDO('sqlite:' . $db_path);
				$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

				// Check if admin user exists
				$prefix = 'wp_';
				$table = $prefix . 'users';
				try {
					$count = $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
				} catch (Exception $e) {
					// Table might not exist — create it
					$pdo->exec("CREATE TABLE IF NOT EXISTS {$table} (
						ID INTEGER PRIMARY KEY AUTOINCREMENT,
						user_login TEXT NOT NULL DEFAULT '',
						user_pass TEXT NOT NULL DEFAULT '',
						user_nickname TEXT NOT NULL DEFAULT '',
						user_email TEXT NOT NULL DEFAULT '',
						user_url TEXT NOT NULL DEFAULT '',
						user_ip TEXT NOT NULL DEFAULT '',
						user_domain TEXT NOT NULL DEFAULT '',
						user_browser TEXT NOT NULL DEFAULT '',
						dateYMDhour TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						user_level INTEGER NOT NULL DEFAULT 0,
						user_idmode TEXT NOT NULL DEFAULT '',
						user_firstname TEXT NOT NULL DEFAULT '',
						user_lastname TEXT NOT NULL DEFAULT '',
						user_icq INTEGER NOT NULL DEFAULT 0,
						user_aim TEXT NOT NULL DEFAULT '',
						user_msn TEXT NOT NULL DEFAULT '',
						user_yim TEXT NOT NULL DEFAULT ''
					)");
					$count = 0;
				}
				if ($count == 0) {
					$now = date('Y-m-d H:i:s');
					$pass = md5('password');
					try {
						// Build INSERT with defaults for ALL columns
						$col_info = $pdo->query("PRAGMA table_info({$table})")->fetchAll(PDO::FETCH_ASSOC);
						$known = array(
							'ID' => '1', 'user_login' => "'admin'",
							'user_pass' => "'{$pass}'", 'user_email' => "'admin@localhost.com'",
							'user_level' => '10', 'dateYMDhour' => "'{$now}'",
							'user_nickname' => "'admin'", 'user_nicename' => "'admin'",
							'user_registered' => "'{$now}'", 'user_status' => '0',
						);
						$ins_cols = array(); $ins_vals = array();
						foreach ($col_info as $ci) {
							$cn = $ci['name'];
							$ins_cols[] = $cn;
							if (isset($known[$cn])) {
								$ins_vals[] = $known[$cn];
							} elseif ($ci['dflt_value'] !== null) {
								$ins_vals[] = $ci['dflt_value'];
							} elseif (stripos($ci['type'], 'int') !== false) {
								$ins_vals[] = '0';
							} else {
								$ins_vals[] = "''";
							}
						}
						$pdo->exec("INSERT INTO {$table} (" . implode(',', $ins_cols) . ") VALUES (" . implode(',', $ins_vals) . ")");
					} catch (Exception $e) {}
				} else {
					$pass = md5('password');
					try { $pdo->exec("UPDATE {$table} SET user_pass = '{$pass}' WHERE user_login = 'admin'"); } catch (Exception $e) {}
				}

				// Create essential WP tables if missing. For WP 1.0-1.2,
				// the install may fail to create tables because the
				// SQLite driver can't process the old-style CREATE TABLE
				// through the WordPress query path.
				$now = date('Y-m-d H:i:s');
				$now_gmt = gmdate('Y-m-d H:i:s');
				$tables_sql = array(
					'posts' => "CREATE TABLE IF NOT EXISTS {$prefix}posts (
						ID INTEGER PRIMARY KEY AUTOINCREMENT,
						post_author INTEGER NOT NULL DEFAULT 0,
						post_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_date_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_content TEXT NOT NULL DEFAULT '',
						post_title TEXT NOT NULL DEFAULT '',
						post_category INTEGER NOT NULL DEFAULT 0,
						post_excerpt TEXT NOT NULL DEFAULT '',
						post_status TEXT NOT NULL DEFAULT 'publish',
						comment_status TEXT NOT NULL DEFAULT 'open',
						ping_status TEXT NOT NULL DEFAULT 'open',
						post_password TEXT NOT NULL DEFAULT '',
						post_name TEXT NOT NULL DEFAULT '',
						to_ping TEXT NOT NULL DEFAULT '',
						pinged TEXT NOT NULL DEFAULT '',
						post_modified TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_modified_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_content_filtered TEXT NOT NULL DEFAULT ''
					)",
					'categories' => "CREATE TABLE IF NOT EXISTS {$prefix}categories (
						cat_ID INTEGER PRIMARY KEY AUTOINCREMENT,
						cat_name TEXT NOT NULL DEFAULT '',
						category_nicename TEXT NOT NULL DEFAULT '',
						category_description TEXT NOT NULL DEFAULT '',
						category_parent INTEGER NOT NULL DEFAULT 0
					)",
					'post2cat' => "CREATE TABLE IF NOT EXISTS {$prefix}post2cat (
						rel_id INTEGER PRIMARY KEY AUTOINCREMENT,
						post_id INTEGER NOT NULL DEFAULT 0,
						category_id INTEGER NOT NULL DEFAULT 0
					)",
					'comments' => "CREATE TABLE IF NOT EXISTS {$prefix}comments (
						comment_ID INTEGER PRIMARY KEY AUTOINCREMENT,
						comment_post_ID INTEGER NOT NULL DEFAULT 0,
						comment_author TEXT NOT NULL DEFAULT '',
						comment_author_email TEXT NOT NULL DEFAULT '',
						comment_author_url TEXT NOT NULL DEFAULT '',
						comment_author_IP TEXT NOT NULL DEFAULT '',
						comment_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						comment_date_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						comment_content TEXT NOT NULL DEFAULT '',
						comment_karma INTEGER NOT NULL DEFAULT 0,
						comment_approved TEXT NOT NULL DEFAULT '1',
						comment_agent TEXT NOT NULL DEFAULT '',
						comment_type TEXT NOT NULL DEFAULT '',
						comment_parent INTEGER NOT NULL DEFAULT 0,
						user_id INTEGER NOT NULL DEFAULT 0
					)",
					'options' => "CREATE TABLE IF NOT EXISTS {$prefix}options (
						option_id INTEGER PRIMARY KEY AUTOINCREMENT,
						blog_id INTEGER NOT NULL DEFAULT 0,
						option_name TEXT NOT NULL DEFAULT '',
						option_can_override TEXT NOT NULL DEFAULT 'Y',
						option_type INTEGER NOT NULL DEFAULT 1,
						option_value TEXT NOT NULL DEFAULT '',
						option_width INTEGER NOT NULL DEFAULT 20,
						option_height INTEGER NOT NULL DEFAULT 8,
						option_description TEXT NOT NULL DEFAULT '',
						option_admin_level INTEGER NOT NULL DEFAULT 1,
						autoload TEXT NOT NULL DEFAULT 'yes'
					)",
					'postmeta' => "CREATE TABLE IF NOT EXISTS {$prefix}postmeta (
						meta_id INTEGER PRIMARY KEY AUTOINCREMENT,
						post_id INTEGER NOT NULL DEFAULT 0,
						meta_key TEXT NOT NULL DEFAULT '',
						meta_value TEXT NOT NULL DEFAULT ''
					)",
					'links' => "CREATE TABLE IF NOT EXISTS {$prefix}links (
						link_id INTEGER PRIMARY KEY AUTOINCREMENT,
						link_url TEXT NOT NULL DEFAULT '',
						link_name TEXT NOT NULL DEFAULT '',
						link_description TEXT NOT NULL DEFAULT '',
						link_visible TEXT NOT NULL DEFAULT 'Y',
						link_owner INTEGER NOT NULL DEFAULT 1,
						link_rating INTEGER NOT NULL DEFAULT 0,
						link_rel TEXT NOT NULL DEFAULT '',
						link_updated TEXT NOT NULL DEFAULT '0000-00-00 00:00:00'
					)",
					'linkcategories' => "CREATE TABLE IF NOT EXISTS {$prefix}linkcategories (
						cat_id INTEGER PRIMARY KEY AUTOINCREMENT,
						cat_name TEXT NOT NULL DEFAULT '',
						auto_toggle TEXT NOT NULL DEFAULT 'N',
						show_images TEXT NOT NULL DEFAULT 'Y',
						show_description TEXT NOT NULL DEFAULT 'N',
						show_rating TEXT NOT NULL DEFAULT 'Y',
						show_updated TEXT NOT NULL DEFAULT 'Y',
						sort_order TEXT NOT NULL DEFAULT 'name',
						sort_desc TEXT NOT NULL DEFAULT 'ASC',
						text_before_link TEXT NOT NULL DEFAULT '<li>',
						text_after_link TEXT NOT NULL DEFAULT '<br />',
						text_after_all TEXT NOT NULL DEFAULT '</li>',
						list_limit INTEGER NOT NULL DEFAULT -1
					)"
				);
				foreach ($tables_sql as $t => $sql) {
					try { $pdo->exec($sql); } catch (Exception $e) {}
				}
				// Add missing columns to existing tables (for WP 1.0-1.2
				// where the install creates tables with fewer columns).
				$alter_cols = array(
					'categories' => array(
						'category_nicename' => "TEXT NOT NULL DEFAULT ''",
						'category_description' => "TEXT NOT NULL DEFAULT ''",
						'category_parent' => "INTEGER NOT NULL DEFAULT 0",
					),
				);
				foreach ($alter_cols as $t => $cols_to_add) {
					try {
						$existing = $pdo->query("PRAGMA table_info({$prefix}{$t})")->fetchAll(PDO::FETCH_COLUMN, 1);
						foreach ($cols_to_add as $col => $type) {
							if (!in_array($col, $existing)) {
								$pdo->exec("ALTER TABLE {$prefix}{$t} ADD COLUMN {$col} {$type}");
							}
						}
					} catch (Exception $e) {}
				}
				// Seed default data — use dynamic column detection
				// to handle varying schemas across WP versions.
				try {
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}posts")->fetchColumn()) {
						$post_cols = $pdo->query("PRAGMA table_info({$prefix}posts)")->fetchAll(PDO::FETCH_COLUMN, 1);
						$post_vals = array(
							'ID' => '1', 'post_author' => '1',
							'post_date' => "'{$now}'", 'post_date_gmt' => "'{$now_gmt}'",
							'post_content' => "'Welcome to WordPress. This is your first post. Edit or delete it, then start blogging!'",
							'post_title' => "'Hello world!'", 'post_excerpt' => "''",
							'post_status' => "'publish'", 'comment_status' => "'open'",
							'ping_status' => "'open'", 'post_password' => "''",
							'post_name' => "'hello-world'", 'to_ping' => "''", 'pinged' => "''",
							'post_modified' => "'{$now}'", 'post_modified_gmt' => "'{$now_gmt}'",
							'post_content_filtered' => "''",
						);
						$ins_c = array(); $ins_v = array();
						foreach ($post_vals as $c => $v) {
							if (in_array($c, $post_cols)) { $ins_c[] = $c; $ins_v[] = $v; }
						}
						if ($ins_c) $pdo->exec("INSERT INTO {$prefix}posts (" . implode(',', $ins_c) . ") VALUES (" . implode(',', $ins_v) . ")");
					}
				} catch (Exception $e) {}
				try {
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}categories")->fetchColumn()) {
						$pdo->exec("INSERT INTO {$prefix}categories (cat_ID, cat_name, category_nicename, category_description, category_parent) VALUES (1, 'Uncategorized', 'uncategorized', '', 0)");
					}
				} catch (Exception $e) {}
				try {
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}options WHERE option_name='siteurl'")->fetchColumn()) {
						$site = getenv('PLAYGROUND_SITE_URL') ?: 'http://localhost';
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('siteurl', '{$site}')");
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('blogname', 'My WordPress Website')");
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('blogdescription', 'Just another WordPress weblog')");
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('home', '{$site}')");
					}
				} catch (Exception $e) {}
			`,
			env: {
				DOCUMENT_ROOT: php.documentRoot,
				PLAYGROUND_SITE_URL: siteUrl || '',
			},
		});
	} catch (error) {
		// Non-fatal: PDO fallback may fail if SQLite isn't available
		logger.warn('Legacy WP PDO fallback failed (non-fatal):', error);
	}
}

/**
 * Patches the SQLite integration plugin files for PHP 5.6 compatibility
 * by removing PHP 7.0+ syntax features.
 */
export async function patchSqlitePluginForLegacyPhp(
	php: UniversalPHP,
	pluginFolder: string
) {
	// Known subdirectory structure of the SQLite integration plugin.
	// We enumerate these statically to avoid php.run()+scandir which
	// hangs on NODEFS.
	const knownDirs = [
		'',
		'wp-includes/sqlite',
		'wp-includes/database',
		'wp-includes/database/sqlite',
		'wp-includes/database/parser',
		'wp-includes/database/mysql',
		'integrations/query-monitor',
	];
	for (const subDir of knownDirs) {
		const dir = subDir ? joinPaths(pluginFolder, subDir) : pluginFolder;
		let entries: string[];
		try {
			entries = await php.listFiles(dir);
		} catch {
			continue; // Directory doesn't exist
		}
		for (const entry of entries) {
			if (!entry.endsWith('.php')) continue;
			const filePath = joinPaths(dir, entry);
			let content = await php.readFileAsText(filePath);
			const original = content;

			content = stripPhp7TypeDeclarations(content);
			content = replaceNullCoalescing(content);
			content = replacePhp7ErrorClasses(content);

			// Replace dirname(__DIR__, N) with nested dirname() calls.
			// Do this BEFORE the __DIR__ replacement below.
			content = content.replace(
				/dirname\(\s*__DIR__\s*,\s*(\d+)\s*\)/g,
				(_, levels) => {
					let r = '__DIR__';
					for (let i = 0; i < parseInt(levels, 10); i++) {
						r = `dirname(${r})`;
					}
					return r;
				}
			);

			// Replace __DIR__ with the file's actual absolute directory
			// path. When these files are loaded via eval() (to work
			// around the PHP 5.6 WASM parser bug), __DIR__ resolves
			// to the eval caller's directory instead of the file's
			// own directory, breaking all relative path references.
			content = content.replace(/__DIR__/g, `'${dir}'`);

			// Replace `require self::CONST` with eval equivalent.
			// The grammar loader uses `require self::MYSQL_GRAMMAR_PATH`
			// as an expression (returns the file's return value).
			// eval() also returns the value from `return` in eval'd code.
			content = content.replace(
				/require\s+(self::\w+)/g,
				(_match, constRef) =>
					`eval('?>' . file_get_contents(${constRef}))`
			);

			// Replace __() and _e() calls with their string argument.
			// These WordPress translation functions aren't available
			// when the SQLite integration loads from the preload
			// (before WordPress's l10n.php).
			content = content.replace(
				/\b__\(\s*'([^']+)'(?:\s*,\s*'[^']*')?\s*\)/g,
				"'$1'"
			);
			content = content.replace(
				/\b_e\(\s*'([^']+)'(?:\s*,\s*'[^']*')?\s*\)/g,
				"echo '$1'"
			);

			// Rename 'throw' method (reserved word in PHP 5.6)
			content = content
				.replace(/function throw\(/g, 'function throwError(')
				.replace(/\$this->throw\(/g, '$this->throwError(')
				.replace(/self::throw\(/g, 'self::throwError(')
				// Update string references in method mapping arrays
				.replace(/'throw'(\s*=>\s*)'throw'/g, "'throw'$1'throwError'");

			if (content !== original) {
				await php.writeFile(filePath, content);
			}
		}
	}

	await replaceRequiresWithEval(php, pluginFolder);
}

// ── Private helpers ──────────────────────────────────────────────

/** WP < 1.5 lacks wp-includes/version.php. Create a stub. */
async function ensureVersionPhp(php: PHP, documentRoot: string) {
	const wpIncludesDir = joinPaths(documentRoot, 'wp-includes');
	if (!php.isDir(wpIncludesDir)) return;
	const versionPhpPath = joinPaths(wpIncludesDir, 'version.php');
	if (!php.fileExists(versionPhpPath)) {
		await php.writeFile(versionPhpPath, `<?php $wp_version = '1.0';`);
	}
}

/**
 * Patches WP 1.0.2 SQL-emission bugs that break the SQLite
 * integration's AST parser.
 *
 * Two problems on WP 1.0.2:
 *
 * 1. wp-blog-header.php line 303 builds the main query with:
 *        $where .= ' AND (post_status = "publish"';
 *    MySQL accepts double quotes as string delimiters unless
 *    ANSI_QUOTES mode is enabled, but the SQLite integration's
 *    AST parser treats DOUBLE_QUOTED_TEXT as an identifier, not a
 *    string literal. The WHERE clause is rejected and every
 *    front-page request fails with "Failed to parse the MySQL
 *    query". Replace with single quotes, which the parser accepts
 *    as SINGLE_QUOTED_TEXT.
 *
 * 2. wp-includes/vars.php line 272 does:
 *        add_filter('all', 'wptexturize');
 *    This registers wptexturize as a callback on the "all" filter,
 *    which means EVERY apply_filters() call in WP 1.0.2 runs its
 *    input through wptexturize — including SQL date literals. The
 *    result is that 'publish' becomes &#8216;publish&#8217; (smart
 *    quotes) and the AST parser rejects the query. WP 1.2 fixed
 *    this by hooking wptexturize to specific content filters
 *    (the_content, the_title, etc.) instead of 'all'. Remove the
 *    'all' hook entirely — we lose pretty quotes in content but
 *    gain working SQL, which is a reasonable tradeoff for a
 *    20-year-old WP version.
 */
async function patchWp10DoubleQuotedSqlLiterals(
	php: PHP,
	documentRoot: string
) {
	const blogHeaderPath = joinPaths(documentRoot, 'wp-blog-header.php');
	if (php.fileExists(blogHeaderPath)) {
		const content = php.readFileAsText(blogHeaderPath);
		const needle = `$where .= ' AND (post_status = "publish"';`;
		if (content.includes(needle)) {
			await php.writeFile(
				blogHeaderPath,
				content.replace(
					needle,
					`$where .= " AND (post_status = 'publish'";`
				)
			);
		}
	}

	const varsPhpPath = joinPaths(documentRoot, 'wp-includes/vars.php');
	if (php.fileExists(varsPhpPath)) {
		const varsContent = php.readFileAsText(varsPhpPath);
		const allFilterHook = `add_filter('all', 'wptexturize');`;
		if (varsContent.includes(allFilterHook)) {
			await php.writeFile(
				varsPhpPath,
				varsContent.replace(
					allFilterHook,
					`// ${allFilterHook} // Disabled by Playground: mangles SQL literals.`
				)
			);
		}
	}
}

/** WP < 2.0 lacks wp-load.php. Create a shim that loads wp-config.php. */
async function ensureWpLoadPhp(php: PHP, documentRoot: string) {
	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	if (!php.fileExists(wpLoadPath)) {
		await php.writeFile(
			wpLoadPath,
			`<?php
if ( !defined('ABSPATH') ) {
	define('ABSPATH', dirname(__FILE__) . '/');
}
require_once(ABSPATH . 'wp-config.php');
`
		);
	}
}

/** Patches wp-settings.php for deprecated functions, syntax, etc. */
async function patchWpSettingsPhp(
	php: PHP,
	documentRoot: string,
	phpMajor: number
) {
	const wpSettingsPath = joinPaths(documentRoot, 'wp-settings.php');
	if (!php.fileExists(wpSettingsPath)) return;

	let settings = php.readFileAsText(wpSettingsPath);
	let settingsChanged = false;

	if (settings.includes("extension_loaded('mysql')")) {
		settings = settings.replace(
			/if\s*\(\s*!extension_loaded\('mysql'\)\s*\)\s*\n\s*die/,
			'if ( false ) // Patched for SQLite\n\tdie'
		);
		settingsChanged = true;
	}

	// Patch error_reporting() to also exclude E_DEPRECATED and E_STRICT.
	{
		settings = settings.replace(
			/error_reporting\((E_ALL(?:\s*\^[^)]*)?)\)/g,
			(_match, flags) => {
				if (
					flags.includes('E_DEPRECATED') &&
					flags.includes('E_STRICT')
				) {
					return _match;
				}
				let newFlags = flags;
				if (!flags.includes('E_DEPRECATED')) {
					newFlags += ' ^ E_DEPRECATED';
				}
				if (!flags.includes('E_STRICT')) {
					newFlags += ' ^ E_STRICT';
				}
				return `error_reporting(${newFlags})`;
			}
		);
		settingsChanged = true;
	}

	// set_magic_quotes_runtime() removed in PHP 7.0.
	if (settings.includes('set_magic_quotes_runtime')) {
		settings = settings.replace(
			/set_magic_quotes_runtime\(\s*0\s*\)\s*;/g,
			'// set_magic_quotes_runtime(0); // Removed'
		);
		settingsChanged = true;
	}

	// get_magic_quotes_gpc() removed in PHP 8.0.
	if (
		settings.includes('get_magic_quotes_gpc()') &&
		!settings.includes("function_exists('get_magic_quotes_gpc')")
	) {
		settings = settings.replace(
			/get_magic_quotes_gpc\(\)/g,
			"(function_exists('get_magic_quotes_gpc') && get_magic_quotes_gpc())"
		);
		settingsChanged = true;
	}

	// "=& new" triggers compile-time E_DEPRECATED in PHP 5.3+.
	if (settings.includes('=& new') || settings.includes('=&new')) {
		settings = settings.replace(/=\s*&\s*new\b/g, '= new');
		settingsChanged = true;
	}

	// $HTTP_SERVER_VARS removed in PHP 5.4.
	if (settings.includes('$HTTP_SERVER_VARS')) {
		settings = settings.replace(/\$HTTP_SERVER_VARS/g, '$_SERVER');
		settingsChanged = true;
	}

	// WP_CONTENT_DIR missing in WP < 2.0.
	if (
		!settings.includes('WP_CONTENT_DIR') &&
		settings.includes("define('WPINC'")
	) {
		settings = settings.replace(
			/define\('WPINC',\s*'wp-includes'\);/,
			`define('WPINC', 'wp-includes');\nif (!defined('WP_CONTENT_DIR')) define('WP_CONTENT_DIR', ABSPATH . 'wp-content');`
		);
		settingsChanged = true;
	}

	// WP 1.x "not installed" die() check.
	if (
		settings.includes(
			"die(\"It doesn't look like you've installed WP yet"
		) ||
		settings.includes(
			"die(\"It doesn\\'t look like you\\'ve installed WP yet"
		)
	) {
		if (phpMajor < 7) {
			settings = settings.replace(
				/\bdie\([^)]*installed WP[^)]*\);/,
				'/* die removed by Playground */'
			);
		} else {
			settings = settings.replace(
				/if\s*\(\s*!\$users\s*&&\s*!strstr\([^)]+\)\s*\)/,
				"if (!$users && !strstr($_SERVER['PHP_SELF'], 'install.php') && !defined('WP_INSTALLING'))"
			);
		}
		settingsChanged = true;
	}

	// PHP 5.6 WASM parser bug: skip large includes for WP 2.8-2.9.
	if (
		phpMajor < 7 &&
		settings.includes("/widgets.php'") &&
		!settings.includes("/nav-menu.php'") &&
		!settings.includes("/post-thumbnail-template.php'")
	) {
		for (const skipInclude of ['deprecated.php', 'http.php']) {
			const re = new RegExp(
				`require\\s*\\(\\s*ABSPATH\\s*\\.\\s*WPINC\\s*\\.\\s*'/${skipInclude}'\\s*\\)\\s*;`
			);
			if (re.test(settings)) {
				settings = settings.replace(
					re,
					`// Skipped for PHP 5.6 parser size limit`
				);
				settingsChanged = true;
			}
		}
	}

	if (settingsChanged) {
		await php.writeFile(wpSettingsPath, settings);
	}

	// PHP 5.6 WASM parser bug: large PHP files fail to parse silently.
	// Strip doc comments and unnecessary whitespace from all PHP files
	// in wp-includes and wp-admin/includes to bring them below the
	// parser size threshold.
	if (phpMajor < 7) {
		await stripDocCommentsFromWpIncludes(php, documentRoot);
	}
}

/** Patches wp-includes/functions.php. */
async function patchWpFunctionsPhp(php: PHP, documentRoot: string) {
	const functionsPhpPath = joinPaths(
		documentRoot,
		'wp-includes/functions.php'
	);
	if (!php.fileExists(functionsPhpPath)) return;

	let functionsPhp = php.readFileAsText(functionsPhpPath);
	let functionsPhpChanged = false;

	// WP 1.5: $all_options not initialized as object.
	if (
		functionsPhp.includes('$all_options->{$option->option_name}') &&
		!functionsPhp.includes('$all_options = new stdClass')
	) {
		functionsPhp = functionsPhp.replace(
			'foreach ($options as $option) {',
			'$all_options = new stdClass;\n\tforeach ($options as $option) {'
		);
		functionsPhpChanged = true;
	}

	// PHP 5.6 WASM parser bug: eval db.php instead of require_once.
	// WP 2.6+:
	if (
		functionsPhp.includes('function require_wp_db()') &&
		functionsPhp.includes("require_once( WP_CONTENT_DIR . '/db.php' )")
	) {
		functionsPhp = functionsPhp.replace(
			"require_once( WP_CONTENT_DIR . '/db.php' )",
			`eval('?>' . file_get_contents( WP_CONTENT_DIR . '/db.php' ))`
		);
		functionsPhpChanged = true;
	}
	// WP 2.5:
	if (
		functionsPhp.includes('function require_wp_db()') &&
		functionsPhp.includes("require_once( ABSPATH . 'wp-content/db.php' )")
	) {
		functionsPhp = functionsPhp.replace(
			"require_once( ABSPATH . 'wp-content/db.php' )",
			`eval('?>' . file_get_contents( ABSPATH . 'wp-content/db.php' ))`
		);
		functionsPhpChanged = true;
	}

	if (functionsPhpChanged) {
		await php.writeFile(functionsPhpPath, functionsPhp);
	}
}

/** Patches wp-admin/install.php for old WP versions. */
async function patchWpInstallPhp(php: PHP, documentRoot: string) {
	const installPhpPath = joinPaths(documentRoot, 'wp-admin/install.php');
	if (!php.fileExists(installPhpPath)) return;

	let installPhp = php.readFileAsText(installPhpPath);
	let installPhpChanged = false;

	// Fix relative paths to absolute.
	if (
		installPhp.includes("'../wp-config.php'") ||
		installPhp.includes("'../wp-load.php'")
	) {
		const absAdminDir = joinPaths(documentRoot, 'wp-admin');
		const absRoot = documentRoot;
		installPhp = installPhp
			.replace(/'\.\.\/(wp-config\.php)'/g, `'${absRoot}/$1'`)
			.replace(/'\.\.\/(wp-load\.php)'/g, `'${absRoot}/$1'`)
			.replace(/'\.\/(upgrade-functions\.php)'/g, `'${absAdminDir}/$1'`)
			.replace(/'(upgrade-functions\.php)'/g, `'${absAdminDir}/$1'`)
			.replace(/'\.\/(includes\/upgrade\.php)'/g, `'${absAdminDir}/$1'`)
			.replace(/'\.\.\/(wp-includes\/[^']+)'/g, `'${absRoot}/$1'`);
		installPhpChanged = true;
	}

	// $HTTP_GET_VARS/$HTTP_POST_VARS removed in PHP 5.4.
	if (installPhp.includes('$HTTP_GET_VARS')) {
		installPhp = installPhp.replace(/\$HTTP_GET_VARS/g, '$_GET');
		installPhpChanged = true;
	}
	if (installPhp.includes('$HTTP_POST_VARS')) {
		installPhp = installPhp.replace(/\$HTTP_POST_VARS/g, '$_POST');
		installPhpChanged = true;
	}

	// WP 1.x multi-step installer: combine steps into single request.
	if (
		installPhp.includes('mysql_list_tables') &&
		installPhp.includes('switch($step)')
	) {
		installPhp = installPhp.replace(
			/^(if\s*\(isset\(\$_GET\['step'\]\)\)\s*\n\s*\$step\s*=\s*\$_GET\['step'\];\s*\n\s*else\s*\n\s*\$step\s*=\s*0;)/m,
			`$1\n// Playground: run all install steps in one request\nif ($step >= 1) $step = 1;`
		);
		installPhp = installPhp.replace(
			/^(\$step\s*=\s*\$_GET\['step'\];\s*\n\s*if\s*\(!\$step\)\s*\$step\s*=\s*0;)/m,
			`$1\n// Playground: run all install steps in one request\nif ($step >= 1) $step = 1;`
		);
		installPhp = installPhp.replace(
			/break;\s*\n(\s*case\s+2\s*:)/,
			'// break; // Playground: fall through\n$1'
		);
		installPhp = installPhp.replace(
			/break;\s*\n(\s*case\s+3\s*:)/,
			'// break; // Playground: fall through\n$1'
		);
		installPhpChanged = true;
	}

	if (installPhpChanged) {
		await php.writeFile(installPhpPath, installPhp);
	}
}

/** Patches wp-includes/wp-db.php (wpdb class). */
async function patchWpDbPhp(php: PHP, documentRoot: string) {
	const wpDbPath = joinPaths(documentRoot, 'wp-includes/wp-db.php');
	if (!php.fileExists(wpDbPath)) return;

	let wpDb = php.readFileAsText(wpDbPath);
	let wpDbChanged = false;

	// Guard $wpdb creation so the lazy loader isn't overwritten.
	if (
		wpDb.includes(
			'$wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);'
		) &&
		!wpDb.includes('isset($wpdb)')
	) {
		wpDb = wpDb.replace(
			'$wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);',
			'if ( !isset($wpdb) ) { $wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST); }'
		);
		wpDbChanged = true;
	}

	// Old wpdb (< 3.0) calls mysql_connect() inline — patch to
	// call db_connect() when available (i.e., WP_SQLite_DB).
	if (!wpDb.includes('db_connect')) {
		const mysqlConnectPattern =
			/\$this->dbh\s*=\s*@mysql_connect\(\$dbhost\s*,\s*\$dbuser\s*,\s*\$dbpassword(?:\s*,\s*true)?\);/;
		if (mysqlConnectPattern.test(wpDb)) {
			wpDb = wpDb.replace(
				mysqlConnectPattern,
				'if (method_exists($this, "db_connect")) { $this->dbname = $dbname; $this->db_connect(); } else { $this->dbh = @mysql_connect($dbhost, $dbuser, $dbpassword); }'
			);
			wpDbChanged = true;
		}
	}

	// Inject method polyfills for old wpdb classes.
	{
		const polyfills: string[] = [];
		if (!wpDb.includes('function set_prefix')) {
			polyfills.push(`
	function set_prefix($prefix) {
		$this->prefix = $prefix;
		$tables = array('posts', 'users', 'categories', 'post2cat', 'comments', 'link2cat', 'links', 'options', 'postmeta', 'usermeta', 'terms', 'term_taxonomy', 'term_relationships');
		foreach ($tables as $t) {
			$this->$t = $prefix . $t;
		}
		return $prefix;
	}`);
		}
		if (!wpDb.includes('function timer_start')) {
			polyfills.push(`
	function timer_start() {
		$this->time_start = microtime(true);
		return true;
	}`);
		}
		if (!wpDb.includes('function timer_stop')) {
			polyfills.push(`
	function timer_stop() {
		return microtime(true) - $this->time_start;
	}`);
		}
		if (!wpDb.includes('function init_charset')) {
			polyfills.push(`
	function init_charset() {
		if (defined('DB_CHARSET')) $this->charset = DB_CHARSET;
		if (defined('DB_COLLATE')) $this->collate = DB_COLLATE;
	}`);
		}
		if (!wpDb.includes('function bail')) {
			polyfills.push(`
	function bail($message, $error_code = '500') {
		die($message);
	}`);
		}
		if (!wpDb.includes('function check_connection')) {
			polyfills.push(`
	function check_connection($allow_bail = true) {
		return true;
	}`);
		}
		if (polyfills.length > 0) {
			const classEndMatch = wpDb.match(
				/^(\s*})\s*\n+(\$wpdb|\?>\s*$|if\s*\(\s*!\s*isset\(\s*\$wpdb\s*\))/m
			);
			if (classEndMatch && classEndMatch.index !== undefined) {
				const polyfillBlock =
					'\n\t// Polyfills added by WordPress Playground.\n' +
					polyfills.join('\n') +
					'\n\n';
				wpDb =
					wpDb.substring(0, classEndMatch.index) +
					polyfillBlock +
					wpDb.substring(classEndMatch.index);
				wpDbChanged = true;
			}
		}
	}

	if (wpDbChanged) {
		await php.writeFile(wpDbPath, wpDb);
	}
}

/**
 * Fixes relative paths in wp-admin files so they work regardless of CWD.
 *
 * Old WordPress (< 3.7) uses relative paths like `require('../wp-load.php')`
 * and `require('./admin.php')` in wp-admin scripts. These fail in the
 * Playground because PHP's CWD is set to the document root, not the
 * script's directory. Modern WordPress uses `dirname(__FILE__)` instead.
 */
async function patchWpAdminRelativePaths(php: PHP, documentRoot: string) {
	// Generic fix: replace all relative requires in wp-admin PHP files
	// with dirname(__FILE__)-based absolute paths. This handles WP 1.2
	// through 3.6 where many files use './file.php' or '../file.php'.
	const wpAdminDir = joinPaths(documentRoot, 'wp-admin');
	if (php.isDir(wpAdminDir)) {
		for (const file of php.listFiles(wpAdminDir)) {
			if (!file.endsWith('.php')) continue;
			const filePath = joinPaths(wpAdminDir, file);
			const content = php.readFileAsText(filePath);
			const patched = content
				// ../path — parent directory
				.replace(
					/require(?:_once)?\s*\(\s*'(\.\.\/[^']+)'\s*\)/g,
					(_, path) => `require_once(dirname(__FILE__) . '/${path}')`
				)
				// ./path — current directory (explicit)
				.replace(
					/require(?:_once)?\s*\(\s*'(\.\/[^']+)'\s*\)/g,
					(_, path) => `require_once(dirname(__FILE__) . '/${path}')`
				)
				// require ('file.php') — space before parens
				.replace(
					/require(?:_once)?\s+\('(\.\.\/[^']+)'\)/g,
					(_, path) => `require_once(dirname(__FILE__) . '/${path}')`
				)
				// Bare filename without ./ prefix (e.g. 'admin-header.php').
				// Only match filenames ending in .php to avoid false positives.
				.replace(
					/require(?:_once)?\s*\(\s*'([a-z][\w-]*\.php)'\s*\)/g,
					(_, path) => `require_once(dirname(__FILE__) . '/${path}')`
				)
				.replace(
					/require(?:_once)?\s+\('([a-z][\w-]*\.php)'\)/g,
					(_, path) => `require_once(dirname(__FILE__) . '/${path}')`
				)
				// Fix ABSPATH . '/path' → ABSPATH . 'path' (removes double slash)
				.replace(/ABSPATH\s*\.\s*'\/wp-/g, "ABSPATH . 'wp-");
			if (patched !== content) {
				await php.writeFile(filePath, patched);
			}
		}
	}

	// Specific patches for patterns the generic fix above can't handle
	// (e.g., require without parentheses, unusual spacing).
	const patches: Array<{ file: string; from: RegExp; to: string }> = [
		// WP < 2.6: require_once('../wp-config.php') in admin.php
		{
			file: 'wp-admin/admin.php',
			from: /require_once\s*\(\s*'\.\.\/wp-config\.php'\s*\)/,
			to: "require_once(dirname(__FILE__) . '/../wp-config.php')",
		},
		// WP 2.6-2.9: require_once('../wp-load.php') in admin.php
		{
			file: 'wp-admin/admin.php',
			from: /require_once\s*\(\s*'\.\.\/wp-load\.php'\s*\)/,
			to: "require_once(dirname(__FILE__) . '/../wp-load.php')",
		},
		// WP 3.0-3.6: require_once('./admin.php') in index.php and index-extra.php
		{
			file: 'wp-admin/index.php',
			from: /require_once\s*\(\s*'\.\/admin\.php'\s*\)/,
			to: "require_once(dirname(__FILE__) . '/admin.php')",
		},
		{
			file: 'wp-admin/index-extra.php',
			from: /require_once\s*\(\s*'\.\/admin\.php'\s*\)/,
			to: "require_once(dirname(__FILE__) . '/admin.php')",
		},
		// WP 3.0: require('./includes/dashboard.php') in index-extra.php
		{
			file: 'wp-admin/index-extra.php',
			from: /require\s*\(\s*'\.\/includes\/dashboard\.php'\s*\)/,
			to: "require(dirname(__FILE__) . '/includes/dashboard.php')",
		},
		// WP < 3.7: require[_once]('./admin-header.php') in index.php
		{
			file: 'wp-admin/index.php',
			from: /require(?:_once)?\s*\(\s*'\.\/admin-header\.php'\s*\)/,
			to: "require_once(dirname(__FILE__) . '/admin-header.php')",
		},
		// WP < 3.7: require[_once]('./admin-footer.php') in index.php
		{
			file: 'wp-admin/index.php',
			from: /require(?:_once)?\s*\(\s*'\.\/admin-footer\.php'\s*\)/,
			to: "require_once(dirname(__FILE__) . '/admin-footer.php')",
		},
		// WP 1.x: require('../wp-config.php') in index.php
		{
			file: 'wp-admin/index.php',
			from: /require\s*\(\s*'\.\.\/wp-config\.php'\s*\)/,
			to: "require(dirname(__FILE__) . '/../wp-config.php')",
		},
	];

	for (const { file, from, to } of patches) {
		const filePath = joinPaths(documentRoot, file);
		if (!php.fileExists(filePath)) continue;
		const content = php.readFileAsText(filePath);
		if (from.test(content)) {
			await php.writeFile(filePath, content.replace(from, to));
		}
	}

	// WP 1.2: index.php redirects using get_settings('siteurl') which
	// may be 'http://localhost' (wrong host for the Playground). Replace
	// with relative redirects that work regardless of siteurl.
	const indexPhpPath = joinPaths(documentRoot, 'wp-admin/index.php');
	if (php.fileExists(indexPhpPath)) {
		let indexPhp = php.readFileAsText(indexPhpPath);
		if (indexPhp.includes("get_settings('siteurl')")) {
			indexPhp = indexPhp.replace(
				/get_settings\('siteurl'\)\s*\.\s*'\/wp-admin\//g,
				"'"
			);
			await php.writeFile(indexPhpPath, indexPhp);
		}
	}

	// WP 1.0.2 wp-admin/menu.php reads the admin menu definition from
	// a relative path: `$menu = file('./menu.txt');`. The CWD during
	// a Playground request is the document root (/wordpress), not
	// wp-admin, so ./menu.txt resolves to /wordpress/menu.txt and
	// fails. Rewrite to an absolute path relative to the menu.php
	// file location.
	const menuPhpPath = joinPaths(documentRoot, 'wp-admin/menu.php');
	if (php.fileExists(menuPhpPath)) {
		const menuPhp = php.readFileAsText(menuPhpPath);
		const needle = `file('./menu.txt')`;
		if (menuPhp.includes(needle)) {
			await php.writeFile(
				menuPhpPath,
				menuPhp.replace(needle, `file(dirname(__FILE__) . '/menu.txt')`)
			);
		}
	}
}

/**
 * Writes a mu-plugin that forces admin authentication for legacy PHP.
 *
 * On old WordPress (< 3.5), the auth cookies set during auto-login
 * may not validate correctly for the admin area. This mu-plugin
 * re-generates auth cookies on every admin/login request, populating
 * $_COOKIE directly so that auth_redirect() finds valid cookies.
 *
 * Written to wp-content/mu-plugins/ (real WP mu-plugins directory)
 * rather than /internal/shared/mu-plugins/ because the internal
 * mu-plugins load via the muplugins_loaded hook, which fires after
 * wp_get_mu_plugins() but may not work reliably on all old WP.
 */

/**
 * Replaces update check files with no-op stubs for legacy PHP.
 *
 * Old WordPress update functions (wp_version_check, wp_update_plugins,
 * etc.) call wp_remote_get() which may not be available when the WASM
 * parser fails on large files like http.php. Since we don't want to
 * offer WP upgrades for legacy versions anyway, just stub them out.
 */
async function disableUpdateChecks(php: PHP, documentRoot: string) {
	// wp-includes/update.php — loaded by wp-settings.php on every request
	const wpIncUpdate = joinPaths(documentRoot, 'wp-includes/update.php');
	if (php.fileExists(wpIncUpdate)) {
		await php.writeFile(
			wpIncUpdate,
			`<?php
// Stubbed by Playground — update checks disabled for legacy PHP.
if (!function_exists('wp_version_check')) {
	function wp_version_check() {}
}
if (!function_exists('wp_update_plugins')) {
	function wp_update_plugins() {}
}
if (!function_exists('wp_update_themes')) {
	function wp_update_themes() {}
}
if (!function_exists('wp_check_php_version')) {
	function wp_check_php_version() { return false; }
}
`
		);
	}

	// wp-admin/includes/update.php — loaded by admin includes
	const wpAdminUpdate = joinPaths(
		documentRoot,
		'wp-admin/includes/update.php'
	);
	if (php.fileExists(wpAdminUpdate)) {
		await php.writeFile(
			wpAdminUpdate,
			`<?php
// Stubbed by Playground — update checks disabled for legacy PHP.
if (!function_exists('wp_update_core')) {
	function wp_update_core() {}
}
if (!function_exists('wp_update_plugin')) {
	function wp_update_plugin() {}
}
if (!function_exists('wp_update_theme')) {
	function wp_update_theme() {}
}
`
		);
	}
}

async function ensureLegacyAdminAuth(php: PHP, documentRoot: string) {
	const muDir = joinPaths(documentRoot, 'wp-content/mu-plugins');
	if (!php.isDir(muDir)) {
		php.mkdir(muDir);
	}
	await php.writeFile(
		joinPaths(muDir, '0-legacy-admin-auth.php'),
		`<?php
if (!defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) return;
function playground_legacy_admin_auth() {
	if (empty($_SERVER['REQUEST_URI'])) return;
	if (strpos($_SERVER['REQUEST_URI'], 'wp-admin') === false &&
	    strpos($_SERVER['REQUEST_URI'], 'wp-login') === false) return;

	$username = PLAYGROUND_AUTO_LOGIN_AS_USER;

	// WP 2.5+ auth system: HMAC-based auth cookies.
	if (function_exists('wp_generate_auth_cookie')) {
		$user = function_exists('get_user_by')
			? get_user_by('login', $username)
			: (function_exists('get_userdatabylogin')
				? get_userdatabylogin($username) : null);
		if (!$user) return;

		wp_set_current_user($user->ID, $user->user_login);
		$expiration = time() + 172800;
		if (defined('AUTH_COOKIE'))
			$_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'auth');
		if (defined('SECURE_AUTH_COOKIE'))
			$_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'secure_auth');
		if (defined('LOGGED_IN_COOKIE'))
			$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'logged_in');
		if (!headers_sent()) {
			wp_set_auth_cookie($user->ID);
		}
		return;
	}

	// WP < 2.5 auth system: USER_COOKIE + PASS_COOKIE with
	// double-md5 hashed password. The admin password is 'password'
	// (set during legacy WP installation).
	if (defined('USER_COOKIE') && defined('PASS_COOKIE')) {
		$_COOKIE[USER_COOKIE] = $username;
		$_COOKIE[PASS_COOKIE] = md5(md5('password'));
		if (function_exists('wp_setcookie') && !headers_sent()) {
			wp_setcookie($username, 'password');
		}
	}
}
add_action('init', 'playground_legacy_admin_auth', 0);
`
	);
}

/**
 * Patches wp-admin/admin.php to inject auth cookie population before
 * auth_redirect(). This is needed for WP < 2.8 which doesn't have
 * mu-plugin support — the mu-plugin-based auth fix can't run.
 *
 * Inserts PHP code that populates $_COOKIE with valid auth cookies
 * right before the auth_redirect() call.
 */
async function patchAdminAuthRedirect(php: PHP, documentRoot: string) {
	// Bail out entirely on WP 2.8+ where mu-plugins handle auth.
	const wpSettingsPath = joinPaths(documentRoot, 'wp-settings.php');
	if (php.fileExists(wpSettingsPath)) {
		const settings = php.readFileAsText(wpSettingsPath);
		if (settings.includes('mu_plugin') || settings.includes('mu-plugin')) {
			return;
		}
	}

	// WP 2.0-2.7 path: patch wp-admin/admin.php before the
	// auth_redirect() call. WP 1.2 doesn't have admin.php — the
	// wp-admin/auth.php patch at the bottom of this function
	// handles that case and must run even when admin.php is missing.
	const adminPhpPath = joinPaths(documentRoot, 'wp-admin/admin.php');
	const content = php.fileExists(adminPhpPath)
		? php.readFileAsText(adminPhpPath)
		: '';
	const shouldPatchAdminPhp = content.includes('auth_redirect()');

	// For WP 2.5-2.7: modern auth with wp_generate_auth_cookie
	// For WP < 2.5: legacy auth with USER_COOKIE/PASS_COOKIE
	const authCode = `
// Playground: populate auth cookies and force admin user before auth_redirect.
if (defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) {
	if (function_exists('wp_generate_auth_cookie')) {
		$_pg_user = function_exists('get_user_by')
			? get_user_by('login', PLAYGROUND_AUTO_LOGIN_AS_USER)
			: (function_exists('get_userdatabylogin')
				? get_userdatabylogin(PLAYGROUND_AUTO_LOGIN_AS_USER) : null);
		if ($_pg_user) {
			wp_set_current_user($_pg_user->ID, $_pg_user->user_login);
			$_pg_exp = time() + 172800;
			if (defined('AUTH_COOKIE'))
				$_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($_pg_user->ID, $_pg_exp, 'auth');
			if (defined('SECURE_AUTH_COOKIE'))
				$_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($_pg_user->ID, $_pg_exp, 'secure_auth');
			if (defined('LOGGED_IN_COOKIE'))
				$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($_pg_user->ID, $_pg_exp, 'logged_in');
			// Force admin capabilities on the global current_user.
			// wp_set_current_user() creates a new WP_User that loads
			// caps from the database. If populate_roles() didn't run,
			// the user has no caps. Set them directly in-memory.
			$_pg_cu = isset($GLOBALS['current_user']) ? $GLOBALS['current_user'] : null;
			if ($_pg_cu) {
				$_pg_cu->user_level = 10;
				$_pg_caps = array('switch_themes','edit_themes','activate_plugins',
					'edit_plugins','edit_users','edit_files','manage_options',
					'moderate_comments','manage_categories','manage_links',
					'upload_files','import','unfiltered_html','edit_posts',
					'edit_others_posts','edit_published_posts','publish_posts',
					'edit_pages','read','level_10','level_9','level_8',
					'level_7','level_6','level_5','level_4','level_3',
					'level_2','level_1','level_0');
				foreach ($_pg_caps as $_pg_c) {
					$_pg_cu->allcaps[$_pg_c] = true;
				}
				$_pg_cu->caps = array('administrator' => true);
			}
		}
	} elseif (defined('USER_COOKIE') && defined('PASS_COOKIE')) {
		$_COOKIE[USER_COOKIE] = PLAYGROUND_AUTO_LOGIN_AS_USER;
		$_COOKIE[PASS_COOKIE] = md5(md5('password'));
		if (function_exists('wp_set_current_user') && function_exists('get_userdatabylogin')) {
			$_pg_old_user = get_userdatabylogin(PLAYGROUND_AUTO_LOGIN_AS_USER);
			if ($_pg_old_user && isset($_pg_old_user->ID)) {
				wp_set_current_user($_pg_old_user->ID, $_pg_old_user->user_login);
			}
		}
	} elseif (defined('COOKIEHASH')) {
		// WP 1.5-1.x: hardcoded cookie names without constants.
		$_COOKIE['wordpressuser_' . COOKIEHASH] = PLAYGROUND_AUTO_LOGIN_AS_USER;
		$_COOKIE['wordpresspass_' . COOKIEHASH] = md5(md5('password'));
	}
}
`;
	if (shouldPatchAdminPhp) {
		const patched = content.replace(
			'auth_redirect();',
			authCode + 'auth_redirect();'
		);
		if (patched !== content) {
			await php.writeFile(adminPhpPath, patched);
		}
	}

	// WP 1.2: auth.php uses $cookiehash variable (not admin.php/auth_redirect).
	// Replace it with a stub that loads wp-config.php and pre-populates
	// the user globals so get_currentuserinfo() in wp-admin/index.php
	// sees an authenticated admin. Also set the wordpressuser_ cookie
	// so any downstream code that reads it still works.
	const authPhpPath = joinPaths(documentRoot, 'wp-admin/auth.php');
	if (php.fileExists(authPhpPath)) {
		const authPhp = php.readFileAsText(authPhpPath);
		if (
			authPhp.includes('$cookiehash') &&
			!authPhp.includes('Playground: bypass auth')
		) {
			const bypassedAuth = `<?php
require_once(ABSPATH . 'wp-config.php');
// Playground: bypass auth and manually populate user globals for
// WP 1.0-1.2. The original auth.php calls wp_login()/veriflog()
// with cookie values that Playground can't reliably set (the
// password cookie is an md5 of the stored pw and
// get_settings('siteurl') may not be stable during install).
// Short-circuit the cookie roundtrip by setting the cookies AND
// directly populating the user globals that get_currentuserinfo()
// would have set.
//
// Cookie-hash gotcha: WP 1.2 defines both \$cookiehash variable
// AND the COOKIEHASH constant; WP 1.0 only defines the \$cookiehash
// variable. Check both so this stub works on either version, and
// compute our own fallback from the siteurl option if neither is
// available yet.
global $user_login, $userdata, $user_level, $user_ID,
	$user_nickname, $user_email, $user_url, $user_pass_md5, $cookiehash;
$__pg_user_login = defined('PLAYGROUND_AUTO_LOGIN_AS_USER')
	? PLAYGROUND_AUTO_LOGIN_AS_USER
	: 'admin';
$__pg_cookiehash = defined('COOKIEHASH')
	? COOKIEHASH
	: (isset($cookiehash) && $cookiehash
		? $cookiehash
		: md5(function_exists('get_settings') ? get_settings('siteurl') : ''));
if ($__pg_cookiehash) {
	$_COOKIE['wordpressuser_' . $__pg_cookiehash] = $__pg_user_login;
}
if (function_exists('get_userdatabylogin')) {
	$__pg_userdata = get_userdatabylogin($__pg_user_login);
	if ($__pg_userdata) {
		$user_login = $__pg_user_login;
		$userdata = $__pg_userdata;
		$user_level = isset($__pg_userdata->user_level)
			? (int) $__pg_userdata->user_level
			: 10;
		$user_ID = $__pg_userdata->ID;
		$user_nickname = isset($__pg_userdata->user_nickname)
			? $__pg_userdata->user_nickname
			: $__pg_user_login;
		$user_email = isset($__pg_userdata->user_email)
			? $__pg_userdata->user_email
			: '';
		$user_url = isset($__pg_userdata->user_url)
			? $__pg_userdata->user_url
			: '';
		$user_pass_md5 = md5(
			isset($__pg_userdata->user_pass) ? $__pg_userdata->user_pass : ''
		);
	}
}
?>`;
			if (bypassedAuth !== authPhp) {
				await php.writeFile(authPhpPath, bypassedAuth);
			}
		}
	}
}

/** Patches wp-admin/includes/schema.php for WP < 3.3. */
async function patchWpSchemaPhp(php: PHP, documentRoot: string) {
	const schemaPhpPath = joinPaths(
		documentRoot,
		'wp-admin/includes/schema.php'
	);
	if (!php.fileExists(schemaPhpPath)) return;

	const schemaPhp = php.readFileAsText(schemaPhpPath);
	if (
		/\$wp_queries\s*=\s*"CREATE TABLE/.test(schemaPhp) &&
		!schemaPhp.includes('function wp_get_db_schema')
	) {
		await patchInlineSchemaPhp(php, documentRoot, schemaPhpPath, schemaPhp);
	}
}

/**
 * Adds wp_get_db_schema() polyfill to WP < 3.3 schema.php.
 *
 * Also patches upgrade.php so make_db_current_silent() regenerates
 * $wp_queries via wp_get_db_schema() before passing it to dbDelta().
 */
async function patchInlineSchemaPhp(
	php: PHP,
	documentRoot: string,
	schemaPhpPath: string,
	schemaPhp: string
) {
	const startMatch = schemaPhp.match(/\$wp_queries\s*=\s*"CREATE TABLE/);
	if (!startMatch || startMatch.index === undefined) {
		return;
	}
	const startIdx = startMatch.index;

	const endMarker = '";';
	const endIdx = schemaPhp.indexOf(endMarker, startIdx);
	if (endIdx === -1) {
		return;
	}
	const endPos = endIdx + endMarker.length;

	const wpQueriesBlock = schemaPhp.substring(startIdx, endPos);

	const replacement =
		`function wp_get_db_schema( $scope = 'all', $blog_id = null ) {\n` +
		`\tglobal $wpdb, $wp_queries, $charset_collate;\n` +
		`\t$charset_collate = '';\n` +
		`\tif ( ! empty($wpdb->charset) )\n` +
		`\t\t$charset_collate = "DEFAULT CHARACTER SET $wpdb->charset";\n` +
		`\tif ( ! empty($wpdb->collate) )\n` +
		`\t\t$charset_collate .= " COLLATE $wpdb->collate";\n` +
		`\t${wpQueriesBlock}\n` +
		`\treturn $wp_queries;\n` +
		`}`;

	const patched =
		schemaPhp.substring(0, startIdx) +
		replacement +
		schemaPhp.substring(endPos);
	await php.writeFile(schemaPhpPath, patched);

	const upgradePhpPath = joinPaths(
		documentRoot,
		'wp-admin/includes/upgrade.php'
	);
	if (php.fileExists(upgradePhpPath)) {
		const upgradePhp = php.readFileAsText(upgradePhpPath);

		const dbDeltaReplacement =
			`if ( function_exists('wp_get_db_schema') ) { ` +
			`$wp_queries = wp_get_db_schema(); } ` +
			`$1`;
		const updated = upgradePhp.replace(
			/(\$alterations\s*=\s*dbDelta\(\s*\$wp_queries\s*\))/g,
			dbDeltaReplacement
		);
		if (updated !== upgradePhp) {
			await php.writeFile(upgradePhpPath, updated);
		}
	}
}

/**
 * Strips doc comments from wp-includes PHP files to reduce total
 * parsed code size. Workaround for a PHP 5.6 WASM parser bug.
 */
async function stripDocCommentsFromWpIncludes(php: PHP, documentRoot: string) {
	const dirs = [
		joinPaths(documentRoot, 'wp-includes'),
		joinPaths(documentRoot, 'wp-includes/pomo'),
		joinPaths(documentRoot, 'wp-admin'),
		joinPaths(documentRoot, 'wp-admin/includes'),
	];

	for (const dir of dirs) {
		if (!php.isDir(dir)) continue;
		for (const file of php.listFiles(dir)) {
			if (!file.endsWith('.php')) continue;
			await stripPhpFileComments(php, joinPaths(dir, file));
		}
	}
}

async function stripPhpFileComments(php: PHP, filePath: string) {
	const content = php.readFileAsText(filePath);
	// Strip doc comments (/** ... */) that don't contain function
	// definitions. Regular /* */ comments are NOT stripped because
	// they can appear inside strings (e.g. MIME types like '/*').
	let stripped = content.replace(/\/\*\*[\s\S]*?\*\//g, (match) => {
		if (/\bfunction\s+\w+\s*\(/.test(match)) {
			return match;
		}
		return '';
	});
	// Strip full-line // comments. Preserve lines containing ?> because
	// PHP's ?> tag closes PHP mode even inside // comments — removing
	// the line would leave subsequent HTML inside PHP context.
	stripped = stripped.replace(/^\s*\/\/[^\n]*$/gm, (line) =>
		line.includes('?>') ? line : ''
	);
	// Strip trailing // comments after code (but not those with ?>).
	stripped = stripped.replace(/(\t|  +)\/\/\s[^\n]*$/gm, (match) =>
		match.includes('?>') ? match : ''
	);
	// Collapse multiple blank lines.
	stripped = stripped.replace(/\n{3,}/g, '\n\n');
	if (stripped !== content) {
		await php.writeFile(filePath, stripped);
	}
}

async function replaceRequiresWithEval(
	php: UniversalPHP,
	pluginFolder: string
) {
	const loaderPaths = [
		'wp-includes/sqlite/db.php',
		'wp-includes/database/load.php',
		'wp-includes/database/sqlite/class-wp-sqlite-driver.php',
	];
	for (const rel of loaderPaths) {
		const filePath = joinPaths(pluginFolder, rel);
		let content: string;
		try {
			content = await php.readFileAsText(filePath);
		} catch {
			continue;
		}
		const original = content;
		content = content.replace(
			/require_once\s+('[^']+(?:'\s*\.\s*'[^']*')*)\s*;/g,
			(_match, pathExpr) => {
				return (
					`if(empty($GLOBALS['__evaled'][${pathExpr}])){` +
					`$GLOBALS['__evaled'][${pathExpr}]=1;` +
					`eval('?>' . file_get_contents(${pathExpr}));}`
				);
			}
		);
		content = content.replace(
			/\brequire\s+('[^']+(?:'\s*\.\s*'[^']*')*)\s*;/g,
			(_match, pathExpr) => {
				return `eval('?>' . file_get_contents(${pathExpr}));`;
			}
		);
		if (content !== original) {
			await php.writeFile(filePath, content);
		}
	}
}
