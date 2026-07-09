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
 * Auto-login body for legacy WordPress, dispatching to the cookie/auth
 * API actually present at runtime:
 *   WP 2.5+   — wp_set_current_user() + wp_set_auth_cookie() (HMAC).
 *   WP 1.5–2.4 — USER_COOKIE/PASS_COOKIE constants + double-md5.
 *   WP 1.0–1.2 — wordpressuser_/wordpresspass_ cookies + globals.
 */
const LEGACY_AUTO_LOGIN_BODY = `
			if (function_exists('is_user_logged_in') && is_user_logged_in()) {
				return;
			}
			if (headers_sent()) {
				return;
			}

			// Legacy auto-login never redirects; it populates $_COOKIE
			// in-process for the current request and relies on
			// setcookie() / wp_set_auth_cookie() to persist across
			// requests via HttpCookieStore.

			// WP 2.5+
			if (function_exists('wp_set_current_user') && function_exists('wp_set_auth_cookie')) {
				$user = function_exists('get_user_by')
					? get_user_by('login', $user_name)
					: (function_exists('get_userdatabylogin')
						? get_userdatabylogin($user_name) : null);
				if (!$user) return;

				wp_set_current_user($user->ID, $user->user_login);
				// Populate $_COOKIE in-process so auth_redirect() and
				// wp_verify_nonce() see the session for the remainder
				// of this request; wp_set_auth_cookie() also emits
				// Set-Cookie for subsequent requests.
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
				return;
			}

			// WP 1.5–2.4
			if (defined('USER_COOKIE') && defined('PASS_COOKIE')) {
				$_pg_pass_cookie = md5(md5('password'));
				$_COOKIE[USER_COOKIE] = $user_name;
				$_COOKIE[PASS_COOKIE] = $_pg_pass_cookie;
				if (!headers_sent()) {
					$_pg_exp = time() + 172800;
					setcookie(USER_COOKIE, $user_name, $_pg_exp, '/');
					setcookie(PASS_COOKIE, $_pg_pass_cookie, $_pg_exp, '/');
				}
				$GLOBALS['current_user'] = null;
				if (function_exists('get_currentuserinfo')) {
					get_currentuserinfo();
				}
				return;
			}

			// WP 1.0–1.2: cookies are usually already set by
			// playground_legacy_set_auth_cookies_early() in env.php,
			// but WP 1.0–1.2 reads its user state from globals (no
			// WP_User), so populate those explicitly here.
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
				if (!headers_sent()) {
					$_pg_exp = time() + 172800;
					setcookie($_pg_user_cookie_name, $user_name, $_pg_exp, '/');
					setcookie($_pg_pass_cookie_name, $_pg_pass_cookie_value, $_pg_exp, '/');
				}
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
	php: UniversalPHP
): Promise<void> {
	await php.mkdir('/internal/shared/mu-plugins');

	// Overwrite auto_prepend_file.php to add PHP 4 superglobal
	// polyfills that WP 1.0-2.5 needs. The default
	// auto_prepend_file only loads consts and preload files;
	// legacy PHP also needs the superglobals set up first.
	await php.writeFile(
		'/internal/shared/auto_prepend_file.php',
		`<?php
