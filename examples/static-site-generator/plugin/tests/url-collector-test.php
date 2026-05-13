<?php
/**
 * Tests for SSGWP_URL_Collector.
 *
 * @package PlaygroundStaticSiteGenerator
 */

define( 'ABSPATH', __DIR__ );

$ssgwp_test_home_url = 'https://example.test/';

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

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * Return the test home URL.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function home_url( $path = '' ) {
		global $ssgwp_test_home_url;

		return rtrim( $ssgwp_test_home_url, '/' ) . '/' . ltrim( $path, '/' );
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

if ( ! function_exists( 'remove_query_arg' ) ) {
	/**
	 * Remove one query argument from a URL.
	 *
	 * @param string $key Query key.
	 * @param string $url URL.
	 * @return string
	 */
	function remove_query_arg( $key, $url ) {
		$parts = wp_parse_url( $url );

		if ( empty( $parts['query'] ) ) {
			return $url;
		}

		parse_str( $parts['query'], $query_args );
		unset( $query_args[ $key ] );

		$query = http_build_query( $query_args, '', '&', PHP_QUERY_RFC3986 );
		$base  = strtok( $url, '?' );

		return $base . ( '' === $query ? '' : '?' . $query );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	/**
	 * Return test options.
	 *
	 * @param string $option Option name.
	 * @return mixed
	 */
	function get_option( $option ) {
		return 'permalink_structure' === $option ? '/%postname%/' : null;
	}
}

if ( ! function_exists( 'wp_parse_str' ) ) {
	/**
	 * Parse a query string.
	 *
	 * @param string $string Query string.
	 * @param array  $array  Parsed output.
	 */
	function wp_parse_str( $string, &$array ) {
		parse_str( $string, $array );
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	/**
	 * Check whether a value is a WP_Error.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	function is_wp_error( $value ) {
		return false;
	}
}

require_once dirname( __DIR__ ) . '/includes/class-path-utils.php';
require_once dirname( __DIR__ ) . '/includes/class-url-collector.php';

$collector = new SSGWP_URL_Collector();

ssgwp_assert_same(
	'https://example.test/static-page/',
	$collector->normalize_url( 'https://example.test/static-page/' ),
	'normalize_url keeps a same-origin URL without an explicit port.'
);

ssgwp_assert_same(
	'https://example.test/static-page/',
	$collector->normalize_url( 'https://EXAMPLE.test/static-page/' ),
	'normalize_url canonicalizes URL hosts to lowercase.'
);

ssgwp_assert_same(
	'https://example.test/static-page/',
	$collector->normalize_url( 'https://example.test:443/static-page/' ),
	'normalize_url treats the explicit HTTPS default port as same-origin.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'https://example.test:8443/static-page/' ),
	'normalize_url rejects a different explicit port.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'http://example.test:443/static-page/' ),
	'normalize_url rejects a different scheme even when the port matches.'
);

$ssgwp_test_home_url = 'http://example.test:9400/';

ssgwp_assert_same(
	'http://example.test:9400/static-page/',
	$collector->normalize_url( 'http://example.test:9400/static-page/' ),
	'normalize_url keeps a same-origin custom port.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'http://example.test/static-page/' ),
	'normalize_url rejects a missing port when the home URL uses a custom port.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'https://example.test:9400/static-page/' ),
	'normalize_url rejects a different scheme on the same custom port.'
);

$ssgwp_test_home_url = 'https://playground.wordpress.net/scope:sad-quiet-school/';

ssgwp_assert_same(
	'https://playground.wordpress.net/scope:sad-quiet-school/static-page/',
	$collector->normalize_url( 'https://playground.wordpress.net/scope:sad-quiet-school/static-page/' ),
	'normalize_url accepts URLs under the current Playground scope.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'https://playground.wordpress.net/scope:other-site/static-page/' ),
	'normalize_url rejects same-host URLs from a different Playground scope.'
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

	ssgwp_fail(
		$message . ' Expected ' . var_export( $expected, true )
			. ', got ' . var_export( $actual, true ) . '.'
	);
}

/**
 * Exit with a test failure.
 *
 * @param string $message Failure message.
 */
function ssgwp_fail( $message ) {
	fwrite(
		STDERR,
		$message . PHP_EOL
	); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
	exit( 1 );
}
