<?php
/**
 * Tests for SSGWP_Static_Exporter internals.
 *
 * @package PlaygroundStaticSiteGenerator
 */

$fixture_root = sys_get_temp_dir() . '/ssgwp-static-exporter-' . getmypid() . '-' . mt_rand();
$navigation_dir = $fixture_root . '/wp-includes/blocks/navigation';

if ( ! mkdir( $navigation_dir, 0777, true ) ) {
	ssgwp_fail( 'Could not create fixture directory.' );
}

file_put_contents(
	$navigation_dir . '/style.min.css',
	'.wp-block-navigation{display:flex}'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

define( 'ABSPATH', $fixture_root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'SSGWP_VERSION', '0.1.0' );

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

if ( ! function_exists( 'includes_url' ) ) {
	/**
	 * Return an includes URL for tests.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function includes_url( $path = '' ) {
		return 'https://example.test/wp-includes/' . ltrim( $path, '/' );
	}
}

if ( ! function_exists( 'get_bloginfo' ) ) {
	/**
	 * Return test site metadata.
	 *
	 * @param string $show Metadata key.
	 * @return string
	 */
	function get_bloginfo( $show = '' ) {
		return 'version' === $show ? '6.9.4' : '';
	}
}

if ( ! function_exists( 'add_query_arg' ) ) {
	/**
	 * Add a query argument to a URL for tests.
	 *
	 * @param string $key   Query key.
	 * @param string $value Query value.
	 * @param string $url   URL.
	 * @return string
	 */
	function add_query_arg( $key, $value, $url ) {
		$separator = false === strpos( $url, '?' ) ? '?' : '&';

		return $url . $separator . rawurlencode( $key ) . '=' . rawurlencode( $value );
	}
}

if ( ! function_exists( 'esc_url' ) ) {
	/**
	 * Escape a URL for tests.
	 *
	 * @param string $url URL.
	 * @return string
	 */
	function esc_url( $url ) {
		return htmlspecialchars( (string) $url, ENT_QUOTES );
	}
}

if ( ! function_exists( 'esc_attr' ) ) {
	/**
	 * Escape an HTML attribute for tests.
	 *
	 * @param string $value Value.
	 * @return string
	 */
	function esc_attr( $value ) {
		return htmlspecialchars( (string) $value, ENT_QUOTES );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-path-utils.php';
require_once dirname( __DIR__ ) . '/includes/class-static-exporter.php';

$exporter = new SSGWP_Static_Exporter();

$method = new ReflectionMethod( $exporter, 'inject_missing_core_block_styles' );
$method->setAccessible( true );

$html = '<html><head><title>Test</title><style>.wp-block-audio{display:block}</style></head><body><nav class="wp-block-navigation wp-block-navigation-is-layout-flex"></nav></body></html>';
$html = $method->invoke( $exporter, $html );

ssgwp_assert_contains(
	'<link rel="stylesheet" id="wp-block-navigation-css" href="https://example.test/wp-includes/blocks/navigation/style.min.css?ver=6.9.4" media="all" />',
	$html,
	'inject_missing_core_block_styles injects the Navigation block stylesheet.'
);

ssgwp_assert_not_contains(
	'wp-block-navigation-is-layout-flex-css',
	$html,
	'inject_missing_core_block_styles ignores layout helper classes.'
);

ssgwp_assert_not_contains(
	'wp-block-audio-css',
	$html,
	'inject_missing_core_block_styles ignores block classes inside style tags.'
);

$html_with_link = $method->invoke(
	$exporter,
	'<html><head><link rel="stylesheet" id="wp-block-navigation-css" href="/already-loaded.css" /></head><body><nav class="wp-block-navigation"></nav></body></html>'
);

ssgwp_assert_same(
	1,
	substr_count( $html_with_link, 'wp-block-navigation-css' ),
	'inject_missing_core_block_styles does not duplicate existing core block styles.'
);

$progress_property = new ReflectionProperty( $exporter, 'progress_callback' );
$progress_property->setAccessible( true );

$events = array();
$progress_property->setValue(
	$exporter,
	static function ( $event ) use ( &$events ) {
		$events[] = $event;
	}
);

$progress_method = new ReflectionMethod( $exporter, 'report_progress' );
$progress_method->setAccessible( true );
$progress_method->invoke(
	$exporter,
	'render_page',
	'Rendering https://example.test/.',
	array(
		'url'            => 'https://example.test/',
		'queue_position' => 1,
		'queue_total'    => 3,
	)
);

ssgwp_assert_same(
	'render_page',
	$events[0]['stage'],
	'report_progress calls the configured callback with the stage.'
);

ssgwp_assert_same(
	3,
	$events[0]['context']['queue_total'],
	'report_progress preserves structured context.'
);

ssgwp_delete_directory( $fixture_root );

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
 * Assert a string contains a substring.
 *
 * @param string $needle  Expected substring.
 * @param string $haystack String to search.
 * @param string $message Failure message.
 */
function ssgwp_assert_contains( $needle, $haystack, $message ) {
	if ( false !== strpos( $haystack, $needle ) ) {
		return;
	}

	ssgwp_fail( $message . ' Missing ' . var_export( $needle, true ) . '.' );
}

/**
 * Assert a string does not contain a substring.
 *
 * @param string $needle  Unexpected substring.
 * @param string $haystack String to search.
 * @param string $message Failure message.
 */
function ssgwp_assert_not_contains( $needle, $haystack, $message ) {
	if ( false === strpos( $haystack, $needle ) ) {
		return;
	}

	ssgwp_fail( $message . ' Unexpected ' . var_export( $needle, true ) . '.' );
}

/**
 * Delete a directory recursively.
 *
 * @param string $directory Directory.
 */
function ssgwp_delete_directory( $directory ) {
	if ( ! is_dir( $directory ) ) {
		return;
	}

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $directory, FilesystemIterator::SKIP_DOTS ),
		RecursiveIteratorIterator::CHILD_FIRST
	);

	foreach ( $iterator as $item ) {
		if ( $item->isDir() ) {
			rmdir( $item->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
		} else {
			unlink( $item->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
		}
	}

	rmdir( $directory ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
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
