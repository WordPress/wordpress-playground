<?php
/**
 * Tests for SSGWP_Path_Utils.
 *
 * @package PlaygroundStaticSiteGenerator
 */

define( 'ABSPATH', __DIR__ );

$ssgwp_test_home_url     = 'https://example.test/';
$ssgwp_test_site_url     = 'https://example.test/';
$ssgwp_test_content_url  = 'https://example.test/wp-content';
$ssgwp_test_includes_url = 'https://example.test/wp-includes';

if ( ! function_exists( 'wp_normalize_path' ) ) {
	/**
	 * Normalize paths for tests.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function wp_normalize_path( $path ) {
		return str_replace( '\\', '/', (string) $path );
	}
}

if ( ! function_exists( 'trailingslashit' ) ) {
	/**
	 * Add a trailing slash.
	 *
	 * @param string $value Value.
	 * @return string
	 */
	function trailingslashit( $value ) {
		return rtrim( (string) $value, "/\\" ) . '/';
	}
}

if ( ! function_exists( 'untrailingslashit' ) ) {
	/**
	 * Remove trailing slashes.
	 *
	 * @param string $value Value.
	 * @return string
	 */
	function untrailingslashit( $value ) {
		return rtrim( (string) $value, "/\\" );
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {
	/**
	 * Parse a URL for tests.
	 *
	 * @param string $url       URL.
	 * @param int    $component URL component.
	 * @return mixed
	 */
	function wp_parse_url( $url, $component = -1 ) {
		return -1 === $component ? parse_url( $url ) : parse_url( $url, $component );
	}
}

if ( ! function_exists( 'content_url' ) ) {
	/**
	 * Return a content URL for tests.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function content_url( $path = '' ) {
		global $ssgwp_test_content_url;

		return ssgwp_test_url( $ssgwp_test_content_url, $path );
	}
}

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * Return a home URL for tests.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function home_url( $path = '' ) {
		global $ssgwp_test_home_url;

		return ssgwp_test_url( $ssgwp_test_home_url, $path );
	}
}

if ( ! function_exists( 'includes_url' ) ) {
	/**
	 * Return an includes URL for tests.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function includes_url( $path = '' ) {
		global $ssgwp_test_includes_url;

		return ssgwp_test_url( $ssgwp_test_includes_url, $path );
	}
}

if ( ! function_exists( 'site_url' ) ) {
	/**
	 * Return a site URL for tests.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function site_url( $path = '' ) {
		global $ssgwp_test_site_url;

		return ssgwp_test_url( $ssgwp_test_site_url, $path );
	}
}

/**
 * Append a path to a test URL.
 *
 * @param string $base Base URL.
 * @param string $path Path.
 * @return string
 */
function ssgwp_test_url( $base, $path ) {
	return rtrim( $base, '/' ) . '/' . ltrim( $path, '/' );
}

require_once dirname( __DIR__ ) . '/includes/class-path-utils.php';

ssgwp_assert_same(
	'uploads/2026/My-File-.css',
	SSGWP_Path_Utils::sanitize_relative_path( 'uploads/../2026/My File!.css' ),
	'sanitize_relative_path removes unsafe segments and characters.'
);

ssgwp_assert_same(
	'static-page/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/static-page/' ),
	'url_to_export_file_path maps pretty permalink paths to index.html files.'
);

ssgwp_assert_same(
	'static-page-' . substr( md5( 'view=print' ), 0, 8 ) . '.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/static-page/', 'view=print' ),
	'url_to_export_file_path maps page query variants to hashed HTML files.'
);

ssgwp_assert_same(
	'encoded%20page/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/encoded%20page/' ),
	'url_to_export_file_path preserves encoded page path segments.'
);

ssgwp_assert_same(
	'collision%20page/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/collision%20page/' ),
	'url_to_export_file_path keeps encoded spaces distinct.'
);

ssgwp_assert_same(
	'collision%2Bpage/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/collision+page/' ),
	'url_to_export_file_path keeps literal plus signs distinct.'
);

ssgwp_assert_same(
	'nested%2Fpage/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/nested%2Fpage/' ),
	'url_to_export_file_path keeps encoded slashes inside one segment.'
);

ssgwp_assert_same(
	'%2E%2E/secret/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/%2e%2e/secret/' ),
	'url_to_export_file_path keeps encoded parent segments literal.'
);

$ssgwp_test_home_url = 'https://playground.wordpress.net/scope:sad-quiet-school/';
$ssgwp_test_site_url = 'https://playground.wordpress.net/scope:sad-quiet-school/';

ssgwp_assert_same(
	'sample-page/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/scope:sad-quiet-school/sample-page/' ),
	'url_to_export_file_path strips a Playground scope deployment base once.'
);

ssgwp_assert_same(
	'sample-page/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/scope%3Asad-quiet-school/sample-page/' ),
	'url_to_export_file_path strips an encoded Playground scope deployment base.'
);

ssgwp_assert_same(
	'scope%3Asad-quiet-school/sample-page/index.html',
	SSGWP_Path_Utils::url_to_export_file_path( '/scope:sad-quiet-school/scope:sad-quiet-school/sample-page/' ),
	'url_to_export_file_path removes only one Playground scope deployment base.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::has_deployment_base_path(),
	'has_deployment_base_path detects scoped Playground deployments.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::is_url_path_under_deployment_base( '/scope:sad-quiet-school/sample-page/' ),
	'is_url_path_under_deployment_base accepts paths inside the current scope.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::is_url_path_under_deployment_base( '/scope%3Asad-quiet-school/sample-page/' ),
	'is_url_path_under_deployment_base accepts encoded current scope paths.'
);

