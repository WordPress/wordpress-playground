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
define( 'WP_CONTENT_DIR', $fixture_root . '/wp-content' );
define( 'SSGWP_VERSION', '0.1.0' );
define( 'MB_IN_BYTES', 1024 * 1024 );

$ssgwp_test_home_url = 'https://example.test/';
$ssgwp_test_site_url = 'https://example.test/';

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

if ( ! function_exists( 'wp_mkdir_p' ) ) {
	/**
	 * Create a directory recursively.
	 *
	 * @param string $target Directory path.
	 * @return bool Whether the directory exists.
	 */
	function wp_mkdir_p( $target ) {
		return is_dir( $target ) || mkdir( $target, 0777, true );
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

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * Return a test home URL.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function home_url( $path = '' ) {
		global $ssgwp_test_home_url;

		return rtrim( $ssgwp_test_home_url, '/' ) . '/' . ltrim( $path, '/' );
	}
}

if ( ! function_exists( 'site_url' ) ) {
	/**
	 * Return a test site URL.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function site_url( $path = '' ) {
		global $ssgwp_test_site_url;

		return rtrim( $ssgwp_test_site_url, '/' ) . '/' . ltrim( $path, '/' );
	}
}

if ( ! function_exists( 'content_url' ) ) {
	/**
	 * Return a test content URL.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function content_url( $path = '' ) {
		return 'https://example.test/wp-content/' . ltrim( $path, '/' );
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

if ( ! function_exists( 'remove_query_arg' ) ) {
	/**
	 * Remove query arguments from a URL for tests.
	 *
	 * @param string|string[] $keys Query key or keys.
	 * @param string          $url  URL.
	 * @return string URL without the query keys.
	 */
	function remove_query_arg( $keys, $url ) {
		$parts = wp_parse_url( $url );

		if ( empty( $parts['query'] ) ) {
			return $url;
		}

		parse_str( $parts['query'], $query_args );

		foreach ( (array) $keys as $key ) {
			unset( $query_args[ $key ] );
		}

		$query = http_build_query( $query_args, '', '&', PHP_QUERY_RFC3986 );
		$base  = ( isset( $parts['scheme'] ) ? $parts['scheme'] . '://' : '' )
			. ( isset( $parts['host'] ) ? $parts['host'] : '' )
			. ( isset( $parts['path'] ) ? $parts['path'] : '' );

		return $base . ( '' !== $query ? '?' . $query : '' );
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	/**
	 * Merge user arguments with defaults for tests.
	 *
	 * @param array $args     User arguments.
	 * @param array $defaults Default arguments.
	 * @return array Merged arguments.
	 */
	function wp_parse_args( $args, $defaults = array() ) {
		return array_merge( $defaults, (array) $args );
	}
}

if ( ! function_exists( 'wp_parse_str' ) ) {
	/**
	 * Parse a query string for tests.
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
	 * Check whether a value is a WP_Error for tests.
	 *
	 * @param mixed $value Value.
	 * @return bool Whether the value is a WP_Error.
	 */
	function is_wp_error( $value ) {
		return $value instanceof WP_Error;
	}
}

if ( ! function_exists( 'get_option' ) ) {
	/**
	 * Return simple option values for tests.
	 *
	 * @param string $name    Option name.
	 * @param mixed  $default Default value.
	 * @return mixed Option value.
	 */
	function get_option( $name, $default = false ) {
		if ( 'permalink_structure' === $name ) {
			return '/%postname%/';
		}

		if ( 'posts_per_page' === $name ) {
			return 10;
		}

		return $default;
	}
}

if ( ! function_exists( 'get_post' ) ) {
	/**
	 * Return no post in static exporter tests.
	 *
	 * @param int $post_id Post ID.
	 * @return null No post.
	 */
	function get_post( $post_id ) {
		return null;
	}
}

if ( ! function_exists( 'wp_remote_get' ) ) {
	/**
	 * Return a successful HTML response for tests.
	 *
	 * @param string $url  URL.
	 * @param array  $args Request args.
	 * @return array Response.
	 */
	function wp_remote_get( $url, $args = array() ) {
		return array(
			'response' => array( 'code' => 200 ),
			'headers'  => array( 'content-type' => 'text/html; charset=UTF-8' ),
			'body'     => '<html><head><title>Export</title></head><body>Exported</body></html>',
		);
	}
}

if ( ! function_exists( 'wp_remote_retrieve_response_code' ) ) {
	/**
	 * Retrieve a response status code for tests.
	 *
	 * @param array $response Response.
	 * @return int Status code.
	 */
	function wp_remote_retrieve_response_code( $response ) {
		return isset( $response['response']['code'] ) ? (int) $response['response']['code'] : 0;
	}
}

if ( ! function_exists( 'wp_remote_retrieve_header' ) ) {
	/**
	 * Retrieve a response header for tests.
	 *
	 * @param array  $response Response.
	 * @param string $name     Header name.
	 * @return string Header value.
	 */
	function wp_remote_retrieve_header( $response, $name ) {
		$key = strtolower( $name );

		return isset( $response['headers'][ $key ] ) ? $response['headers'][ $key ] : '';
	}
}

if ( ! function_exists( 'wp_remote_retrieve_body' ) ) {
	/**
	 * Retrieve a response body for tests.
	 *
	 * @param array $response Response.
	 * @return string Body.
	 */
	function wp_remote_retrieve_body( $response ) {
		return isset( $response['body'] ) ? $response['body'] : '';
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	/**
	 * Encode JSON for tests.
	 *
	 * @param mixed $data    Data.
	 * @param int   $options JSON options.
	 * @return string JSON.
	 */
	function wp_json_encode( $data, $options = 0 ) {
		return json_encode( $data, $options );
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

if ( ! class_exists( 'WP_Error' ) ) {
	/**
	 * Minimal WP_Error test double.
	 */
	class WP_Error {
		/**
		 * Error code.
		 *
		 * @var string
		 */
		private $code;

		/**
		 * Error message.
		 *
		 * @var string
		 */
		private $message;

		/**
		 * Constructor.
		 *
		 * @param string $code    Error code.
		 * @param string $message Error message.
		 */
		public function __construct( $code, $message ) {
			$this->code    = $code;
			$this->message = $message;
		}

		/**
		 * Get the error code.
		 *
		 * @return string
		 */
		public function get_error_code() {
			return $this->code;
		}

		/**
		 * Get the error message.
		 *
		 * @return string
		 */
		public function get_error_message() {
			return $this->message;
		}
	}
}

require_once dirname( __DIR__ ) . '/includes/class-path-utils.php';
require_once dirname( __DIR__ ) . '/includes/class-url-collector.php';
require_once dirname( __DIR__ ) . '/includes/class-url-rewriter.php';
require_once dirname( __DIR__ ) . '/includes/class-static-exporter.php';

$exporter = new SSGWP_Static_Exporter();

$effective_port_method = new ReflectionMethod( $exporter, 'effective_url_port' );
$effective_port_method->setAccessible( true );

ssgwp_assert_same(
	443,
	$effective_port_method->invoke( $exporter, array( 'scheme' => 'https' ) ),
	'effective_url_port returns the HTTPS default port.'
);

ssgwp_assert_same(
	8443,
	$effective_port_method->invoke(
		$exporter,
		array(
			'scheme' => 'https',
			'port'   => 8443,
		)
	),
	'effective_url_port preserves explicit custom ports.'
);

$render_method = new ReflectionMethod( $exporter, 'render_url_in_process' );
$render_method->setAccessible( true );

$render_error = $render_method->invoke( $exporter, 'http://example.test:443/static-page/' );

ssgwp_assert_same(
	'ssgwp_not_same_site_scheme',
	$render_error->get_error_code(),
	'render_url_in_process rejects a different scheme before rendering.'
);

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

$url_to_file_path_method = new ReflectionMethod( $exporter, 'url_to_file_path' );
$url_to_file_path_method->setAccessible( true );

ssgwp_assert_same(
	'collision%20page/index.html',
	$url_to_file_path_method->invoke( $exporter, 'https://example.test/collision%20page/' ),
	'url_to_file_path keeps encoded spaces distinct from other sanitized paths.'
);

ssgwp_assert_same(
	'collision%2Bpage/index.html',
	$url_to_file_path_method->invoke( $exporter, 'https://example.test/collision+page/' ),
	'url_to_file_path keeps literal plus signs distinct from encoded spaces.'
);

ssgwp_assert_same(
	'nested%2Fsegment/index.html',
	$url_to_file_path_method->invoke( $exporter, 'https://example.test/nested%2Fsegment/' ),
	'url_to_file_path keeps encoded slashes inside one exported path segment.'
);

ssgwp_assert_same(
	'%2E%2E/secret/index.html',
	$url_to_file_path_method->invoke( $exporter, 'https://example.test/%2e%2e/secret/' ),
	'url_to_file_path keeps encoded parent segments literal.'
);

ssgwp_assert_same(
	'nested/segment/index.html',
	$url_to_file_path_method->invoke( $exporter, 'https://example.test/nested/segment/' ),
	'url_to_file_path maps decoded slashes to nested exported directories.'
);

ssgwp_assert_same(
	true,
	$url_to_file_path_method->invoke( $exporter, 'https://example.test/nested%2Fsegment/' )
		!== $url_to_file_path_method->invoke( $exporter, 'https://example.test/nested/segment/' ),
	'url_to_file_path avoids encoded-slash normalization collisions.'
);

$view_hash = substr( md5( 'view=grid' ), 0, 8 );

ssgwp_assert_same(
	'collision%20page-' . $view_hash . '.html',
	$url_to_file_path_method->invoke( $exporter, 'https://example.test/collision%20page/?view=grid' ),
	'url_to_file_path keeps encoded paths distinct when adding query hashes.'
);

$ssgwp_test_home_url = 'https://playground.wordpress.net/scope:sad-quiet-school/';
$ssgwp_test_site_url = 'https://playground.wordpress.net/scope:sad-quiet-school/';

ssgwp_assert_same(
	'ssgwp_not_deployment_base',
	$render_method->invoke( $exporter, 'https://playground.wordpress.net/scope:other-site/static-page/' )->get_error_code(),
	'render_url_in_process rejects same-host URLs from a different Playground scope.'
);

ssgwp_assert_same(
	'sample-page/index.html',
	$url_to_file_path_method->invoke( $exporter, 'https://playground.wordpress.net/scope:sad-quiet-school/sample-page/' ),
	'url_to_file_path strips the Playground scope base from exported page paths.'
);

ssgwp_assert_same(
	'scope%3Asad-quiet-school/sample-page/index.html',
	$url_to_file_path_method->invoke( $exporter, 'https://playground.wordpress.net/scope:sad-quiet-school/scope:sad-quiet-school/sample-page/' ),
	'url_to_file_path does not duplicate-strip a repeated Playground scope segment.'
);

$ssgwp_test_home_url = 'https://example.test/';
$ssgwp_test_site_url = 'https://example.test/';

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

$bounded_output_dir = $fixture_root . '/bounded-export';
$bounded_events     = array();

set_error_handler(
	static function ( $severity, $message ) {
		ssgwp_fail( 'export_to_directory emitted a warning: ' . $message );
	}
);

$bounded_result = $exporter->export_to_directory(
	$bounded_output_dir,
	array(
		'max_pages'         => 1,
		'copy_uploads'      => false,
		'copy_theme'        => false,
		'copy_plugins'      => false,
		'copy_core_assets'  => false,
		'include_manifest'  => false,
		'progress_callback' => static function ( $event ) use ( &$bounded_events ) {
			$bounded_events[] = $event;
		},
	)
);

restore_error_handler();

ssgwp_assert_same(
	array( 'https://example.test/' ),
	$bounded_result['exported_urls'],
	'export_to_directory exports the bounded initial queue without warnings.'
);

ssgwp_assert_same(
	true,
	file_exists( $bounded_output_dir . '/index.html' ),
	'export_to_directory writes the bounded home page export.'
);

ssgwp_assert_same(
	'discovered',
	$bounded_events[0]['stage'],
	'export_to_directory reports initial URL discovery before rendering.'
);

ssgwp_assert_same(
	1,
	$bounded_events[0]['context']['max_pages'],
	'export_to_directory passes max_pages into initial URL discovery.'
);

ssgwp_assert_same(
	1,
	$bounded_events[0]['context']['queue_total'],
	'export_to_directory bounds the initial URL queue by max_pages.'
);

wp_mkdir_p( $fixture_root . '/theme/static-site-generator' );
file_put_contents( $fixture_root . '/theme/archive.phar', 'phar' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents( $fixture_root . '/theme/template.phtml', '<?php' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents( $fixture_root . '/theme/.env', 'SECRET=value' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents( $fixture_root . '/theme/style.css', 'body{color:red}' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents( $fixture_root . '/theme/style.css.map', '{}' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

$filter_phar = $exporter->filter_copied_path( new SplFileInfo( $fixture_root . '/theme/archive.phar' ) );
$filter_phtml = $exporter->filter_copied_path( new SplFileInfo( $fixture_root . '/theme/template.phtml' ) );
$filter_hidden = $exporter->filter_copied_path( new SplFileInfo( $fixture_root . '/theme/.env' ) );
$filter_css = $exporter->filter_copied_path( new SplFileInfo( $fixture_root . '/theme/style.css' ) );
$filter_map = $exporter->filter_copied_path( new SplFileInfo( $fixture_root . '/theme/style.css.map' ) );
$filter_named_dir = $exporter->filter_copied_path( new SplFileInfo( $fixture_root . '/theme/static-site-generator' ) );

ssgwp_assert_same(
	false,
	$filter_phar,
	'filter_copied_path rejects PHAR files from copied theme and plugin assets.'
);

ssgwp_assert_same(
	false,
	$filter_phtml,
	'filter_copied_path rejects PHTML files from copied theme and plugin assets.'
);

ssgwp_assert_same(
	false,
	$filter_hidden,
	'filter_copied_path rejects hidden files from copied theme and plugin assets.'
);

ssgwp_assert_same(
	true,
	$filter_css,
	'filter_copied_path keeps regular static assets.'
);

ssgwp_assert_same(
	false,
	$filter_map,
	'filter_copied_path rejects source maps from bulk copied assets.'
);

$is_exportable_asset_file_method = new ReflectionMethod( $exporter, 'is_exportable_asset_file' );
$is_exportable_asset_file_method->setAccessible( true );

ssgwp_assert_same(
	true,
	$is_exportable_asset_file_method->invoke( $exporter, $fixture_root . '/theme/style.css.map', true ),
	'is_exportable_asset_file allows explicitly linked source maps.'
);

ssgwp_assert_same(
	true,
	$filter_named_dir,
	'filter_copied_path keeps ordinary directories named static-site-generator.'
);

$copy_method = new ReflectionMethod( $exporter, 'copy_path' );
$copy_method->setAccessible( true );

$output_dir = $fixture_root . '/export';
wp_mkdir_p( $output_dir );

$current_output_dir_property = new ReflectionProperty( $exporter, 'current_output_dir' );
$current_output_dir_property->setAccessible( true );
$current_output_dir_property->setValue( $exporter, wp_normalize_path( realpath( $output_dir ) ) );

file_put_contents( $fixture_root . '/single-plugin.php', '<?php echo "secret";' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents( $fixture_root . '/single-plugin.css', 'body{color:red}' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

$copy_method->invoke(
	$exporter,
	$fixture_root . '/single-plugin.php',
	$output_dir . '/wp-content/plugins/single-plugin.php'
);
$copy_method->invoke(
	$exporter,
	$fixture_root . '/single-plugin.css',
	$output_dir . '/wp-content/plugins/single-plugin.css'
);

ssgwp_assert_same(
	false,
	file_exists( $output_dir . '/wp-content/plugins/single-plugin.php' ),
	'copy_path rejects single-file PHP plugins before writing them to the export.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/single-plugin.css' ),
	'copy_path still copies single-file static assets.'
);

$copy_linked_asset_method = new ReflectionMethod( $exporter, 'copy_linked_asset' );
$copy_linked_asset_method->setAccessible( true );

$warnings_property = new ReflectionProperty( $exporter, 'warnings' );
$warnings_property->setAccessible( true );
$warnings_property->setValue( $exporter, array() );

wp_mkdir_p( $fixture_root . '/wp-content/uploads' );
file_put_contents( $fixture_root . '/wp-content/uploads/copied.txt', 'copied' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents( $fixture_root . '/wp-content/uploads/.secret', 'secret' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/uploads/copied.txt',
	$output_dir
);
$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/uploads/missing.txt',
	$output_dir
);
$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/uploads/.secret',
	$output_dir
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/uploads/copied.txt' ),
	'copy_linked_asset copies same-site files that were discovered in HTML.'
);

$warnings = implode( "\n", $warnings_property->getValue( $exporter ) );

ssgwp_assert_contains(
	'Could not copy linked asset https://example.test/wp-content/uploads/missing.txt: no matching local file was found.',
	$warnings,
	'copy_linked_asset warns when a discovered same-site asset is missing.'
);

ssgwp_assert_contains(
	'Could not copy linked asset https://example.test/wp-content/uploads/.secret: the local file is not exportable.',
	$warnings,
	'copy_linked_asset warns when a discovered same-site asset is not exportable.'
);

$rewrite_assets_method = new ReflectionMethod( $exporter, 'rewrite_copied_text_assets' );
$rewrite_assets_method->setAccessible( true );

$copy_linked_assets_method = new ReflectionMethod( $exporter, 'copy_linked_assets' );
$copy_linked_assets_method->setAccessible( true );

wp_mkdir_p( $fixture_root . '/wp-content/plugins/transitive' );
file_put_contents(
	$fixture_root . '/wp-content/plugins/transitive/style.css',
	'@font-face{src:url("font.woff2")}'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/transitive/font.woff2',
	'font'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
wp_mkdir_p( $fixture_root . '/wp-content/plugins/manifest-deps/icons' );
wp_mkdir_p( $fixture_root . '/wp-content/plugins/manifest-deps/runtime' );
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/manifest.json',
	'{"icons":[{"src":"icon-192.png"},{"src":"icons/icon.png"}]}'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/site.webmanifest',
	'{"icons":[{"src":"webmanifest-icon.png"}]}'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/player.json',
	'{"captions":"captions.vtt","runtime":"runtime/module.wasm"}'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/browserconfig.xml',
	'<browserconfig><msapplication><tile>'
		. '<square70x70logo src="tile-small.png"/>'
		. '<square150x150logo src="icons/tile-150.png"/>'
		. '</tile></msapplication></browserconfig>'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/icon-192.png',
	'icon-192'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/webmanifest-icon.png',
	'webmanifest-icon'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/tile-small.png',
	'tile-small'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/captions.vtt',
	'WEBVTT'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/runtime/module.wasm',
	'wasm'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/icons/icon.png',
	'icon'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
file_put_contents(
	$fixture_root . '/wp-content/plugins/manifest-deps/icons/tile-150.png',
	'tile-150'
); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/plugins/transitive/style.css',
	$output_dir
);

$rewriter = new SSGWP_URL_Rewriter( new SSGWP_URL_Collector(), 'relative' );
$discovered_text_assets = $rewrite_assets_method->invoke(
	$exporter,
	$output_dir,
	$rewriter
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/transitive/font.woff2', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports assets discovered inside copied CSS files.'
);

$copied_count = $copy_linked_assets_method->invoke(
	$exporter,
	$discovered_text_assets,
	$output_dir
);

ssgwp_assert_same(
	1,
	$copied_count,
	'copy_linked_assets copies dependencies discovered inside copied CSS files.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/transitive/font.woff2' ),
	'copy_linked_assets writes dependencies discovered inside copied CSS files.'
);

$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/plugins/manifest-deps/manifest.json',
	$output_dir
);

$discovered_text_assets = $rewrite_assets_method->invoke(
	$exporter,
	$output_dir,
	$rewriter
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/manifest-deps/icon-192.png', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports sibling assets discovered inside copied manifests.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/manifest-deps/icons/icon.png', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports assets discovered inside copied manifests.'
);

$copied_count = $copy_linked_assets_method->invoke(
	$exporter,
	$discovered_text_assets,
	$output_dir
);

ssgwp_assert_same(
	2,
	$copied_count,
	'copy_linked_assets copies dependencies discovered inside copied manifests.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/manifest-deps/icon-192.png' ),
	'copy_linked_assets writes sibling dependencies discovered inside copied manifests.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/manifest-deps/icons/icon.png' ),
	'copy_linked_assets writes dependencies discovered inside copied manifests.'
);

$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/plugins/manifest-deps/site.webmanifest',
	$output_dir
);

$discovered_text_assets = $rewrite_assets_method->invoke(
	$exporter,
	$output_dir,
	$rewriter
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/manifest-deps/webmanifest-icon.png', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports assets discovered inside copied web manifests.'
);

$copied_count = $copy_linked_assets_method->invoke(
	$exporter,
	$discovered_text_assets,
	$output_dir
);

ssgwp_assert_same(
	1,
	$copied_count,
	'copy_linked_assets copies dependencies discovered inside copied web manifests.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/manifest-deps/webmanifest-icon.png' ),
	'copy_linked_assets writes dependencies discovered inside copied web manifests.'
);

$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/plugins/manifest-deps/browserconfig.xml',
	$output_dir
);

$discovered_text_assets = $rewrite_assets_method->invoke(
	$exporter,
	$output_dir,
	$rewriter
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/manifest-deps/tile-small.png', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports sibling assets discovered inside copied XML files.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/manifest-deps/icons/tile-150.png', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports nested assets discovered inside copied XML files.'
);

$copied_count = $copy_linked_assets_method->invoke(
	$exporter,
	$discovered_text_assets,
	$output_dir
);

ssgwp_assert_same(
	2,
	$copied_count,
	'copy_linked_assets copies dependencies discovered inside copied XML files.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/manifest-deps/tile-small.png' ),
	'copy_linked_assets writes sibling dependencies discovered inside copied XML files.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/manifest-deps/icons/tile-150.png' ),
	'copy_linked_assets writes nested dependencies discovered inside copied XML files.'
);

$copy_linked_asset_method->invoke(
	$exporter,
	'https://example.test/wp-content/plugins/manifest-deps/player.json',
	$output_dir
);

$discovered_text_assets = $rewrite_assets_method->invoke(
	$exporter,
	$output_dir,
	$rewriter
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/manifest-deps/captions.vtt', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports WebVTT captions discovered inside copied JSON files.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/manifest-deps/runtime/module.wasm', $discovered_text_assets, true ),
	'rewrite_copied_text_assets reports WebAssembly modules discovered inside copied JSON files.'
);

$copied_count = $copy_linked_assets_method->invoke(
	$exporter,
	$discovered_text_assets,
	$output_dir
);

ssgwp_assert_same(
	2,
	$copied_count,
	'copy_linked_assets copies media dependencies discovered inside copied JSON files.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/manifest-deps/captions.vtt' ),
	'copy_linked_assets writes WebVTT captions discovered inside copied JSON files.'
);

ssgwp_assert_same(
	true,
	file_exists( $output_dir . '/wp-content/plugins/manifest-deps/runtime/module.wasm' ),
	'copy_linked_assets writes WebAssembly modules discovered inside copied JSON files.'
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