// Polyfill the PHP 4 superglobals WP 1.0–2.5 still reads (removed
// in PHP 5.4). Bind by reference so later writes to $_COOKIE
// reach $HTTP_COOKIE_VARS, which WP 1.0's get_currentuserinfo()
// consults.
$GLOBALS['HTTP_GET_VARS']     = &$_GET;
$GLOBALS['HTTP_POST_VARS']    = &$_POST;
$GLOBALS['HTTP_COOKIE_VARS']  = &$_COOKIE;
$GLOBALS['HTTP_SERVER_VARS']  = &$_SERVER;
if (isset($_FILES))   $GLOBALS['HTTP_POST_FILES']   = &$_FILES;
if (isset($_ENV))     $GLOBALS['HTTP_ENV_VARS']     = &$_ENV;
if (isset($_SESSION)) $GLOBALS['HTTP_SESSION_VARS'] = &$_SESSION;
// Top-level names register_globals=On used to expose. WP 1.0
// reads $PHP_SELF / $REMOTE_ADDR directly instead of $_SERVER.
if (isset($_SERVER['PHP_SELF'])) $GLOBALS['PHP_SELF'] = $_SERVER['PHP_SELF'];
if (isset($_SERVER['REMOTE_ADDR'])) $GLOBALS['REMOTE_ADDR'] = $_SERVER['REMOTE_ADDR'];
if (isset($_SERVER['REQUEST_URI'])) $GLOBALS['REQUEST_URI'] = $_SERVER['REQUEST_URI'];
// Default SERVER_PROTOCOL for scripts invoked outside an HTTP
// request (e.g. php.run() during boot/fixups) — legacy WP reads
// it unconditionally in places like wp_redirect().
if (!isset($_SERVER['SERVER_PROTOCOL'])) {
	$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
}
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
// Buffer early output so a stray PHP notice doesn't commit the
// response headers before the auto-login mu-plugin gets a chance
// to call wp_set_auth_cookie() / setcookie() on the init hook —
// otherwise nonce validation breaks on POST requests. PHP flushes
// the buffer at script end so output still reaches the browser.
ob_start();
`
	);

	await php.writeFile(
		'/internal/shared/preload/env.php',
		`<?php
// Reads $wp_version from the WordPress install on disk. Falls back
// to '1.0' so callers can use version_compare() unconditionally.
function _playground_detect_wp_version() {
	static $version = null;
	if ($version !== null) return $version;
	$doc_root = isset($_SERVER['DOCUMENT_ROOT'])
		? $_SERVER['DOCUMENT_ROOT'] : '/wordpress';
	$version_path = $doc_root . '/wp-includes/version.php';
	$wp_version = '1.0';
	if (file_exists($version_path)) {
		include $version_path;
	}
	$version = $wp_version;
	return $version;
}

// Returns 'wp10', 'wp12', or 'wp15' based on the WP version on
// disk — the three $wp_filter shapes apply_filters() understands.
function _playground_detect_wp_hook_format() {
	static $format = null;
	if ($format !== null) return $format;
	$wp_version = _playground_detect_wp_version();
	if (version_compare($wp_version, '1.5', '>=')) {
		$format = 'wp15';
	} elseif (version_compare($wp_version, '1.2', '>=')) {
		$format = 'wp12';
	} else {
		$format = 'wp10';
	}
	return $format;
}

// Adds filters/actions before WordPress is loaded by writing the
// $wp_filter shape the target version expects. $function_to_add
// MUST be a string (no closures).
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