ssgwp_assert_false(
	SSGWP_Path_Utils::is_url_path_under_deployment_base( '/scope:other-site/sample-page/' ),
	'is_url_path_under_deployment_base rejects paths from a different scope.'
);

$ssgwp_test_home_url = 'https://example.test/';
$ssgwp_test_site_url = 'https://example.test/';

ssgwp_assert_false(
	SSGWP_Path_Utils::has_deployment_base_path(),
	'has_deployment_base_path ignores root deployments.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::url_to_export_file_path( '/collision%20page/' )
		!== SSGWP_Path_Utils::url_to_export_file_path( '/collision+page/' ),
	'url_to_export_file_path avoids normalization collisions for encoded segments.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::has_parent_segment( '../secret.txt' ),
	'has_parent_segment rejects leading parent segments.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::has_parent_segment( 'assets/%2e%2e/secret.txt' ),
	'has_parent_segment rejects encoded parent segments.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::has_parent_segment( 'assets/..' ),
	'has_parent_segment rejects trailing parent segments.'
);

ssgwp_assert_false(
	SSGWP_Path_Utils::has_parent_segment( 'assets/..hidden/file.css' ),
	'has_parent_segment allows harmless dot substrings.'
);

$fixture_dir = ssgwp_make_fixture_dir();
mkdir( $fixture_dir . '/assets' );
file_put_contents(
	$fixture_dir . '/assets/style.css',
	'body{}'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

ssgwp_assert_same(
	wp_normalize_path( $fixture_dir . '/assets/style.css' ),
	SSGWP_Path_Utils::resolve_child_file_path( $fixture_dir, 'assets/style.css' ),
	'resolve_child_file_path accepts readable child files.'
);

ssgwp_assert_same(
	null,
	SSGWP_Path_Utils::resolve_child_file_path( $fixture_dir, 'assets/../secret.css' ),
	'resolve_child_file_path rejects explicit parent segments.'
);

ssgwp_assert_same(
	null,
	SSGWP_Path_Utils::resolve_child_file_path( $fixture_dir, 'assets/%2e%2e/secret.css' ),
	'resolve_child_file_path rejects encoded parent segments.'
);

ssgwp_assert_same(
	'wp-content/themes/theme/style.css',
	SSGWP_Path_Utils::map_wordpress_asset_url_path( '/wp-content/themes/theme/style.css' ),
	'map_wordpress_asset_url_path preserves wp-content layout.'
);

ssgwp_assert_same(
	'wp-includes/js/script.js',
	SSGWP_Path_Utils::map_wordpress_asset_url_path( '/wp-includes/js/script.js' ),
	'map_wordpress_asset_url_path preserves wp-includes layout.'
);

$ssgwp_test_content_url  = 'https://playground.wordpress.net/scope:sad-quiet-school/wp-content';
$ssgwp_test_includes_url = 'https://playground.wordpress.net/scope:sad-quiet-school/wp-includes';

ssgwp_assert_same(
	'wp-content/themes/theme/style.css',
	SSGWP_Path_Utils::map_wordpress_asset_url_path( '/scope:sad-quiet-school/wp-content/themes/theme/style.css' ),
	'map_wordpress_asset_url_path strips scoped wp-content deployment paths.'
);

ssgwp_assert_same(
	'wp-includes/js/script.js',
	SSGWP_Path_Utils::map_wordpress_asset_url_path( '/scope:sad-quiet-school/wp-includes/js/script.js' ),
	'map_wordpress_asset_url_path strips scoped wp-includes deployment paths.'
);

$ssgwp_test_content_url  = 'https://example.test/wp-content';
$ssgwp_test_includes_url = 'https://example.test/wp-includes';

ssgwp_assert_true(
	SSGWP_Path_Utils::is_path_inside_directory( '/tmp/export/file.css', '/tmp/export' ),
	'is_path_inside_directory accepts child paths.'
);

ssgwp_assert_true(
	SSGWP_Path_Utils::is_path_inside_directory( '/tmp/export', '/tmp/export' ),
	'is_path_inside_directory accepts the directory itself.'
);

ssgwp_assert_false(
	SSGWP_Path_Utils::is_path_inside_directory( '/tmp/exported/file.css', '/tmp/export' ),
	'is_path_inside_directory rejects shared-prefix siblings.'
);

/**
 * Assert two values are identical.
 *
 * @param mixed  $expected Expected value.
 * @param mixed  $actual   Actual value.
 * @param string $message  Failure message.
 */
function ssgwp_assert_same( $expected, $actual, $message ) {
	if ( $expected === $actual ) {
		return;
	}

	ssgwp_fail( $message . ' Expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) . '.' );
}

/**
 * Assert a value is true.
 *
 * @param bool   $actual  Actual value.
 * @param string $message Failure message.
 */
function ssgwp_assert_true( $actual, $message ) {
	if ( true === $actual ) {
		return;
	}

	ssgwp_fail( $message );
}

/**
 * Assert a value is false.
 *
 * @param bool   $actual  Actual value.
 * @param string $message Failure message.
 */
function ssgwp_assert_false( $actual, $message ) {
	if ( false === $actual ) {
		return;
	}

	ssgwp_fail( $message );
}

/**
 * Create a temporary fixture directory.
 *
 * @return string
 */
function ssgwp_make_fixture_dir() {
	$directory = sys_get_temp_dir() . '/ssgwp-path-utils-' . getmypid() . '-' . mt_rand();

	if ( ! mkdir( $directory ) ) {
		ssgwp_fail( 'Could not create fixture directory.' );
	}

	return wp_normalize_path( $directory );
}

/**
 * Exit with a test failure.
 *
 * @param string $message Failure message.
 */
function ssgwp_fail( $message ) {
	fwrite( STDERR, $message . PHP_EOL ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
	exit( 1 );
}
