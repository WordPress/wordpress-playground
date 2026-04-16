import type { PHP, UniversalPHP } from '@php-wasm/universal';
import { joinPaths, phpVar } from '@php-wasm/util';
import { unzipFile, createMemoizedFetch } from '@wp-playground/common';
import { logger } from '@php-wasm/logger';
import { LEGACY_WP_ERROR_REPORTING_PHP_EXPR } from './legacy-wp-fixes';
import { MYSQL_SHIMS_PHP } from './mysql-shims';

export {
	bootWordPress,
	bootWordPressAndRequestHandler,
	bootRequestHandler,
	getFileNotFoundActionForWordPress,
} from './boot';
export type {
	PhpIniOptions,
	PHPInstanceCreatedHook,
	WordPressInstallMode,
} from './boot';
export { defineWpConfigConstants, ensureWpConfig } from './wp-config';
export { getLoadedWordPressVersion } from './version-detect';

export * from './version-detect';
export * from './rewrite-rules';

/**
 * Auto-login body for modern WordPress (2.5+).
 *
 * Uses the standard WP API: is_user_logged_in(), get_user_by(),
 * wp_set_current_user(), wp_set_auth_cookie().
 */
const MODERN_AUTO_LOGIN_BODY = `
			if ( is_user_logged_in() ) {
				return;
			}
			$user = get_user_by('login', $user_name);
			if (!$user) {
				return;
			}
			if (headers_sent()) {
				_doing_it_wrong('playground_auto_login', 'Headers already sent, the Playground runtime will not auto-login the user', '1.0.0');
				return;
			}
			wp_set_current_user( $user->ID, $user->user_login );
			wp_set_auth_cookie( $user->ID );
			do_action( 'wp_login', $user->user_login, $user );
			setcookie('playground_auto_login_already_happened', '1');
			if (headers_sent()) {
				_doing_it_wrong('playground_auto_login', 'Headers already sent, the Playground runtime will not auto-login the user', '1.0.0');
				return;
			}
			$redirect_url = $_SERVER['REQUEST_URI'];
			header( "Location: $redirect_url", true, 302 );
			exit;
`;

/**
 * Auto-login body for legacy WordPress (1.0-2.5).
 *
 * Handles three auth eras:
 * - WP 2.5+: wp_set_current_user() + wp_set_auth_cookie() (HMAC cookies)
 * - WP 1.5-2.4: USER_COOKIE/PASS_COOKIE constants + wp_setcookie()
 * - WP 1.0-1.2: wordpressuser_/wordpresspass_ cookies + global vars
 *
 * Each era uses different cookie names and hashing. The code detects
 * which API is available and uses the appropriate method.
 */
const LEGACY_AUTO_LOGIN_BODY = `
			// WP 2.5+: modern auth API
			if (function_exists('is_user_logged_in') && is_user_logged_in()) {
				return;
			}
			if (headers_sent()) {
				return;
			}
			$_pg_skip_redirect = defined('PLAYGROUND_SKIP_AUTO_LOGIN_REDIRECT')
				&& PLAYGROUND_SKIP_AUTO_LOGIN_REDIRECT;

			// WP 2.5+: use the standard auth API
			if (function_exists('wp_set_current_user') && function_exists('wp_set_auth_cookie')) {
				$user = function_exists('get_user_by')
					? get_user_by('login', $user_name)
					: (function_exists('get_userdatabylogin')
						? get_userdatabylogin($user_name) : null);
				if (!$user) return;

				wp_set_current_user($user->ID, $user->user_login);
				if ($_pg_skip_redirect) {
					// Persist auth cookies so that subsequent PHP requests
					// (e.g. form POSTs to post.php) also see the user as
					// logged in. wp_set_auth_cookie() emits Set-Cookie
					// headers that are captured by HttpCookieStore and
					// re-injected as Cookie: on every following request.
					// We also populate $_COOKIE in-process so that
					// auth_redirect() and wp_verify_nonce() work for the
					// remainder of this request without needing a redirect.
					wp_set_auth_cookie($user->ID);
					if (function_exists('wp_generate_auth_cookie')) {
						$_pg_exp = time() + 172800;
						if (defined('AUTH_COOKIE'))
							$_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $_pg_exp, 'auth');
						if (defined('SECURE_AUTH_COOKIE'))
							$_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $_pg_exp, 'secure_auth');
						if (defined('LOGGED_IN_COOKIE'))
							$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($user->ID, $_pg_exp, 'logged_in');
					}
				} else {
					wp_set_auth_cookie($user->ID);
					if (function_exists('do_action')) {
						do_action('wp_login', $user->user_login, $user);
					}
					setcookie('playground_auto_login_already_happened', '1');
					if (!headers_sent()) {
						header("Location: " . $_SERVER['REQUEST_URI'], true, 302);
						exit;
					}
				}
				return;
			}

			// WP 1.5-2.4: USER_COOKIE/PASS_COOKIE with double-md5
			if (defined('USER_COOKIE') && defined('PASS_COOKIE')) {
				$_pg_pass_cookie = md5(md5('password'));
				$_COOKIE[USER_COOKIE] = $user_name;
				$_COOKIE[PASS_COOKIE] = $_pg_pass_cookie;
				// Persist cookies to the browser so subsequent requests
				// see the user as logged in. Without these setcookie()
				// calls, only the current request would be authenticated.
				if (!headers_sent()) {
					$_pg_exp = time() + 172800;
					setcookie(USER_COOKIE, $user_name, $_pg_exp, '/');
					setcookie(PASS_COOKIE, $_pg_pass_cookie, $_pg_exp, '/');
				}
				// Reset cached anonymous user so capability checks work
				$GLOBALS['current_user'] = null;
				if (function_exists('get_currentuserinfo')) {
					get_currentuserinfo();
				}
				if (!$_pg_skip_redirect) {
					setcookie('playground_auto_login_already_happened', '1', 0, '/');
					if (!headers_sent()) {
						header("Location: " . $_SERVER['REQUEST_URI'], true, 302);
						exit;
					}
				}
				return;
			}

			// WP 1.0-1.2: wordpressuser_/wordpresspass_ cookies
			// and global user variables instead of WP_User objects.
			$cookiehash = defined('COOKIEHASH')
				? COOKIEHASH
				: (isset($GLOBALS['cookiehash']) && $GLOBALS['cookiehash']
					? $GLOBALS['cookiehash']
					: (function_exists('get_settings')
						? md5(get_settings('siteurl'))
						: ''));
			if ($cookiehash) {
				$_pg_user_cookie_name = 'wordpressuser_' . $cookiehash;
				$_pg_pass_cookie_name = 'wordpresspass_' . $cookiehash;
				$_pg_pass_cookie_value = md5(md5('password'));
				$_COOKIE[$_pg_user_cookie_name] = $user_name;
				$_COOKIE[$_pg_pass_cookie_name] = $_pg_pass_cookie_value;
				// Persist cookies to the browser so subsequent requests
				// see the user as logged in.
				if (!headers_sent()) {
					$_pg_exp = time() + 172800;
					setcookie($_pg_user_cookie_name, $user_name, $_pg_exp, '/');
					setcookie($_pg_pass_cookie_name, $_pg_pass_cookie_value, $_pg_exp, '/');
				}
				// Populate global user variables that WP 1.0-1.2 uses
				// instead of a WP_User object.
				if (function_exists('get_userdatabylogin')) {
					$userdata = get_userdatabylogin($user_name);
					if ($userdata) {
						$GLOBALS['user_login']    = $user_name;
						$GLOBALS['userdata']      = $userdata;
						$GLOBALS['user_level']    = isset($userdata->user_level) ? (int) $userdata->user_level : 10;
						$GLOBALS['user_ID']       = $userdata->ID;
						$GLOBALS['user_email']    = isset($userdata->user_email) ? $userdata->user_email : '';
						$GLOBALS['user_url']      = isset($userdata->user_url) ? $userdata->user_url : '';
						$GLOBALS['user_nickname'] = isset($userdata->user_nickname) ? $userdata->user_nickname : $user_name;
						$GLOBALS['user_pass_md5'] = md5(isset($userdata->user_pass) ? $userdata->user_pass : '');
					}
				}
				if (!$_pg_skip_redirect) {
					setcookie('playground_auto_login_already_happened', '1', 0, '/');
					if (!headers_sent()) {
						header("Location: " . $_SERVER['REQUEST_URI'], true, 302);
						exit;
					}
				}
				return;
			}
`;

