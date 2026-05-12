<?php
/**
 * Tests for SSGWP_Path_Utils.
 *
 * @package PlaygroundStaticSiteGenerator
 */

define( 'ABSPATH', __DIR__ );

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
		return ssgwp_test_url( 'https://example.test/wp-content', $path );
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
		return ssgwp_test_url( 'https://example.test/wp-includes', $path );
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