// Set WP 1.0–2.4 auth cookies before WordPress loads — by the time
// the init hook fires (and on WP 1.0–1.2 it may not fire at all on
// the front page) WordPress has already read $_COOKIE. setcookie()
// also persists them across requests via HttpCookieStore.
// WP 2.5+ uses the HMAC auth cookie scheme and doesn't read these
// wordpressuser_/wordpresspass_ cookies at all — bail there so we
// don't write inert cookies the runtime would have to clean up.
function playground_legacy_set_auth_cookies_early() {
	if (!defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) return;
	if (isset($_COOKIE['playground_auto_login_already_logged_out'])) return;
	if (version_compare(_playground_detect_wp_version(), '2.5', '>=')) return;

	foreach ($_COOKIE as $name => $_) {
		if (strncmp($name, 'wordpressuser_', 14) === 0) return;
	}

	$user_name = PLAYGROUND_AUTO_LOGIN_AS_USER;
	$pass_md5 = md5(md5('password'));

	// Read siteurl from SQLite so the cookie hash matches what
	// WP 1.0–2.4 derives from get_settings('siteurl').
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

// WP < 4.0 emits YEAR(post_date)='2026' AND MONTH(post_date)='4'
// against MySQL's loose type coercion. The SQLite driver's UDFs
// return integers and SQLite is strictly typed (4 != '4'), so
// strip quotes around numeric RHS values to keep both sides ints.
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

// WP 2.2+ checks WP_SITEURL/WP_HOME inside get_option(); WP <2.2
// doesn't, so backfill the same behaviour via the option filters
// to keep admin links on the Playground-scoped URL.
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

// Load mu-plugins last so customer mu-plugins win — and so they
// can't depend on muplugins_loaded. WP < 2.8 doesn't fire that
// action at all, so init -1000 acts as a fallback (the $loaded
// flag keeps it idempotent).
playground_add_action( 'muplugins_loaded', 'playground_load_mu_plugins', 0 );
playground_add_action( 'init', 'playground_load_mu_plugins', -1000 );
function playground_load_mu_plugins() {
	static $loaded = false;
	if ($loaded) return;
	$loaded = true;
	$mu_plugins_dir = '/internal/shared/mu-plugins';
	if(!is_dir($mu_plugins_dir)){
		return;
	}
	$mu_plugins = glob( $mu_plugins_dir . '/*.php' );
	sort( $mu_plugins );
	global $wp_version;
	$is_legacy_wp = isset($wp_version) && version_compare($wp_version, '2.8', '<');
	foreach ( $mu_plugins as $mu_plugin ) {
		// Loaded separately by the preload lazy loader or db.php.
		if (strpos($mu_plugin, 'sqlite-database-integration') !== false) {
			continue;
		}
		// WP < 2.8 crashes on closures in hooks and lacks
		// site_url() (added 2.6). 1-auto-login.php is written
		// without either, so it's the only mu-plugin we load
		// on legacy WP.
		if ($is_legacy_wp) {
			if (strpos($mu_plugin, '1-auto-login.php') === false) {
				continue;
			}
		}
		require_once $mu_plugin;
	}

	// PHP 5.x's foreach over $wp_filter['init'] iterates a copy,
	// so add_action() calls made by the mu-plugin we just loaded
	// won't fire on this same init run. Call them directly.
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

	// Loaded before any other PHP file so it catches errors from
	// the very first line, including the preload phase. Named
	// function + $GLOBALS so the same source works on PHP 5.2
	// (no closures) through 8.x.
	await php.writeFile(
		'/internal/shared/preload/error-handler.php',
		`<?php
$GLOBALS['_playground_consts'] = array();
if (file_exists('/internal/shared/consts.json')) {
	$GLOBALS['_playground_consts'] = @json_decode(file_get_contents('/internal/shared/consts.json'), true);
	if (!is_array($GLOBALS['_playground_consts'])) { $GLOBALS['_playground_consts'] = array(); }
	$GLOBALS['_playground_consts'] = array_keys($GLOBALS['_playground_consts']);
}
function _playground_error_handler($severity, $message, $file, $line) {
	$playground_consts = $GLOBALS['_playground_consts'];
${ERROR_HANDLER_BODY}
	return false;
}
set_error_handler('_playground_error_handler');`
	);
}

const ERROR_HANDLER_BODY = `
		// http_api_transports is deprecated since 6.4.0 but Playground's
		// networking layer still registers it for wp_http_supports().
		// @see https://core.trac.wordpress.org/ticket/37708
		if (
			strpos($message, "http_api_transports") !== false &&
			strpos($message, "since version 6.4.0 with no alternative available") !== false
		) {
			return;
		}
		// Playground predefines constants (SITE_URL, WP_DEBUG, …) that
		// wp-config.php is allowed to redefine; ours take precedence.
		if (strpos($message, "already defined") !== false) {
			foreach($playground_consts as $const) {
				if(strpos($message, "Constant $const already defined") !== false) {
					return;
				}
			}
		}
		// Legacy WP (2.0–3.5) assigns props on uninitialised vars,
		// valid in PHP 4 but E_WARNING since 5.x. Unfixable in core —
		// Playground ships unmodified WordPress releases.
		if (strpos($message, "Creating default object from empty value") !== false) {
			return;
		}
		// WP 2.8's dashboard widget calls get_error_string() on a
		// null SimplePie when feed HTTP requests fail in WASM.
		if (strpos($message, "get_error_string() on null") !== false ||
			strpos($message, "get_error_string() on a non-object") !== false) {
			return;
		}
		// Don't complain about WordPress.org connection errors when
		// the runtime isn't using fetch().
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
