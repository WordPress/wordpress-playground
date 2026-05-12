<?php
/**
 * Tests for SSGWP_URL_Rewriter.
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

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * Return the test home URL.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function home_url( $path = '' ) {
		return ssgwp_test_url( 'https://example.test', $path );
	}
}

if ( ! function_exists( 'site_url' ) ) {
	/**
	 * Return the test site URL.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function site_url( $path = '' ) {
		return ssgwp_test_url( 'https://example.test', $path );
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

if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
	/**
	 * Minimal HTML tag processor for URL rewriter tests.
	 */
	class WP_HTML_Tag_Processor {
		/**
		 * HTML being processed.
		 *
		 * @var string
		 */
		private $html;

		/**
		 * Parsed tags.
		 *
		 * @var array<int,array<string,mixed>>
		 */
		private $tags = array();

		/**
		 * Current tag index.
		 *
		 * @var int
		 */
		private $index = -1;

		/**
		 * Constructor.
		 *
		 * @param string $html HTML.
		 */
		public function __construct( $html ) {
			$this->html = (string) $html;
			$this->parse_tags();
		}

		/**
		 * Move to the next tag.
		 *
		 * @param string|null $tag_name Optional tag name.
		 * @return bool
		 */
		public function next_tag( $tag_name = null ) {
			$tag_name = null === $tag_name ? null : strtoupper( $tag_name );

			while ( isset( $this->tags[ ++$this->index ] ) ) {
				if ( null === $tag_name || $tag_name === $this->get_tag() ) {
					return true;
				}
			}

			return false;
		}

		/**
		 * Get the current tag name.
		 *
		 * @return string|null
		 */
		public function get_tag() {
			return isset( $this->tags[ $this->index ] )
				? strtoupper( $this->tags[ $this->index ]['name'] )
				: null;
		}

		/**
		 * Get an attribute from the current tag.
		 *
		 * @param string $name Attribute name.
		 * @return string|null
		 */
		public function get_attribute( $name ) {
			if ( ! isset( $this->tags[ $this->index ] ) ) {
				return null;
			}

			$attributes = $this->tags[ $this->index ]['attributes'];
			$key        = strtolower( $name );

			return isset( $attributes[ $key ] ) ? $attributes[ $key ]['value'] : null;
		}

		/**
		 * Set an attribute on the current tag.
		 *
		 * @param string $name  Attribute name.
		 * @param string $value Attribute value.
		 */
		public function set_attribute( $name, $value ) {
			if ( ! isset( $this->tags[ $this->index ] ) ) {
				return;
			}

			$tag        = $this->tags[ $this->index ];
			$attributes = $tag['attributes'];
			$key        = strtolower( $name );

			if ( ! isset( $attributes[ $key ] ) ) {
				return;
			}

			$attribute = $attributes[ $key ];
			$tag_html  = substr_replace(
				$tag['html'],
				esc_attr( $value ),
				$attribute['value_offset'],
				$attribute['value_length']
			);

			$this->html = substr_replace(
				$this->html,
				$tag_html,
				$tag['offset'],
				$tag['length']
			);
		}

		/**
		 * Get the updated HTML.
		 *
		 * @return string
		 */
		public function get_updated_html() {
			return $this->html;
		}

		/**
		 * Parse tags from HTML.
		 */
		private function parse_tags() {
			preg_match_all(
				'/<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*)?>/s',
				$this->html,
				$matches,
				PREG_OFFSET_CAPTURE
			);

			foreach ( $matches[0] as $index => $tag_match ) {
				$tag_html = $tag_match[0];
				$this->tags[] = array(
					'name'       => $matches[1][ $index ][0],
					'html'       => $tag_html,
					'offset'     => $tag_match[1],
					'length'     => strlen( $tag_html ),
					'attributes' => $this->parse_attributes( $tag_html ),
				);
			}
		}

		/**
		 * Parse attributes from a tag.
		 *
		 * @param string $tag_html Tag HTML.
		 * @return array<string,array<string,int|string>>
		 */
		private function parse_attributes( $tag_html ) {
			$attributes = array();

			preg_match_all(
				'/([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(["\'])(.*?)\2/s',
				$tag_html,
				$matches,
				PREG_OFFSET_CAPTURE
			);

			foreach ( $matches[1] as $index => $name_match ) {
				$key                  = strtolower( $name_match[0] );
				$attributes[ $key ] = array(
					'value'        => $matches[3][ $index ][0],
					'value_offset' => $matches[3][ $index ][1],
					'value_length' => strlen( $matches[3][ $index ][0] ),
				);
			}

			return $attributes;
		}
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

/**
 * Minimal collector for URL rewriter tests.
 */
class SSGWP_URL_Collector {
	/**
	 * Resolve a URL against a base URL.
	 *
	 * @param string $url      URL.
	 * @param string $base_url Base URL.
	 * @return string
	 */
	public function resolve_relative_url( $url, $base_url ) {
		if ( 0 === strpos( $url, '//' ) ) {
			return 'https:' . $url;
		}

		if ( preg_match( '#^[a-z][a-z0-9+.-]*:#i', $url ) ) {
			return $url;
		}

		if ( isset( $url[0] ) && '/' === $url[0] ) {
			$parts = wp_parse_url( $base_url );
			return $parts['scheme'] . '://' . $parts['host'] . $url;
		}

		return trailingslashit( dirname( $base_url ) ) . $url;
	}

	/**
	 * Normalize a URL.
	 *
	 * @param string $url URL.
	 * @return string
	 */
	public function normalize_url( $url ) {
		return $url;
	}
}

require_once dirname( __DIR__ ) . '/includes/class-path-utils.php';
require_once dirname( __DIR__ ) . '/includes/class-url-rewriter.php';

$rewriter = new SSGWP_URL_Rewriter( new SSGWP_URL_Collector(), 'relative' );

set_error_handler(
	static function ( $severity, $message ) {
		ssgwp_fail( 'rewrite_html emitted a warning: ' . $message );
	}
);

$result = $rewriter->rewrite_html(
	'<link rel="stylesheet" href="/wp-content/themes/example/style.css?ver=1"><h1>Test</h1>',
	'https://example.test/',
	'index.html'
);

restore_error_handler();

ssgwp_assert_same(
	'<link rel="stylesheet" href="wp-content/themes/example/style.css?ver=1"><h1>Test</h1>',
	$result['content'],
	'rewrite_html rewrites stylesheet links through the HTML API.'
);

ssgwp_assert_same(
	array( 'https://example.test/wp-content/themes/example/style.css?ver=1' ),
	$result['assets'],
	'rewrite_html records stylesheet links as assets to copy.'
);

$method = new ReflectionMethod( $rewriter, 'prepare_html_attribute_value' );
$method->setAccessible( true );

$placeholders = array();

set_error_handler(
	static function ( $severity, $message ) {
		ssgwp_fail( 'prepare_html_attribute_value emitted a warning: ' . $message );
	}
);

$prepared = $method->invokeArgs( $rewriter, array( 'wp-content/themes/example/style.css?ver=1', &$placeholders ) );

restore_error_handler();

ssgwp_assert_same(
	'/__ssgwp_relative_url_0__',
	$prepared,
	'prepare_html_attribute_value uses a placeholder for relative stylesheet URLs.'
);

ssgwp_assert_same(
	array( '/__ssgwp_relative_url_0__' => 'wp-content/themes/example/style.css?ver=1' ),
	$placeholders,
	'prepare_html_attribute_value stores the original relative stylesheet URL.'
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
 * Exit with a test failure.
 *
 * @param string $message Failure message.
 */
function ssgwp_fail( $message ) {
	fwrite( STDERR, $message . PHP_EOL ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
	exit( 1 );
}
