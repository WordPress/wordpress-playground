<?php
/**
 * PHP 5.2-compatible minimal version of 0-playground.php.
 *
 * PHP 5.2 does not support anonymous functions (closures), so this
 * file replaces the full 0-playground.php for PHP 5.2 only. It
 * provides the essential HTTP transport setup and WP Cron disable
 * using named functions throughout.
 */

// WordPress < 3.0 can't handle hook callbacks via add_action/add_filter
// without an initialized $wp_filter. Check it's safe to register hooks.
if (!function_exists('add_action') || !function_exists('add_filter')) {
	return;
}

/**
 * Set up the HTTP transport. On PHP 5.2 we still need to register a
 * Fetch or Dummy transport so that wp_remote_*() calls don't crash.
 */
// PHP 5.2 always uses the Dummy transport. wp_http_dummy.php and
// wp_http_fetch.php both use PHP 5.3+ namespace syntax that causes
// parse errors on PHP 5.2, so define the transport class inline here.
//
// The class is named Wp_Http_Dummy because WP_Http::_dispatch_request()
// prepends "WP_Http_" to entries from the http_api_transports filter.
// Returning array('Dummy') makes WP look for WP_Http_Dummy, which
// matches this class (PHP class names are case-insensitive).
//
// The class does not implement the Requests_Transport interface
// because the Requests library may not be loaded yet at mu-plugin
// time. The before_request action below sets the transport directly,
// bypassing the library's interface check.
if (!class_exists('Wp_Http_Dummy')) {
	/**
	 * Minimal dummy HTTP transport for PHP 5.2.
	 * Does not perform any HTTP requests; just satisfies WP_Http.
	 */
	class Wp_Http_Dummy {
		public $headers = '';
		public function __construct() {}
		public function request($url, $headers = array(), $data = array(), $options = array()) {
			return false;
		}
		public function request_multiple($requests, $options) {
			$responses = array();
			foreach ($requests as $id => $request) {
				$responses[$id] = false;
			}
			return $responses;
		}
		public static function test($capabilities = array()) {
			return true;
		}
	}
}
$__requests_class = class_exists('Requests') ? 'Requests' : null;
if ($__requests_class) {
	call_user_func(array($__requests_class, 'add_transport'), 'Wp_Http_Dummy');
}
add_action('requests-requests.before_request', '_pg52_set_dummy_transport', 10, 5);
add_filter('http_api_transports', '_pg52_dummy_transports');

function _pg52_set_dummy_transport($url, $headers, $data, $type, &$options) {
	$options['transport'] = 'Wp_Http_Dummy';
}

function _pg52_dummy_transports() {
	return array('Dummy');
}

// Disable WP Cron on legacy WordPress only. On PHP 5.2 the HTTP API
// is stubbed with Wp_Http_Dummy (see above), so every spawn-cron
// request would return false and WordPress would quietly retry
// forever. Short-circuit the /wp-cron.php endpoint so nothing loops.
//
// Modern 0-playground.php intentionally does NOT define this: on PHP
// 7+ the Fetch transport works, so WP Cron can run for real. Keep
// this block legacy-only.
define('DISABLE_WP_CRON', true);
if (substr($_SERVER['PHP_SELF'], -12) === '/wp-cron.php') {
	header('HTTP/1.1 503 Service Unavailable');
	header('Content-Type: text/plain');
	echo 'WP Cron is temporarily disabled in the Playground.';
	exit;
}
