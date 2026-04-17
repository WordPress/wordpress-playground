/**
 * Platform-level mu-plugin setup for legacy PHP (< 7) running old
 * WordPress (1.0–2.8). Self-contained mirror of
 * {@link setupPlatformLevelMuPlugins} in index.ts — the modern
 * function dispatches here when isLegacyPHPVersion(phpVersion) is
 * true, and this file owns every PHP string that differs from the
 * modern path.
 *
 * The three common mu-plugins (0-playground.php, sitemap-redirect,
 * inline-tinymce-content-css) are shared with the modern path via
 * {@link writeCommonPlatformMuPlugins} to avoid duplicating ~200
 * lines of identical PHP.
 */
import type { UniversalPHP } from '@php-wasm/universal';
import { writeCommonPlatformMuPlugins } from '../platform-mu-plugins';

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
 * Full legacy version of {@link setupPlatformLevelMuPlugins}. Writes
 * a custom auto_prepend_file, legacy-aware preload env.php, legacy
 * auto-login mu-plugin, the common platform mu-plugins, and the PHP
 * 5.2 variant of the error handler.
 */
export async function setupLegacyPlatformLevelMuPlugins(
	php: UniversalPHP,
	options: { phpVersion?: string } = {}
): Promise<void> {
	const isPhp52 = (options.phpVersion ?? '') === '5.2';
	await php.mkdir('/internal/shared/mu-plugins');

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

	await php.writeFile(
		'/internal/shared/preload/env.php',
		`<?php
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
	);

	/**
	 * Automatically logs the user in to aid the login Blueprint step and
	 * the Playground runtimes. See the modern counterpart in
	 * index.ts for the shared doc.
	 */
	await php.writeFile(
		'/internal/shared/mu-plugins/1-auto-login.php',
		`<?php
		/**
		 * Returns the username to auto-login as, if any.
		 * @return string|false
		 */
		function playground_get_username_for_auto_login() {
			if ( defined('PLAYGROUND_AUTO_LOGIN_AS_USER') && !isset($_COOKIE['playground_auto_login_already_happened']) ) {
				return PLAYGROUND_AUTO_LOGIN_AS_USER;
			}
			if ( defined('PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED') && isset($_GET['playground_force_auto_login_as_user']) ) {
				return $_GET['playground_force_auto_login_as_user'];
			}
			return false;
		}

		function playground_auto_login() {
			if (empty($_SERVER['REQUEST_URI'])) {
				return;
			}
			$user_name = playground_get_username_for_auto_login();
			if ( false === $user_name ) {
				return;
			}
			if ((function_exists('wp_doing_ajax') && wp_doing_ajax()) || defined('REST_REQUEST')) {
				return;
			}
			${LEGACY_AUTO_LOGIN_BODY}
		}
		add_action('init', 'playground_auto_login', 1);

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
		if (function_exists('add_filter')) {
			add_filter('admin_email_check_interval', 'playground_disable_admin_email_check');
		}
		function playground_disable_admin_email_check($interval) {
			if(false === playground_get_username_for_auto_login()) {
				return 0;
			}
			return $interval;
		}
		`
	);

	await writeCommonPlatformMuPlugins(php);

	// Load the error handler before any other PHP file to ensure it
	// treats all the errors, even those trigerred before mu-plugins
	// are loaded.
	//
	// PHP 5.2 doesn't support anonymous functions — use a named
	// function + set_error_handler. Legacy PHP 5.3+ uses a closure
	// inside call_user_func() because return statements inside the
	// handler are swallowed if written as top-level statements in
	// PHP < 7.
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
		call_user_func(function() {
			$playground_consts = [];
			if(file_exists('/internal/shared/consts.json')) {
				$playground_consts = @json_decode(file_get_contents('/internal/shared/consts.json'), true) ?: [];
				$playground_consts = array_keys($playground_consts);
			}
			set_error_handler(function($severity, $message, $file, $line) use($playground_consts) {`
		}
				${ERROR_HANDLER_BODY}
				return false;
			${isPhp52 ? '}' : '});'}
		${isPhp52 ? "set_error_handler('_playground_error_handler');" : '});'}`
	);
}

/**
 * The error-handler body — identical for PHP 5.2, legacy PHP (5.3–6),
 * and modern PHP. Kept as a constant so the surrounding boilerplate
 * (named function vs closure) can be switched independently.
 */
const ERROR_HANDLER_BODY = `
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
`;
