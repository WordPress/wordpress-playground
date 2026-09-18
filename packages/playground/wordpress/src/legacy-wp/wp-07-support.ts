/**
 * WordPress 0.7 compatibility.
 *
 * WP 0.71-gold still uses the b2/cafelog file layout: b2config.php,
 * b2-include/, b2login.php, and b2* database tables. Keep those
 * adaptations here so the regular legacy WP 1.0+ path stays focused on
 * WordPress-shaped trees.
 */
import type { PHP } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { rewriteRelativePhpIncludes } from './relative-paths';

export async function prepareWp07SourceTree(
	php: PHP,
	documentRoot: string
): Promise<boolean> {
	if (!isWp07SourceTree(php, documentRoot)) return false;

	await ensureWp07CompatibilityDirectories(php, documentRoot);
	await writeWp07WordPressShims(php, documentRoot);
	await patchWp07Config(php, documentRoot);
	await patchWp07BlogHeader(php, documentRoot);
	await patchWp07WpDb(php, documentRoot);
	await patchWp07TemplateFunctions(php, documentRoot);
	await patchWp07AuthAndAdminFiles(php, documentRoot);
	return true;
}

export async function runWp07PostInstallFixups(php: PHP): Promise<boolean> {
	if (!isWp07SourceTree(php, php.documentRoot)) return false;

	await php.run({
		code: `<?php
			$db_dir = getenv('DOCUMENT_ROOT') . '/wp-content/database/';
			if (!is_dir($db_dir)) { @mkdir($db_dir, 0777, true); }
			$db_path = $db_dir . '.ht.sqlite';
			$pdo = new PDO('sqlite:' . $db_path);
			$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			$now = date('Y-m-d H:i:s');

			$tables_sql = array(
				'b2posts' => "CREATE TABLE IF NOT EXISTS b2posts (
					ID INTEGER PRIMARY KEY AUTOINCREMENT,
					post_author INTEGER NOT NULL DEFAULT 0,
					post_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
					post_content TEXT NOT NULL DEFAULT '',
					post_title TEXT NOT NULL DEFAULT '',
					post_category INTEGER NOT NULL DEFAULT 0,
					post_excerpt TEXT NOT NULL DEFAULT '',
					post_status TEXT NOT NULL DEFAULT 'publish',
					comment_status TEXT NOT NULL DEFAULT 'open',
					ping_status TEXT NOT NULL DEFAULT 'open',
					post_password TEXT NOT NULL DEFAULT ''
				)",
				'b2categories' => "CREATE TABLE IF NOT EXISTS b2categories (
					cat_ID INTEGER PRIMARY KEY AUTOINCREMENT,
					cat_name TEXT NOT NULL DEFAULT ''
				)",
				'b2comments' => "CREATE TABLE IF NOT EXISTS b2comments (
					comment_ID INTEGER PRIMARY KEY AUTOINCREMENT,
					comment_post_ID INTEGER NOT NULL DEFAULT 0,
					comment_author TEXT NOT NULL DEFAULT '',
					comment_author_email TEXT NOT NULL DEFAULT '',
					comment_author_url TEXT NOT NULL DEFAULT '',
					comment_author_IP TEXT NOT NULL DEFAULT '',
					comment_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
					comment_content TEXT NOT NULL DEFAULT '',
					comment_karma INTEGER NOT NULL DEFAULT 0
				)",
				'b2settings' => "CREATE TABLE IF NOT EXISTS b2settings (
					ID INTEGER NOT NULL DEFAULT 1,
					posts_per_page INTEGER NOT NULL DEFAULT 20,
					what_to_show TEXT NOT NULL DEFAULT 'posts',
					archive_mode TEXT NOT NULL DEFAULT 'postbypost',
					time_difference INTEGER NOT NULL DEFAULT 0,
					AutoBR INTEGER NOT NULL DEFAULT 1,
					time_format TEXT NOT NULL DEFAULT 'g:i a',
					date_format TEXT NOT NULL DEFAULT 'n/j/Y',
					PRIMARY KEY (ID)
				)",
				'b2users' => "CREATE TABLE IF NOT EXISTS b2users (
					ID INTEGER PRIMARY KEY AUTOINCREMENT,
					user_login TEXT NOT NULL DEFAULT '',
					user_pass TEXT NOT NULL DEFAULT '',
					user_firstname TEXT NOT NULL DEFAULT '',
					user_lastname TEXT NOT NULL DEFAULT '',
					user_nickname TEXT NOT NULL DEFAULT '',
					user_icq INTEGER NOT NULL DEFAULT 0,
					user_email TEXT NOT NULL DEFAULT '',
					user_url TEXT NOT NULL DEFAULT '',
					user_ip TEXT NOT NULL DEFAULT '',
					user_domain TEXT NOT NULL DEFAULT '',
					user_browser TEXT NOT NULL DEFAULT '',
					dateYMDhour TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
					user_level INTEGER NOT NULL DEFAULT 0,
					user_aim TEXT NOT NULL DEFAULT '',
					user_msn TEXT NOT NULL DEFAULT '',
					user_yim TEXT NOT NULL DEFAULT '',
					user_idmode TEXT NOT NULL DEFAULT ''
				)",
				'b2links' => "CREATE TABLE IF NOT EXISTS b2links (
					link_id INTEGER PRIMARY KEY AUTOINCREMENT,
					link_url TEXT NOT NULL DEFAULT '',
					link_name TEXT NOT NULL DEFAULT '',
					link_image TEXT NOT NULL DEFAULT '',
					link_target TEXT NOT NULL DEFAULT '',
					link_category INTEGER NOT NULL DEFAULT 0,
					link_description TEXT NOT NULL DEFAULT '',
					link_visible TEXT NOT NULL DEFAULT 'Y',
					link_owner INTEGER NOT NULL DEFAULT 1,
					link_rating INTEGER NOT NULL DEFAULT 0,
					link_updated TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
					link_rel TEXT NOT NULL DEFAULT '',
					link_notes TEXT NOT NULL DEFAULT '',
					link_rss TEXT NOT NULL DEFAULT ''
				)",
				'b2linkcategories' => "CREATE TABLE IF NOT EXISTS b2linkcategories (
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
			foreach ($tables_sql as $sql) {
				$pdo->exec($sql);
			}

			if (!$pdo->query("SELECT COUNT(*) FROM b2categories")->fetchColumn()) {
				$pdo->exec("INSERT INTO b2categories (cat_ID, cat_name) VALUES (1, 'General')");
			}
			if (!$pdo->query("SELECT COUNT(*) FROM b2settings")->fetchColumn()) {
				$pdo->exec("INSERT INTO b2settings (ID, posts_per_page, what_to_show, archive_mode, time_difference, AutoBR, time_format, date_format) VALUES (1, 20, 'posts', 'postbypost', 0, 1, 'g:i a', 'n/j/Y')");
			}
			if (!$pdo->query("SELECT COUNT(*) FROM b2users")->fetchColumn()) {
				$pass = md5('password');
				$pdo->exec("INSERT INTO b2users (ID, user_login, user_pass, user_nickname, user_email, user_level, dateYMDhour, user_idmode) VALUES (1, 'admin', '{$pass}', 'admin', 'admin@localhost.com', 10, '{$now}', 'nickname')");
			} else {
				$pass = md5('password');
				$pdo->exec("UPDATE b2users SET user_pass = '{$pass}', user_level = 10 WHERE user_login = 'admin'");
			}
			if (!$pdo->query("SELECT COUNT(*) FROM b2posts")->fetchColumn()) {
				$content = 'Welcome to WordPress. This is the first post. Edit or delete it, then start blogging!';
				$pdo->exec("INSERT INTO b2posts (ID, post_author, post_date, post_content, post_title, post_category, post_excerpt, post_status, comment_status, ping_status, post_password) VALUES (1, 1, '{$now}', '{$content}', 'Hello world!', 1, '', 'publish', 'open', 'open', '')");
			}
			if (!$pdo->query("SELECT COUNT(*) FROM b2comments")->fetchColumn()) {
				$pdo->exec("INSERT INTO b2comments (comment_post_ID, comment_author, comment_author_email, comment_author_url, comment_author_IP, comment_date, comment_content, comment_karma) VALUES (1, 'Mr WordPress', 'mr@wordpress.org', 'http://wordpress.org', '127.0.0.1', '{$now}', 'Hi, this is a comment. To delete a comment, just log in and view the comments for this post.', 0)");
			}
			if (!$pdo->query("SELECT COUNT(*) FROM b2linkcategories")->fetchColumn()) {
				$pdo->exec("INSERT INTO b2linkcategories (cat_id, cat_name) VALUES (1, 'General')");
			}
			if (!$pdo->query("SELECT COUNT(*) FROM b2links")->fetchColumn()) {
				$pdo->exec("INSERT INTO b2links (link_url, link_name, link_category, link_visible, link_owner) VALUES ('http://wordpress.org', 'WordPress', 1, 'Y', 1)");
			}
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
		},
	});

	return true;
}

function isWp07SourceTree(php: PHP, documentRoot: string): boolean {
	const configPath = joinPaths(documentRoot, 'b2config.php');
	const varsPath = joinPaths(documentRoot, 'b2-include/b2vars.php');
	if (!php.fileExists(configPath) || !php.fileExists(varsPath)) {
		return false;
	}
	return php.readFileAsText(varsPath).includes("$b2_version = '0.71'");
}

async function ensureWp07CompatibilityDirectories(
	php: PHP,
	documentRoot: string
): Promise<void> {
	for (const path of [
		joinPaths(documentRoot, 'wp-includes'),
		joinPaths(documentRoot, 'wp-content'),
		joinPaths(documentRoot, 'wp-content/database'),
	]) {
		if (!php.isDir(path)) {
			await php.mkdir(path);
		}
	}
}

async function writeWp07WordPressShims(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const versionPhpPath = joinPaths(documentRoot, 'wp-includes/version.php');
	await php.writeFile(
		versionPhpPath,
		`<?php
$wp_version = '0.71';
$wp_db_version = 71;
`
	);

	const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');
	if (!php.fileExists(wpConfigPath)) {
		await php.writeFile(
			wpConfigPath,
			`<?php require_once dirname(__FILE__) . '/b2config.php';`
		);
	}

	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	if (!php.fileExists(wpLoadPath)) {
		await php.writeFile(
			wpLoadPath,
			`<?php
if (!defined('ABSPATH')) {
	define('ABSPATH', dirname(__FILE__) . '/');
}
require_once ABSPATH . 'b2config.php';
`
		);
	}

	const postPhpPath = joinPaths(documentRoot, 'wp-admin/post.php');
	if (!php.fileExists(postPhpPath)) {
		await php.writeFile(
			postPhpPath,
			`<?php require_once dirname(__FILE__) . '/b2edit.php';`
		);
	}
}

async function patchWp07Config(php: PHP, documentRoot: string): Promise<void> {
	const configPath = joinPaths(documentRoot, 'b2config.php');
	let config = php.readFileAsText(configPath);
	const original = config;

	if (!config.includes('pg_wp07_bootstrap')) {
		config = config.replace(
			'<?php',
			`<?php
if (!defined('ABSPATH')) define('ABSPATH', dirname(__FILE__) . '/'); /* pg_wp07_bootstrap */
if (!defined('WPINC')) define('WPINC', 'b2-include');
if (!defined('WP_CONTENT_DIR')) define('WP_CONTENT_DIR', ABSPATH . 'wp-content');
if (!defined('DB_ENGINE')) define('DB_ENGINE', 'sqlite');
if (!isset($table_prefix)) $table_prefix = 'b2';
error_reporting(E_ALL & ~E_NOTICE & ~8192 & ~2048);
`
		);
	}

	config = config
		.replace(
			/\$siteurl\s*=\s*'http:\/\/example\.com';[^\n]*/,
			"$siteurl = defined('WP_SITEURL') ? WP_SITEURL : 'http://localhost'; // pg_wp07_siteurl"
		)
		.replace(
			'$blogname = "my weblog";',
			'$blogname = "My WordPress Website";'
		)
		.replace(
			'$blogdescription = "babblings !";',
			'$blogdescription = "Just another WordPress weblog";'
		)
		.replace(
			"$admin_email = 'you@example.com';",
			"$admin_email = 'admin@localhost.com';"
		)
		.replace(
			"$abspath =  getenv('DOCUMENT_ROOT') . $relpath . '/';",
			"$abspath = dirname(__FILE__) . '/';"
		);

	if (config !== original) {
		await php.writeFile(configPath, config);
	}
}

async function patchWp07BlogHeader(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const blogHeaderPath = joinPaths(documentRoot, 'blog.header.php');
	let blogHeader = php.readFileAsText(blogHeaderPath);
	const original = blogHeader;

	blogHeader = blogHeader.replace(
		`$where .= ' AND (post_status = "publish"';`,
		`$where .= " AND (post_status = 'publish'";`
	);

	if (blogHeader !== original) {
		await php.writeFile(blogHeaderPath, blogHeader);
	}
}

async function patchWp07WpDb(php: PHP, documentRoot: string): Promise<void> {
	const wpDbPath = joinPaths(documentRoot, 'b2-include/wp-db.php');
	let wpDb = php.readFileAsText(wpDbPath);
	const original = wpDb;

	wpDb = injectWp07WpdbPolyfills(wpDb);
	wpDb = wpDb.replace(
		'$wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);',
		`if (!isset($GLOBALS['wpdb'])) {
	$GLOBALS['wpdb'] = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);
}
$wpdb = $GLOBALS['wpdb']; /* pg_wp07_preserve_sqlite_loader */`
	);

	if (wpDb !== original) {
		await php.writeFile(wpDbPath, wpDb);
	}
}

function injectWp07WpdbPolyfills(wpDb: string): string {
	const polyfills: string[] = [];
	if (!wpDb.includes('function set_prefix')) {
		polyfills.push(`
	function set_prefix($prefix) {
		$this->prefix = $prefix;
		$tables = array('posts', 'users', 'categories', 'comments', 'links', 'linkcategories', 'settings', 'options', 'postmeta', 'usermeta', 'terms', 'term_taxonomy', 'term_relationships');
		foreach ($tables as $table) {
			$this->$table = $prefix . $table;
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
	if (polyfills.length === 0) return wpDb;

	const classEndMatch = wpDb.match(
		/^(\s*})\s*\n+(\$wpdb|if\s*\(\s*!\s*isset\(\s*\$GLOBALS\['wpdb'\]\s*\))/m
	);
	// Fail loudly rather than silently shipping a wpdb missing essential
	// methods (set_prefix, init_charset, bail, ...), which would fatal far
	// downstream with a confusing error.
	if (!classEndMatch || classEndMatch.index === undefined) {
		throw new Error(
			'WP 0.7 wpdb polyfill anchor not found; b2-include/wp-db.php layout changed'
		);
	}

	const polyfillBlock =
		'\n\t// Polyfills added by WordPress Playground for WP 0.7.\n' +
		polyfills.join('\n') +
		'\n\n';
	return (
		wpDb.substring(0, classEndMatch.index) +
		polyfillBlock +
		wpDb.substring(classEndMatch.index)
	);
}

async function patchWp07TemplateFunctions(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const templateFunctionsPath = joinPaths(
		documentRoot,
		'b2-include/b2template.functions.php'
	);
	let templateFunctions = php.readFileAsText(templateFunctionsPath);
	const original = templateFunctions;
	if (templateFunctions.includes('pg_wp07_apply_filters')) return;

	templateFunctions = templateFunctions.replace(
		`function apply_filters($tag, $string) {
	global $b2_filter;
	if (isset($b2_filter['all'])) {
		$b2_filter['all'] = (is_string($b2_filter['all'])) ? array($b2_filter['all']) : $b2_filter['all'];
		$b2_filter[$tag] = array_merge($b2_filter['all'], $b2_filter[$tag]);
		$b2_filter[$tag] = array_unique($b2_filter[$tag]);
	}
	if (isset($b2_filter[$tag])) {
		$b2_filter[$tags] = (is_string($b2_filter[$tag])) ? array($b2_filter[$tag]) : $b2_filter[$tag];
		$functions = $b2_filter[$tag];
		foreach($functions as $function) {
			$string = $function($string);
		}
	}
	return $string;
}`,
		`function apply_filters($tag, $string) { /* pg_wp07_apply_filters */
	global $b2_filter;
	$functions = array();
	// WP_SQLite_DB uses apply_filters('query'); b2's all filter texturizes SQL.
	if ($tag != 'query' && isset($b2_filter['all'])) {
		$all = is_array($b2_filter['all']) ? $b2_filter['all'] : array($b2_filter['all']);
		$functions = array_merge($functions, $all);
	}
	if (isset($b2_filter[$tag])) {
		$tag_functions = is_array($b2_filter[$tag]) ? $b2_filter[$tag] : array($b2_filter[$tag]);
		$functions = array_merge($functions, $tag_functions);
	}
	$functions = array_unique($functions);
	foreach($functions as $function) {
		if (function_exists($function)) {
			$string = $function($string);
		}
	}
	return $string;
}`
	);

	if (templateFunctions !== original) {
		await php.writeFile(templateFunctionsPath, templateFunctions);
	}
}

async function patchWp07AuthAndAdminFiles(
	php: PHP,
	documentRoot: string
): Promise<void> {
	await patchWp07Login(php, documentRoot);
	await patchWp07AdminRelativePaths(php, documentRoot);
	await patchWp07AdminMenuTop(php, documentRoot);
	await patchWp07AdminAuth(php, documentRoot);
}

async function patchWp07Login(php: PHP, documentRoot: string): Promise<void> {
	const loginPath = joinPaths(documentRoot, 'b2login.php');
	let login = php.readFileAsText(loginPath);
	const original = login;

	if (!login.includes('pg_wp07_login_auto_login')) {
		login = login.replace(
			`switch($action) {`,
			`${getWp07AutoLoginCookieBootstrap('pg_wp07_login_auto_login')}
switch($action) {`
		);
	}

	if (!login.includes('pg_wp07_logout_guard')) {
		login = login.replace(
			`\tsetcookie('wordpressuser');
\tsetcookie('wordpresspass');`,
			`\tsetcookie('wordpressuser', '', time() - 31536000);
\tsetcookie('wordpresspass', '', time() - 31536000);
\tsetcookie('wordpressblogid', '', time() - 31536000);
\tsetcookie('wordpressuser', '', time() - 31536000, '/');
\tsetcookie('wordpresspass', '', time() - 31536000, '/');
\tsetcookie('wordpressblogid', '', time() - 31536000, '/');
\tsetcookie('playground_auto_login_already_logged_out', '1', time() + 172800, '/'); /* pg_wp07_logout_guard */`
		);
		login = login
			.replace(
				`header('Refresh: 0;url=b2login.php');`,
				`header('Refresh: 0;url=b2login.php?loggedout=1');`
			)
			.replace(
				`header('Location: b2login.php');`,
				`header('Location: b2login.php?loggedout=1');`
			);
	}

	if (login !== original) {
		await php.writeFile(loginPath, login);
	}
}

async function patchWp07AdminRelativePaths(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const wpAdminDir = joinPaths(documentRoot, 'wp-admin');
	if (!php.isDir(wpAdminDir)) return;

	for (const file of php.listFiles(wpAdminDir)) {
		if (!file.endsWith('.php')) continue;
		const filePath = joinPaths(wpAdminDir, file);
		const content = php.readFileAsText(filePath);
		const patched = rewriteRelativePhpIncludes(content);
		if (patched !== content) {
			await php.writeFile(filePath, patched);
		}
	}
}

async function patchWp07AdminMenuTop(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const menuPath = joinPaths(documentRoot, 'wp-admin/b2menutop.php');
	let menu = php.readFileAsText(menuPath);
	const original = menu;

	menu = menu
		.replace(
			'file("./b2menutop.txt")',
			`file(dirname(__FILE__) . '/b2menutop.txt')`
		)
		.replace(
			'<a href="http://wordpress.org" rel="external"><span>WordPress</span></a>',
			'<a href="#" rel="external"><span>WordPress</span></a>'
		);

	if (menu !== original) {
		await php.writeFile(menuPath, menu);
	}
}

async function patchWp07AdminAuth(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const authPath = joinPaths(documentRoot, 'wp-admin/b2verifauth.php');
	let auth = php.readFileAsText(authPath);
	const original = auth;
	if (auth.includes('pg_wp07_auto_login')) return;

	auth = auth.replace(
		"require_once('../b2config.php');",
		`require_once('../b2config.php');
${getWp07AutoLoginCookieBootstrap('pg_wp07_auto_login')}`
	);
	if (auth !== original) {
		await php.writeFile(authPath, auth);
	}
}

function getWp07AutoLoginCookieBootstrap(marker: string): string {
	return `
if (isset($_GET['loggedout']) || isset($HTTP_GET_VARS['loggedout'])) {
	$_COOKIE['playground_auto_login_already_logged_out'] = '1';
	unset($_COOKIE['wordpressuser']);
	unset($_COOKIE['wordpresspass']);
	unset($_COOKIE['wordpressblogid']);
	unset($HTTP_COOKIE_VARS['wordpressuser']);
	unset($HTTP_COOKIE_VARS['wordpresspass']);
	unset($HTTP_COOKIE_VARS['wordpressblogid']);
	if (!headers_sent()) {
		setcookie('playground_auto_login_already_logged_out', '1', time() + 172800, '/');
	}
}
if (
	defined('PLAYGROUND_AUTO_LOGIN_AS_USER') &&
	empty($_COOKIE['playground_auto_login_already_logged_out']) &&
	(!isset($action) || $action != 'logout')
) {
	$_pg_wp07_user = PLAYGROUND_AUTO_LOGIN_AS_USER;
	$_pg_wp07_pass = md5(md5('password'));
	$_COOKIE['wordpressuser'] = $_pg_wp07_user;
	$_COOKIE['wordpresspass'] = $_pg_wp07_pass;
	$_COOKIE['wordpressblogid'] = 1;
	$HTTP_COOKIE_VARS = $_COOKIE;
	$GLOBALS['HTTP_COOKIE_VARS'] = $HTTP_COOKIE_VARS;
	if (!headers_sent()) {
		$_pg_wp07_exp = time() + 172800;
		setcookie('wordpressuser', $_pg_wp07_user, $_pg_wp07_exp, '/');
		setcookie('wordpresspass', $_pg_wp07_pass, $_pg_wp07_exp, '/');
		setcookie('wordpressblogid', 1, $_pg_wp07_exp, '/');
	}
} /* ${marker} */
`;
}
