<?php
/**
 * Tests for SSGWP_URL_Collector.
 *
 * @package PlaygroundStaticSiteGenerator
 */

define( 'ABSPATH', __DIR__ );

$ssgwp_test_home_url = 'https://example.test/';
$ssgwp_test_options  = array(
	'page_for_posts'      => 0,
	'permalink_structure' => '/%postname%/',
	'posts_per_page'      => 10,
	'show_on_front'       => 'posts',
);
$ssgwp_test_posts    = array();
$ssgwp_test_queries  = array();

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
		global $ssgwp_test_options;

		return isset( $ssgwp_test_options[ $option ] ) ? $ssgwp_test_options[ $option ] : null;
	}
}

if ( ! function_exists( 'trailingslashit' ) ) {
	/**
	 * Append a trailing slash.
	 *
	 * @param string $value Value.
	 * @return string
	 */
	function trailingslashit( $value ) {
		return rtrim( (string) $value, '/' ) . '/';
	}
}

if ( ! function_exists( 'absint' ) ) {
	/**
	 * Return a non-negative integer.
	 *
	 * @param mixed $value Value.
	 * @return int
	 */
	function absint( $value ) {
		return max( 0, (int) $value );
	}
}

if ( ! function_exists( 'add_query_arg' ) ) {
	/**
	 * Add a query argument to a URL.
	 *
	 * @param string $key   Query key.
	 * @param mixed  $value Query value.
	 * @param string $url   URL.
	 * @return string
	 */
	function add_query_arg( $key, $value, $url ) {
		$separator = false === strpos( $url, '?' ) ? '?' : '&';

		return $url . $separator . rawurlencode( $key ) . '=' . rawurlencode( (string) $value );
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

if ( ! function_exists( 'get_post_types' ) ) {
	/**
	 * Return public post types for collection tests.
	 *
	 * @return array
	 */
	function get_post_types() {
		return array(
			'post'       => (object) array(
				'exclude_from_search' => false,
				'has_archive'         => false,
			),
			'attachment' => (object) array(
				'exclude_from_search' => false,
				'has_archive'         => false,
			),
		);
	}
}

if ( ! function_exists( 'get_post_type_archive_link' ) ) {
	/**
	 * Return a post type archive URL.
	 *
	 * @param string $post_type Post type.
	 * @return string
	 */
	function get_post_type_archive_link( $post_type ) {
		return home_url( $post_type . '/' );
	}
}

if ( ! function_exists( 'wp_count_posts' ) ) {
	/**
	 * Count test posts.
	 *
	 * @param string $post_type Post type.
	 * @return object
	 */
	function wp_count_posts( $post_type ) {
		global $ssgwp_test_posts;

		$count = 0;

		foreach ( $ssgwp_test_posts as $post ) {
			if ( $post_type === $post->post_type && 'publish' === $post->post_status ) {
				++$count;
			}
		}

		return (object) array( 'publish' => $count );
	}
}

if ( ! function_exists( 'get_permalink' ) ) {
	/**
	 * Return a test permalink.
	 *
	 * @param int|object $post Post ID or object.
	 * @return string
	 */
	function get_permalink( $post ) {
		$post_id = is_object( $post ) ? $post->ID : (int) $post;

		return home_url( 'post-' . $post_id . '/' );
	}
}

if ( ! function_exists( 'get_post' ) ) {
	/**
	 * Return a test post.
	 *
	 * @param int|object $post Post ID or object.
	 * @return object|null
	 */
	function get_post( $post ) {
		global $ssgwp_test_posts;

		$post_id = is_object( $post ) ? $post->ID : (int) $post;

		return isset( $ssgwp_test_posts[ $post_id ] ) ? $ssgwp_test_posts[ $post_id ] : null;
	}
}

if ( ! function_exists( 'get_taxonomies' ) ) {
	/**
	 * Return no taxonomies by default.
	 *
	 * @return array
	 */
	function get_taxonomies() {
		return array();
	}
}

if ( ! function_exists( 'get_terms' ) ) {
	/**
	 * Return no terms by default.
	 *
	 * @return array
	 */
	function get_terms() {
		return array();
	}
}

if ( ! function_exists( 'get_term_link' ) ) {
	/**
	 * Return a test term link.
	 *
	 * @param object $term Term object.
	 * @return string
	 */
	function get_term_link( $term ) {
		return home_url( 'term-' . $term->term_id . '/' );
	}
}

if ( ! function_exists( 'get_users' ) ) {
	/**
	 * Return no users by default.
	 *
	 * @return array
	 */
	function get_users() {
		return array();
	}
}

if ( ! function_exists( 'get_author_posts_url' ) ) {
	/**
	 * Return a test author URL.
	 *
	 * @param int $user_id User ID.
	 * @return string
	 */
	function get_author_posts_url( $user_id ) {
		return home_url( 'author/user-' . (int) $user_id . '/' );
	}
}

if ( ! function_exists( 'count_user_posts' ) ) {
	/**
	 * Return no author posts by default.
	 *
	 * @return int
	 */
	function count_user_posts() {
		return 0;
	}
}

if ( ! class_exists( 'WP_Query' ) ) {
	/**
	 * Minimal WP_Query test double.
	 */
	class WP_Query {
		/**
		 * Queried post IDs.
		 *
		 * @var int[]
		 */
		public $posts = array();

		/**
		 * Constructor.
		 *
		 * @param array $args Query arguments.
		 */
		public function __construct( array $args ) {
			global $ssgwp_test_posts, $ssgwp_test_queries;

			$ssgwp_test_queries[] = $args;
			$post_type            = isset( $args['post_type'] ) ? $args['post_type'] : 'post';
			$per_page             = isset( $args['posts_per_page'] ) ? (int) $args['posts_per_page'] : 10;
			$page                 = isset( $args['paged'] ) ? max( 1, (int) $args['paged'] ) : 1;
			$ids                  = array();

			foreach ( $ssgwp_test_posts as $post ) {
				if ( $post_type === $post->post_type && 'publish' === $post->post_status ) {
					$ids[] = $post->ID;
				}
			}

			$this->posts = array_slice( $ids, ( $page - 1 ) * $per_page, $per_page );
		}
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
	'https://example.test/comments/',
	$collector->normalize_url( 'https://example.test/comments/' ),
	'normalize_url keeps a public page whose slug is comments.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'https://example.test/comments/feed/' ),
	'normalize_url rejects the comments feed endpoint.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'https://example.test/?feed=rss2' ),
	'normalize_url rejects query-based feed endpoints.'
);

ssgwp_assert_same(
	null,
	$collector->normalize_url( 'https://example.test/?rest_route=/wp/v2/posts' ),
	'normalize_url rejects query-based REST API endpoints.'
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

$ssgwp_test_home_url = 'https://example.test/';
$ssgwp_test_options  = array(
	'page_for_posts'      => 0,
	'permalink_structure' => '/%postname%/',
	'posts_per_page'      => 10,
	'show_on_front'       => 'page',
);
$ssgwp_test_posts    = array();
$ssgwp_test_queries  = array();

for ( $post_id = 1; $post_id <= 10; $post_id++ ) {
	$ssgwp_test_posts[ $post_id ] = (object) array(
		'ID'           => $post_id,
		'post_content' => '',
		'post_status'  => 'publish',
		'post_type'    => 'post',
	);
}

$limited_urls = $collector->collect( 5 );

ssgwp_assert_same(
	array(
		'https://example.test/',
		'https://example.test/post-1/',
		'https://example.test/post-2/',
		'https://example.test/post-3/',
		'https://example.test/post-4/',
	),
	$limited_urls,
	'collect respects the URL limit during initial post discovery.'
);

ssgwp_assert_same(
	4,
	$ssgwp_test_queries[0]['posts_per_page'],
	'collect sizes the first post query to the remaining URL slots.'
);

ssgwp_assert_same(
	1,
	count( $ssgwp_test_queries ),
	'collect stops querying posts after reaching the URL limit.'
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