/**
 * Preloads the platform mu-plugins from /internal/shared/mu-plugins.
 * This avoids polluting the WordPress installation with mu-plugins
 * that are only needed in the Playground environment.
 *
 * @param php
 */
export async function setupPlatformLevelMuPlugins(
	php: UniversalPHP,
	options: { phpVersion?: string } = {}
) {
	const phpMajor = parseInt(options.phpVersion ?? '8', 10);
	const phpVersion = options.phpVersion ?? '8';
	const isPhp52 = phpVersion === '5.2';
	await php.mkdir('/internal/shared/mu-plugins');

	if (phpMajor < 7) {
		// Overwrite auto_prepend_file.php to add PHP 4 superglobal
		// polyfills that WP 1.0-2.5 needs. The default
		// auto_prepend_file only loads consts and preload files;
		// legacy PHP also needs the superglobals set up first.
		await php.writeFile(
			'/internal/shared/auto_prepend_file.php',
			`<?php
// Polyfill the PHP 4 superglobals that WP 1.0-2.5 still rely on.
// These were aliases of $_GET / $_POST / $_COOKIE / $_SERVER /
// $_FILES / $_ENV / $_REQUEST and were removed in PHP 5.4.
// Bind by reference so later writes to $_COOKIE (e.g. in
// auth bypass shims) are reflected in $HTTP_COOKIE_VARS that
// WP 1.0's get_currentuserinfo() reads.
$GLOBALS['HTTP_GET_VARS']     = &$_GET;
$GLOBALS['HTTP_POST_VARS']    = &$_POST;
$GLOBALS['HTTP_COOKIE_VARS']  = &$_COOKIE;
$GLOBALS['HTTP_SERVER_VARS']  = &$_SERVER;
if (isset($_FILES))   $GLOBALS['HTTP_POST_FILES']   = &$_FILES;
if (isset($_ENV))     $GLOBALS['HTTP_ENV_VARS']     = &$_ENV;
if (isset($_SESSION)) $GLOBALS['HTTP_SESSION_VARS'] = &$_SESSION;
// Also populate the top-level names that register_long_arrays +
// register_globals=On used to expose. WP 1.0 reads $PHP_SELF and
// $REMOTE_ADDR at the top level instead of $_SERVER[...].
if (isset($_SERVER['PHP_SELF'])) $GLOBALS['PHP_SELF'] = $_SERVER['PHP_SELF'];
if (isset($_SERVER['REMOTE_ADDR'])) $GLOBALS['REMOTE_ADDR'] = $_SERVER['REMOTE_ADDR'];
if (isset($_SERVER['REQUEST_URI'])) $GLOBALS['REQUEST_URI'] = $_SERVER['REQUEST_URI'];
if(file_exists('/internal/shared/consts.json')) {
	$consts = json_decode(file_get_contents('/internal/shared/consts.json'), true);
	if ($consts) {
		foreach ($consts as $const => $value) {
			if (!defined($const) && is_scalar($value)) {
				define($const, $value);
			}
		}
	}
}
foreach (glob('/internal/shared/preload/*.php') as $file) {
	require_once $file;
}
// Start output buffering so that PHP notices and warnings from
// WordPress's initialisation phase do not prematurely send the
// HTTP response headers. Without buffering, the first notice
// (printed as an HTML <b>Warning</b>: ... snippet) commits the
// headers, making headers_sent() return true for the rest of
// the request. That prevents the auto-login mu-plugin from
// calling wp_set_auth_cookie() and setcookie() later during
// the init hook, which in turn breaks nonce validation for
// POST requests (e.g. saving a new post).
// PHP flushes the buffer automatically at script end, so all
// WordPress output is still delivered to the browser.
ob_start();
`
		);
	}

	await php.writeFile(
		'/internal/shared/preload/env.php',
		phpMajor < 7
			? `<?php
// Detect the WordPress hook format from the WP version on disk.
// WP 1.0: flat array of function name strings (no priorities).
// WP 1.2: $wp_filter[$tag][$priority][] = 'func_name'.
// WP 1.5+: $wp_filter[$tag][$priority][] = array('function'=>...,'accepted_args'=>N).
// Returns 'wp10', 'wp12', or 'wp15'.
function _playground_detect_wp_hook_format() {
	static $format = null;
	if ($format !== null) return $format;
	$doc_root = isset($_SERVER['DOCUMENT_ROOT'])
		? $_SERVER['DOCUMENT_ROOT'] : '/wordpress';
	$version_path = $doc_root . '/wp-includes/version.php';
	$wp_version = '1.0';
	if (file_exists($version_path)) {
		include $version_path;
	}
	if (version_compare($wp_version, '1.5', '>=')) {
		$format = 'wp15';
	} elseif (version_compare($wp_version, '1.2', '>=')) {
		$format = 'wp12';
	} else {
		$format = 'wp10';
	}
	return $format;
}

// Allow adding filters/actions prior to loading WordPress.
// $function_to_add MUST be a string.
// Stores the callback in the $wp_filter format that the target
// WordPress version's apply_filters() expects.
function playground_add_filter( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
	global $wp_filter;
	$fmt = _playground_detect_wp_hook_format();
	if ($fmt === 'wp10') {
		$wp_filter[$tag][] = $function_to_add;
	} elseif ($fmt === 'wp12') {
		$wp_filter[$tag][$priority][] = $function_to_add;
	} else {
		$wp_filter[$tag][$priority][$function_to_add] = array(
			'function' => $function_to_add,
			'accepted_args' => $accepted_args
		);
	}
}
function playground_add_action( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
	playground_add_filter( $tag, $function_to_add, $priority, $accepted_args );
}

// Set legacy WordPress auth cookies BEFORE WordPress loads.
//
// For WP 1.0-2.4, the auto-login mu-plugin runs too late: by the
// time the init hook fires (or may not fire at all on the front
// page), WordPress has already determined the user's login state
// from $_COOKIE. We set $_COOKIE here in the preload so WordPress
// sees the user as logged in from the very first request, and we
// also persist the cookies via setcookie() so subsequent requests
// bring them back automatically through Playground's HttpCookieStore.
function playground_legacy_set_auth_cookies_early() {
	if (!defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) return;
	if (isset($_COOKIE['playground_auto_login_already_logged_out'])) return;

	// Skip if auth cookies are already set by a previous request.
	foreach ($_COOKIE as $name => $_) {
		if (strncmp($name, 'wordpressuser_', 14) === 0) return;
	}

	$user_name = PLAYGROUND_AUTO_LOGIN_AS_USER;
	$pass_md5 = md5(md5('password'));

	// Read the actual siteurl from the SQLite database so the cookie
	// hash matches what WordPress 1.0-2.4 computes from get_settings().
	$siteurl = null;
	$db_path = defined('DB_DIR') ? DB_DIR . '.ht.sqlite' : '';
	if ($db_path && class_exists('PDO') && file_exists($db_path)) {
		try {
			$pdo = new PDO('sqlite:' . $db_path);
			$stmt = $pdo->query("SELECT option_value FROM wp_options WHERE option_name = 'siteurl' LIMIT 1");
			if ($stmt) $siteurl = $stmt->fetchColumn();
			$pdo = null;
		} catch (Exception $e) {}
	}
	if (!$siteurl && defined('WP_SITEURL')) $siteurl = WP_SITEURL;
	if (!$siteurl) return;

	$cookiehash = md5($siteurl);
	$user_cookie_name = 'wordpressuser_' . $cookiehash;
	$pass_cookie_name = 'wordpresspass_' . $cookiehash;
	$_COOKIE[$user_cookie_name] = $user_name;
	$_COOKIE[$pass_cookie_name] = $pass_md5;

	if (!headers_sent()) {
		$exp = time() + 172800;
		setcookie($user_cookie_name, $user_name, $exp, '/');
		setcookie($pass_cookie_name, $pass_md5, $exp, '/');
	}
}
playground_legacy_set_auth_cookies_early();

// Fix date function comparisons for the SQLite driver.
// Old WordPress (< 4.0) generates date queries like:
//   YEAR(post_date)='2026' AND MONTH(post_date)='4'
// using string literals. The SQLite driver's user-defined
// YEAR/MONTH/DAYOFMONTH/DAY functions return integers, and
// SQLite does not coerce types the way MySQL does (integer
// 4 != text '4' in SQLite). This filter strips quotes around
// numeric values in these comparisons so both sides are integers.
function playground_fix_sqlite_date_comparisons($query) {
	if (
		stripos($query, 'YEAR') === false &&
		stripos($query, 'MONTH') === false &&
		stripos($query, 'DAY') === false
	) {
		return $query;
	}
	return preg_replace(
		'/\\b(YEAR|MONTH|DAYOFMONTH|DAY)\\s*\\(([^)]+)\\)\\s*=\\s*\\'(\\d+)\\'/i',
		'$1($2) = $3',
		$query
	);
}
playground_add_filter( 'query', 'playground_fix_sqlite_date_comparisons' );

// WP < 2.2 doesn't natively override get_option('siteurl') /
// get_option('home') with the WP_SITEURL / WP_HOME constants.
// Modern WP (2.2+) checks these constants in get_option() and
// returns the constant value, bypassing the DB. For WP 1.0-2.1,
// we replicate this behavior via option_siteurl / option_home
// filters so that admin navigation links use the correct
// Playground scoped URL instead of whatever the DB stores.
function playground_override_siteurl($value) {
	if (defined('WP_SITEURL')) {
		return WP_SITEURL;
	}
	return $value;
}
function playground_override_home($value) {
	if (defined('WP_HOME')) {
		return WP_HOME;
	}
	return $value;
}
playground_add_filter( 'option_siteurl', 'playground_override_siteurl' );
playground_add_filter( 'option_home', 'playground_override_home' );

// Load our mu-plugins after customer mu-plugins.
// NOTE: this means our mu-plugins can't use the muplugins_loaded action!
playground_add_action( 'muplugins_loaded', 'playground_load_mu_plugins', 0 );
// WP < 2.8 doesn't fire muplugins_loaded, so also hook into init
// as a fallback. The $loaded flag ensures mu-plugins load only once.
playground_add_action( 'init', 'playground_load_mu_plugins', -1000 );
function playground_load_mu_plugins() {
	static $loaded = false;
	if ($loaded) return;
	$loaded = true;
	// Load all PHP files from /internal/shared/mu-plugins sorted by filename
	$mu_plugins_dir = '/internal/shared/mu-plugins';
	if(!is_dir($mu_plugins_dir)){
		return;
	}
	$mu_plugins = glob( $mu_plugins_dir . '/*.php' );
	sort( $mu_plugins );
	global $wp_version;
	$is_legacy_wp = isset($wp_version) && version_compare($wp_version, '2.8', '<');
	foreach ( $mu_plugins as $mu_plugin ) {
		// sqlite-database-integration.php is loaded separately
		// by the preload lazy loader or db.php.
		if (strpos($mu_plugin, 'sqlite-database-integration') !== false) {
			continue;
		}
		// Most mu-plugins use closures in add_action/add_filter
		// or call functions like site_url() that don't exist in
		// very old WordPress. WP < 2.8 crashes on closures in
		// hooks; WP < 2.6 lacks site_url(). Only load mu-plugins
		// that are explicitly written for legacy WP compatibility.
		if ($is_legacy_wp) {
			// 1-auto-login.php uses LEGACY_AUTO_LOGIN_BODY which
			// handles WP 1.0-2.5 auth APIs with named functions
			// only (no closures, no site_url()).
			if (strpos($mu_plugin, '1-auto-login.php') === false) {
				continue;
			}
		}
		require_once $mu_plugin;
	}
	// On WP < 2.8, this function runs during init (priority
	// -1000). PHP 5.x's foreach iterates over a copy of the
	// array, so add_action() calls inside the loaded mu-plugin
	// (e.g. add_action('init', 'playground_auto_login', 1))
	// won't fire — the init hook list was already snapshotted.
	// Call the functions directly as a workaround.
	//
	// PLAYGROUND_SKIP_AUTO_LOGIN_REDIRECT tells the auto-login
	// function to set cookies in-process without redirecting.
	// In Playground's service worker, a redirect+Set-Cookie
	// can cause a race because the cookie isn't applied before
	// the redirected request fires. Define it unconditionally
	// for all legacy PHP so the init-hook auto-login uses the
	// in-process path.
	if (!defined('PLAYGROUND_SKIP_AUTO_LOGIN_REDIRECT')) {
		define('PLAYGROUND_SKIP_AUTO_LOGIN_REDIRECT', true);
	}

	// WP < 2.8: add_action() calls inside mu-plugins won't
	// fire because PHP 5.x's foreach iterates a copy. Call
	// auto-login directly here as a workaround.
	if ($is_legacy_wp) {
		if (function_exists('playground_auto_login_redirect_target')) {
			playground_auto_login_redirect_target();
		}
		if (function_exists('playground_auto_login')) {
			playground_auto_login();
		}
	}
}
`
			: `<?php

        // Allow adding filters/actions prior to loading WordPress.
        // $function_to_add MUST be a string.
        function playground_add_filter( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
            global $wp_filter;
            $wp_filter[$tag][$priority][$function_to_add] = array('function' => $function_to_add, 'accepted_args' => $accepted_args);
        }
        function playground_add_action( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
            playground_add_filter( $tag, $function_to_add, $priority, $accepted_args );
        }

        // Load our mu-plugins after customer mu-plugins
        // NOTE: this means our mu-plugins can't use the muplugins_loaded action!
        playground_add_action( 'muplugins_loaded', 'playground_load_mu_plugins', 0 );
        function playground_load_mu_plugins() {
            // Load all PHP files from /internal/shared/mu-plugins, sorted by filename
            $mu_plugins_dir = '/internal/shared/mu-plugins';
            if(!is_dir($mu_plugins_dir)){
                return;
            }
            $mu_plugins = glob( $mu_plugins_dir . '/*.php' );
            sort( $mu_plugins );
            foreach ( $mu_plugins as $mu_plugin ) {
                require_once $mu_plugin;
            }
        }
    `
	);

	/**
	 * Automatically logs the user in to aid the login Blueprint step and
	 * the Playground runtimes.
	 *
	 * There are two ways to trigger the auto-login:
	 *
	 * ## The PLAYGROUND_AUTO_LOGIN_AS_USER constant
	 *
	 * Used by the login Blueprint step does.
	 *
	 * When the PLAYGROUND_AUTO_LOGIN_AS_USER constant is defined, this mu-plugin
	 * will automatically log the user in on their first visit. The username is
	 * the value of the constant.
	 *
	 * On subsequent visits, the playground_auto_login_already_happened cookie will be
	 * detected and the user will not be logged in. This means the "logout" feature
	 * will work as expected.
	 *
	 * ## The playground_force_auto_login_as_user GET parameter
	 *
	 * Used by the "login" button in various Playground runtimes.
	 *
	 * Only works if the PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED constant is defined.
	 *
	 * When the playground_force_auto_login_as_user GET parameter is present,
	 * this mu-plugin will automatically log in any logged out visitor. This will
	 * happen every time they visit, not just on their first visit.
	 *
	 *
	 * ## Context
	 *
	 * The login step used to make a HTTP request to the /wp-login.php endpoint,
	 * but that approach had significant downsides:
	 *
	 * * It only worked in web browsers
	 * * It didn't support custom login mechanisms
	 * * It required storing plaintext passwords in the Blueprint files
	 */
	await php.writeFile(
		'/internal/shared/mu-plugins/1-auto-login.php',
		`<?php
		/**
		 * Returns the username to auto-login as, if any.
		 * @return string|false
		 */
		function playground_get_username_for_auto_login() {
			/**
			 * Allow users to auto-login as a specific user on their first visit.
			 *
			 * Prevent the auto-login if it already happened by checking for the
			 * playground_auto_login_already_happened cookie.
			 * This is used to allow the user to logout.
			 */
			if ( defined('PLAYGROUND_AUTO_LOGIN_AS_USER') && !isset($_COOKIE['playground_auto_login_already_happened']) ) {
				return PLAYGROUND_AUTO_LOGIN_AS_USER;
			}
			/**
			 * Allow users to auto-login as a specific user by passing the
			 * playground_force_auto_login_as_user GET parameter.
			 */
			if ( defined('PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED') && isset($_GET['playground_force_auto_login_as_user']) ) {
				return $_GET['playground_force_auto_login_as_user'];
			}
			return false;
		}

		/**
		 * Logs the user in on their first visit if the Playground runtime told us to.
		 */
		function playground_auto_login() {
			/**
			 * The redirect should only run if the current PHP request is
			 * a HTTP request. If it's a PHP CLI run, we can't login the user
			 * because logins require cookies which aren't available in the CLI.
			 *
			 * Currently all Playground requests use the "cli" SAPI name
			 * to ensure support for WP-CLI, so the best way to distinguish
			 * between a CLI run and an HTTP request is by checking if the
			 * $_SERVER['REQUEST_URI'] global is set.
			 *
			 * If $_SERVER['REQUEST_URI'] is not set, we assume it's a CLI run.
			 */
			if (empty($_SERVER['REQUEST_URI'])) {
				return;
			}
			$user_name = playground_get_username_for_auto_login();
			if ( false === $user_name ) {
				return;
			}
			if (${phpMajor < 7 ? "(function_exists('wp_doing_ajax') && wp_doing_ajax())" : 'wp_doing_ajax()'} || defined('REST_REQUEST')) {
				return;
			}
			${phpMajor < 7 ? LEGACY_AUTO_LOGIN_BODY : MODERN_AUTO_LOGIN_BODY}
		}
		/**
		 * Autologin users from the wp-login.php page.
		 *
		 * The wp hook isn't triggered on
		 **/
		add_action('init', 'playground_auto_login', 1);

		/**
		 * Use an intermediate redirection step to ensure the login cookies
		 * are set before we redirecting to the landing page.
		 *
		 * /wp-admin/customize.php, and potentially other pages in WordPress,
		 * run authorization checks before running the init hook. If they're
		 * set as the landing page of the Blueprint, the user will be redirected
		 * to wp-login.php?reauth=1 before we have a chance to set the
		 * authorization cookie.
		 *
		 * To avoid this, we redirect to an intermediate page that will
		 * redirect the user to the landing page.
		 */
		function playground_auto_login_redirect_target() {
			if(strpos($_SERVER['REQUEST_URI'], '?playground-redirection-handler') !== false) {
				$next = $_GET['next'];
				header('Location: ' . $next, true, 302);
				exit;
			}
		}
		add_action('init', 'playground_auto_login_redirect_target', 1);

		/**
		 * Disable the Site Admin Email Verification Screen for any session started
		 * via autologin.
		 */
		${
			phpMajor < 7
				? `if (function_exists('add_filter')) {
			add_filter('admin_email_check_interval', 'playground_disable_admin_email_check');
		}
		function playground_disable_admin_email_check($interval) {
			if(false === playground_get_username_for_auto_login()) {
				return 0;
			}
			return $interval;
		}`
				: `function playground_disable_admin_email_check($interval) {
			if(false === playground_get_username_for_auto_login()) {
				return 0;
			}
			return $interval;
		}
		add_filter('admin_email_check_interval', 'playground_disable_admin_email_check');`
		}
		`
	);

	await php.writeFile(
		'/internal/shared/mu-plugins/0-playground.php',
		`<?php

		// Save WordPress environment information to a file.
		function playground_save_wp_env_info() {
			if (defined('DB_ENGINE') && DB_ENGINE === 'sqlite') {
				$db_info = array(
					'type' => 'sqlite',
					'path' => FQDB,
					'driver_path' => defined('WP_MYSQL_ON_SQLITE_LOADER_PATH')
						? WP_MYSQL_ON_SQLITE_LOADER_PATH
						: dirname(SQLITE_MAIN_FILE) . '/wp-pdo-mysql-on-sqlite.php',
				);
			} else {
				$db_info = array(
					'type' => 'mysql',
					// TODO: Save MySQL connection config.
				);
			}
			$wp_env = array('db' => $db_info);
			$wp_env_php = sprintf('<?php return %s;', var_export($wp_env, true));
			$wp_env_file = '/internal/shared/wp-env.php';
			if (!file_exists($wp_env_file) || file_get_contents($wp_env_file) !== $wp_env_php ) {
				file_put_contents($wp_env_file, $wp_env_php);
			}
		}
		add_action('wp_loaded', 'playground_save_wp_env_info');

        // Needed because gethostbyname( 'wordpress.org' ) returns
        // a private network IP address for some reason.
        function playground_allowed_redirect_hosts( $deprecated = '' ) {
            return array(
                'wordpress.org',
                'api.wordpress.org',
                'downloads.wordpress.org',
            );
        }
        add_filter( 'allowed_redirect_hosts', 'playground_allowed_redirect_hosts' );

		/**
		 * Prevents wp_http_validate_url() from universally failing.
		 *
		 * wp_http_validate_url() calls gethostbyname() to verify whether the host
		 * is external. If it is internal, the URL validation fails and WordPress
		 * refuses to make a request.
		 *
		 * However, in EMscripten, gethostbyname() returns a private network IP address.
		 * This causes wp_http_validate_url() to return false for all URLs.
		 *
		 * This filter ensures that all URLs are considered external. In production
		 * environments, this would be considered a security risk. However, Playground
		 * already provides multiple code execution vectors as features (e.g. Blueprints).
		 *
		 * If someone wants to poke around local IP addresses, they already have multiple
		 * tools at their disposal. Therefore, this is not a real security risk in context
		 * of WordPress Playground or Playground CLI.
		 */
		add_filter('http_request_host_is_external', '__return_true');

		// Support pretty permalinks
        add_filter( 'got_url_rewrite', '__return_true' );

		/**
		 * Flush rewrite rules on the first real WordPress request.
		 *
		 * During boot, we set permalink_structure in the database
		 * but can't flush rewrite rules at that point because WordPress
		 * isn't fully bootstrapped — post types and taxonomies haven't
		 * been registered yet, so the generated rules are incomplete.
		 *
		 * This hook fires on 'init' at a very late priority, after all
		 * post types and taxonomies are registered. It checks if the
		 * rewrite_rules option is empty (meaning rules were never
		 * flushed) and if permalink_structure is set, then flushes once.
		 * A flag file prevents repeated flushes on subsequent requests.
		 */
		function playground_maybe_flush_rewrite_rules() {
			$flag = '/internal/shared/.rewrite-rules-flushed';
			if (file_exists($flag)) {
				return;
			}
			if (!function_exists('get_option')) {
				return;
			}
			$structure = get_option('permalink_structure');
			if (empty($structure)) {
				return;
			}
			$rules = get_option('rewrite_rules');
			if (!empty($rules)) {
				@file_put_contents($flag, '1');
				return;
			}
			global $wp_rewrite;
			if (!isset($wp_rewrite) && class_exists('WP_Rewrite')) {
				$wp_rewrite = new WP_Rewrite();
			}
			if (isset($wp_rewrite) && method_exists($wp_rewrite, 'flush_rules')) {
				$wp_rewrite->flush_rules();
			}
			@file_put_contents($flag, '1');
		}
		add_action('init', 'playground_maybe_flush_rewrite_rules', 99999);

        // Create the fonts directory if missing
        if(!file_exists(WP_CONTENT_DIR . '/fonts')) {
            mkdir(WP_CONTENT_DIR . '/fonts');
        }

        $log_file = WP_CONTENT_DIR . '/debug.log';
        if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
            if ( is_string( WP_DEBUG_LOG ) ) {
                $log_file = WP_DEBUG_LOG;
            }
            ini_set('error_log', $log_file);
        } else {
            ini_set('log_errors', '0');
        }
        define('ERROR_LOG_FILE', $log_file);
        ?>`
	);

	/**
	 * WordPress 6.7+ only generates the sitemap.xml → wp-sitemap.xml rewrite
	 * rule when installed at the domain root. Since Playground may use non-root
	 * installations, the rule isn't generated. This mu-plugin handles the
	 * redirect manually by using the site URL to determine the correct base path.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/issues/2051
	 */
	await php.writeFile(
		'/internal/shared/mu-plugins/sitemap-redirect.php',
		`<?php
		/**
		 * Redirect sitemap.xml to wp-sitemap.xml for non-root installations.
		 *
		 * WordPress seems to only generate the sitemap.xml → wp-sitemap.xml rewrite
		 * rule when installed at the domain root. This mu-plugin handles the
		 * redirect for non-root installations.
		 */
		if (isset($_SERVER['REQUEST_URI'])) {
			$site_url = site_url();
			$parsed = parse_url($site_url);
			$base_path = isset($parsed['path']) ? rtrim($parsed['path'], '/') : '';

			$request_uri = $_SERVER['REQUEST_URI'];
			if (
				$request_uri === $base_path . '/sitemap.xml' ||
				strpos($request_uri, $base_path . '/sitemap.xml?') === 0 ||
				strpos($request_uri, $base_path . '/sitemap.xml/') === 0
			) {
				$query_string = strpos($request_uri, '?') !== false ? substr($request_uri, strpos($request_uri, '?')) : '';
				header('Location: ' . $base_path . '/wp-sitemap.xml' . $query_string, true, 301);
				exit;
			}
		}
		`
	);

	// TinyMCE's editor iframe uses document.open(), which creates a
	// document not controlled by the service worker. Sub-resource
	// requests from it (content_css) bypass the SW and 404.
	// Inline the CSS via content_style so no network request is needed.
	await php.writeFile(
		'/internal/shared/mu-plugins/inline-tinymce-content-css.php',
		`<?php
		function playground_inline_tinymce_content_css($settings) {
			if (empty($settings['content_css'])) return $settings;
			$css_urls = explode(',', $settings['content_css']);
			$inline_css = '';
			$doc_root = isset($_SERVER['DOCUMENT_ROOT'])
				? $_SERVER['DOCUMENT_ROOT'] : '/wordpress';
			foreach ($css_urls as $url) {
				$url = trim($url);
				if (!$url) continue;
				$parsed = parse_url($url);
				if (!isset($parsed['path'])) continue;
				$path = preg_replace('#^/scope:[^/]+#', '', $parsed['path']);
				$file = $doc_root . $path;
				if (file_exists($file)) {
					$inline_css .= @file_get_contents($file) . "\\n";
				}
			}
			if ($inline_css !== '') {
				if (!empty($settings['content_style'])) {
					$inline_css = $settings['content_style'] . "\\n" . $inline_css;
				}
				$settings['content_style'] = $inline_css;
				$settings['content_css'] = '';
			}
			return $settings;
		}
		add_filter('tiny_mce_before_init', 'playground_inline_tinymce_content_css');
		`
	);

	// Load the error handler before any other PHP file to ensure it
	// treats all the errors, even those trigerred before mu-plugins
	// are loaded.
	await php.writeFile(
		'/internal/shared/preload/error-handler.php',
		`<?php
		${
			isPhp52
				? `
// PHP 5.2 does not support anonymous functions. Use a named function instead.
$GLOBALS['_playground_consts'] = array();
if (file_exists('/internal/shared/consts.json')) {
	$GLOBALS['_playground_consts'] = @json_decode(file_get_contents('/internal/shared/consts.json'), true);
	if (!is_array($GLOBALS['_playground_consts'])) { $GLOBALS['_playground_consts'] = array(); }
	$GLOBALS['_playground_consts'] = array_keys($GLOBALS['_playground_consts']);
}
function _playground_error_handler($severity, $message, $file, $line) {
	$playground_consts = $GLOBALS['_playground_consts'];
`
				: `
		${phpMajor < 7 ? 'call_user_func(function() {' : '(function() {'}
			$playground_consts = [];
			if(file_exists('/internal/shared/consts.json')) {
				$playground_consts = @json_decode(file_get_contents('/internal/shared/consts.json'), true) ?: [];
				$playground_consts = array_keys($playground_consts);
			}
			set_error_handler(function($severity, $message, $file, $line) use($playground_consts) {`
		}
				/**
				 * Networking support in Playground registers a http_api_transports filter.
				 *
				 * This filter is deprecated, and no longer actively used, but is needed for wp_http_supports().
				 * @see https://core.trac.wordpress.org/ticket/37708
				 */
				if (
					strpos($message, "http_api_transports") !== false &&
					strpos($message, "since version 6.4.0 with no alternative available") !== false
				) {
					return;
				}
				/**
				 * Playground defines some constants upfront, and some of them may be redefined
				 * in wp-config.php. For example, SITE_URL or WP_DEBUG. This is expected and
				 * we want Playground constants to take priority without showing warnings like:
				 *
				 * Warning: Constant SITE_URL already defined in
				 */
				if (strpos($message, "already defined") !== false) {
					foreach($playground_consts as $const) {
						if(strpos($message, "Constant $const already defined") !== false) {
							return;
						}
					}
				}
				/**
				 * Legacy WordPress (2.0–3.5) assigns properties on
				 * uninitialized variables ($obj->prop = value), which
				 * was valid in PHP 4 but triggers E_WARNING in PHP 5.x.
				 * These are benign and cannot be fixed in WP core since
				 * Playground downloads unmodified WordPress releases.
				 */
				if (strpos($message, "Creating default object from empty value") !== false) {
					return;
				}
				/**
				 * SimplePie/RSS errors when feeds can't be fetched in WASM.
				 * WP 2.8's dashboard widget calls get_error_string() on a
				 * null SimplePie object when HTTP requests fail.
				 */
				if (strpos($message, "get_error_string() on null") !== false ||
					strpos($message, "get_error_string() on a non-object") !== false) {
					return;
				}
				/**
				 * Don't complain about network errors when not connected to the network.
				 */
				if (
					(
						! defined('USE_FETCH_FOR_REQUESTS') ||
						! USE_FETCH_FOR_REQUESTS
					) &&
					strpos($message, "WordPress could not establish a secure connection to WordPress.org") !== false)
				{
					return;
				}
				return false;
			${isPhp52 ? '}' : '});'}
		${isPhp52 ? "set_error_handler('_playground_error_handler');" : phpMajor < 7 ? '});' : '})();'}`
	);
}

/**
 * Runs phpinfo() when the requested path is /phpinfo.php.
 */
export async function preloadPhpInfoRoute(
	php: UniversalPHP,
	requestPath = '/phpinfo.php'
) {
	await php.writeFile(
		'/internal/shared/preload/phpinfo.php',
		`<?php
    // Render PHPInfo if the requested page is /phpinfo.php
    if ( isset($_SERVER['REQUEST_URI']) && ${phpVar(
		requestPath
	)} === $_SERVER['REQUEST_URI'] ) {
        phpinfo();
        exit;
    }
    `
	);
}

export interface SqliteIntegrationOptions {
	phpVersion?: string;
}

export async function preloadSqliteIntegration(
	php: UniversalPHP,
	sqliteZip: File,
	options: SqliteIntegrationOptions = {}
) {
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

	const phpMajor = parseInt(options.phpVersion ?? '8', 10);

	// WP 5.0–6.1 compat: the SQLite plugin declares
	// `private $allow_unsafe_unquoted_parameters` on WP_SQLite_DB and
	// then, from `prepare()`, calls `$this->__get(...)` expecting WP's
	// wpdb::__get() to return the parent's property. That works on WP
	// 6.2+ (wpdb declares the same property upstream) but blows up on
	// older WordPress, where wpdb's __get() runs `return $this->$name;`
	// from the parent class context and PHP refuses to read a child
	// class's *private* member — producing a silent fatal Error that
	// kills install.php and every subsequent request. Widening the
	// declaration to `protected` lets both class contexts reach it and
	// leaves behaviour identical on every supported WordPress version.
	if (phpMajor >= 7) {
		const sqliteDbClassPath = joinPaths(
			SQLITE_PLUGIN_FOLDER,
			'wp-includes/sqlite/class-wp-sqlite-db.php'
		);
		if (await php.fileExists(sqliteDbClassPath)) {
			const classSource = await php.readFileAsText(sqliteDbClassPath);
			const patched = classSource.replace(
				'private $allow_unsafe_unquoted_parameters',
				'protected $allow_unsafe_unquoted_parameters'
			);
			if (patched !== classSource) {
				await php.writeFile(sqliteDbClassPath, patched);
			}
		}
	}

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
	if (phpMajor < 7) {
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
	}
	const dbPhpPath = joinPaths(await php.documentRoot, 'wp-content/db.php');
	const SQLITE_MUPLUGIN_PATH =
		'/internal/shared/mu-plugins/sqlite-database-integration.php';

	// Playground writes a @playground-managed db.php drop-in for both
	// legacy and modern WordPress (see boot.ts). The preload guard
	// must therefore recognise our own marker and *not* skip itself
	// on its own file — a blind `file_exists` guard (trunk's old
	// behaviour) would short-circuit the lazy-$wpdb setup on every
	// request. Only a real user-supplied db.php should abort the
	// preload.
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
		phpMajor < 7
			? buildLegacySqlitePreload(dbPhpGuard, SQLITE_MUPLUGIN_PATH, phpVar)
			: buildModernSqlitePreload(dbPhpGuard, SQLITE_MUPLUGIN_PATH, phpVar)
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
 * Builds the 0-sqlite.php preload content for modern PHP (7+).
 * Matches trunk behavior: require_once, simple db.php guard,
 * minimal mysqli_connect stub.
 */
function buildModernSqlitePreload(
	dbPhpGuard: string,
	muPluginPath: string,
	phpVarFn: typeof phpVar
): string {
	return `<?php
${dbPhpGuard}?>
<?php

${SQLITE_PRELOAD_LOADER_CLASS(
	// Modern PHP: use require_once (trunk behavior)
	`require_once ${phpVarFn(muPluginPath)};`
)}
if(!function_exists('mysqli_connect')) {
	function mysqli_connect() {}
}

		`;
}

/**
 * Builds the 0-sqlite.php preload content for legacy PHP (< 7).
 * Includes MySQL/MySQLi stubs, str_* polyfills, and error suppression.
 */
function buildLegacySqlitePreload(
	dbPhpGuard: string,
	muPluginPath: string,
	phpVarFn: typeof phpVar
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
	`require_once ${phpVarFn(muPluginPath)};
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

/**
 * The shared Playground_SQLite_Integration_Loader class definition,
 * parameterized by the load_sqlite_integration() body.
 */
function SQLITE_PRELOAD_LOADER_CLASS(loadBody: string): string {
	return `
/**
 * Loads the SQLite integration plugin before WordPress is loaded
 * and without creating a drop-in "db.php" file.
 *
 * Technically, it creates a global $wpdb object whose only two
 * purposes are to:
 *
 * * Exist – because the require_wp_db() WordPress function won't
 *           connect to MySQL if $wpdb is already set.
 * * Load the SQLite integration plugin the first time it's used
 *   and replace the global $wpdb reference with the SQLite one.
 *
 * This lets Playground keep the WordPress installation clean and
 * solves dillemas like:
 *
 * * Should we include db.php in Playground exports?
 * * Should we remove db.php from Playground imports?
 * * How should we treat stale db.php from long-lived OPFS sites?
 *
 * @see https://github.com/WordPress/wordpress-playground/discussions/1379 for
 *      more context.
 */
class Playground_SQLite_Integration_Loader {
	public function __call($name, $arguments) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		return call_user_func_array(
			array($GLOBALS['wpdb'], $name),
			$arguments
		);
	}
	public function __get($name) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		return $GLOBALS['wpdb']->$name;
	}
	public function __set($name, $value) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		$GLOBALS['wpdb']->$name = $value;
	}
    protected function load_sqlite_integration() {
        ${loadBody}
    }
}
/**
 * The Query Monitor plugin short-circuits in the CLI SAPI. However, in Playground,
 * the SAPI is always "cli" at the moment. Let's set a constant to disable the CLI
 * detection.
 *
 * @see https://github.com/WordPress/sqlite-database-integration/pull/212
 * @see https://github.com/WordPress/sqlite-database-integration/pull/215
 */
define('QM_TESTS', true);
$wpdb = $GLOBALS['wpdb'] = new Playground_SQLite_Integration_Loader();

/**
 * WordPress is capable of using a preloaded global $wpdb. However, if
 * it cannot find the drop-in db.php plugin it still checks whether
 * the mysqli_connect() function exists even though it's not used.
 *
 * What WordPress demands, Playground shall provide.
 */
`;
}

/**
 * Prepare the WordPress document root given a WordPress zip file and
 * the sqlite-database-integration zip file.
 *
 * This is a TypeScript function for now, just to get something off the
 * ground, but it may be superseded by the PHP Blueprints library developed
 * at https://github.com/WordPress/blueprints-library/
 *
 * That PHP library will come with a set of functions and a CLI tool to
 * turn a Blueprint into a WordPress directory structure or a zip Snapshot.
 * Let's **not** invest in the TypeScript implementation of this function,
 * accept the limitation, and switch to the PHP implementation as soon
 * as that's viable.
 */
export async function unzipWordPress(php: PHP, wpZip: File) {
	php.mkdir('/tmp/unzipped-wordpress');
	await unzipFile(php, wpZip, '/tmp/unzipped-wordpress');

	// The zip file may contain another zip file if it's coming from GitHub
	// artifacts @TODO: Don't make so many guesses about the zip file contents.
	// Allow the API consumer to specify the exact "coordinates" of WordPress
	// inside the zip archive.
	if (php.fileExists('/tmp/unzipped-wordpress/wordpress.zip')) {
		await unzipFile(
			php,
			'/tmp/unzipped-wordpress/wordpress.zip',
			'/tmp/unzipped-wordpress'
		);
	}

	// The zip file may contain a subdirectory, or not.
	// @TODO: Don't make so many guesses about the zip file contents. Allow the
	//        API consumer to specify the exact "coordinates" of WordPress inside
	//        the zip archive.
	let wpPath = php.fileExists('/tmp/unzipped-wordpress/wordpress')
		? '/tmp/unzipped-wordpress/wordpress'
		: php.fileExists('/tmp/unzipped-wordpress/build')
			? '/tmp/unzipped-wordpress/build'
			: '/tmp/unzipped-wordpress';

	// Dive one directory deeper if the zip root does not contain the sample
	// config file. This is relevant when unzipping a zipped branch from the
	// https://github.com/WordPress/WordPress repository.
	if (!php.fileExists(joinPaths(wpPath, 'wp-config-sample.php'))) {
		// Still don't know the directory structure of the zip file.
		// 1. Get the first item in path.
		const files = php.listFiles(wpPath);
		if (files.length) {
			const firstDir = files[0];
			// 2. If it's a directory that contains wp-config-sample.php, use it.
			if (
				php.fileExists(
					joinPaths(wpPath, firstDir, 'wp-config-sample.php')
				)
			) {
				wpPath = joinPaths(wpPath, firstDir);
			}
		}
	}

	const moveRecursively = (source: string, target: string, php: PHP) => {
		if (php.isDir(source) && php.isDir(target)) {
			// We cannot move a directory over another directory,
			// so we move the children one by one.
			for (const file of php.listFiles(source)) {
				const sourcePath = joinPaths(source, file);
				const targetPath = joinPaths(target, file);
				moveRecursively(sourcePath, targetPath, php);
			}
		} else {
			if (php.fileExists(target)) {
				// Refuse to overwrite existing files to avoid the chance of data loss.
				const wpPath = source.replace(
					/^\/tmp\/unzipped-wordpress\//,
					'/'
				);
				logger.warn(
					`Cannot unzip WordPress files at ${target}: ${wpPath} already exists.`
				);
				return;
			}
			php.mv(source, target);
		}
	};
	moveRecursively(wpPath, php.documentRoot, php);
	// Remove any directories left because there were existing dirs at the target path.
	if (php.fileExists(wpPath)) {
		php.rmdir(wpPath, { recursive: true });
	}

	if (
		!php.fileExists(joinPaths(php.documentRoot, 'wp-config.php')) &&
		php.fileExists(joinPaths(php.documentRoot, 'wp-config-sample.php'))
	) {
		php.writeFile(
			joinPaths(php.documentRoot, 'wp-config.php'),
			php.readFileAsText(
				joinPaths(php.documentRoot, '/wp-config-sample.php')
			)
		);
	}
}

const memoizedFetch = createMemoizedFetch(fetch);

/**
 * Resolves a specific WordPress release URL and version string based on
 * a version query string such as "latest", "beta", or "6.6".
 *
 * Examples:
 * ```js
 * const { releaseUrl, version } = await resolveWordPressRelease('latest')
 * // becomes https://wordpress.org/wordpress-6.6.2.zip and '6.6.2'
 *
 * const { releaseUrl, version } = await resolveWordPressRelease('beta')
 * // becomes https://wordpress.org/wordpress-6.6.2-RC1.zip and '6.6.2-RC1'
 *
 * const { releaseUrl, version } = await resolveWordPressRelease('6.6')
 * // becomes https://wordpress.org/wordpress-6.6.2.zip and '6.6.2'
 * ```
 *
 * @param versionQuery - The WordPress version query string to resolve.
 * @returns The resolved WordPress release URL and version string.
 */
const WORDPRESS_TRUNK_ZIP_URL =
	'https://github.com/WordPress/WordPress/archive/refs/heads/master.zip';

export async function resolveWordPressRelease(versionQuery = 'latest') {
	if (versionQuery === null) {
		versionQuery = 'latest';
	} else if (
		versionQuery.startsWith('https://') ||
		versionQuery.startsWith('http://')
	) {
		const shasum = await crypto.subtle.digest(
			'SHA-1',
			new TextEncoder().encode(versionQuery)
		);
		const sha1 = Array.from(new Uint8Array(shasum))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
		return {
			releaseUrl: versionQuery,
			version: 'custom-' + sha1.substring(0, 8),
			source: 'inferred',
		};
	} else if (versionQuery === 'trunk' || versionQuery === 'nightly') {
		const cacheBust = new Date().toISOString().split('T')[0];
		return {
			releaseUrl: `${WORDPRESS_TRUNK_ZIP_URL}?ts=${cacheBust}`,
			version: 'trunk',
			source: 'inferred',
		};
	}

	const response = await memoizedFetch(
		'https://api.wordpress.org/core/version-check/1.7/?channel=beta'
	);
	let latestVersions = await response.json();

	latestVersions = latestVersions.offers.filter(
		(v: any) => v.response === 'autoupdate'
	);

	for (const apiVersion of latestVersions) {
		if (
			versionQuery === 'beta' &&
			(apiVersion.version.includes('beta') ||
				apiVersion.version.includes('RC'))
		) {
			return {
				releaseUrl: apiVersion.download,
				version: apiVersion.version,
				source: 'api',
			};
		} else if (
			versionQuery === 'latest' &&
			!apiVersion.version.includes('beta') &&
			!apiVersion.version.includes('RC')
		) {
			// The first non-beta item in the list is the latest version.
			return {
				releaseUrl: apiVersion.download,
				version: apiVersion.version,
				source: 'api',
			};
		} else if (
			apiVersion.version.substring(0, versionQuery.length) ===
			versionQuery
		) {
			return {
				releaseUrl: apiVersion.download,
				version: apiVersion.version,
				source: 'api',
			};
		}
	}

	/**
	 * Replace "6.8.0" with "6.8" to support installing the exact "6.8.0" release.
	 *
	 * The remote release ZIP file URL for 6.8.0 is `https://wordpress.org/wordpress-6.8.zip`.
	 * However, we already resolve `6.8` to the latest patch version, so that's not an option.
	 * Therefore, version "6.8.0" can be resolved by requesting a version string "6.8.0", which
	 * we then convert to "6.8" to construct the correct remote ZIP file URL.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/issues/2749
	 */
	if (versionQuery.match(/^\d+\.\d+\.0$/)) {
		versionQuery = versionQuery.split('.').slice(0, 2).join('.');
	}

	return {
		releaseUrl: `https://wordpress.org/wordpress-${versionQuery}.zip`,
		version: versionQuery,
		source: 'inferred',
	};
}
