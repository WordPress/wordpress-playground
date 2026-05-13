<?php
/**
 * Tests for SSGWP_URL_Rewriter.
 *
 * @package PlaygroundStaticSiteGenerator
 */

define( 'ABSPATH', __DIR__ );

$ssgwp_test_home_url     = 'https://example.test';
$ssgwp_test_site_url     = 'https://example.test';
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

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * Return the test home URL.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function home_url( $path = '' ) {
		global $ssgwp_test_home_url;

		return ssgwp_test_url( $ssgwp_test_home_url, $path );
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
		global $ssgwp_test_site_url;

		return ssgwp_test_url( $ssgwp_test_site_url, $path );
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
			$delta     = strlen( $tag_html ) - $tag['length'];

			$this->html = substr_replace(
				$this->html,
				$tag_html,
				$tag['offset'],
				$tag['length']
			);
			$this->tags[ $this->index ]['html']       = $tag_html;
			$this->tags[ $this->index ]['length']     = strlen( $tag_html );
			$this->tags[ $this->index ]['attributes'] = $this->parse_attributes( $tag_html );

			if ( 0 === $delta ) {
				return;
			}

			for ( $index = $this->index + 1; $index < count( $this->tags ); $index++ ) {
				$this->tags[ $index ]['offset'] += $delta;
			}
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
	 * @return string|null
	 */
	public function normalize_url( $url ) {
		$url = strtok( (string) $url, '#' );

		if ( false === $url || '' === $url ) {
			return null;
		}

		$parts = wp_parse_url( $url );

		if ( empty( $parts['host'] ) ) {
			$url   = $this->resolve_relative_url( $url, home_url( '/' ) );
			$parts = wp_parse_url( $url );
		}

		$home_parts = wp_parse_url( home_url( '/' ) );

		if ( empty( $parts['host'] ) || empty( $home_parts['host'] ) || strtolower( $home_parts['host'] ) !== strtolower( $parts['host'] ) ) {
			return null;
		}

		$path = isset( $parts['path'] ) ? $parts['path'] : '/';

		if ( preg_match( '#/(wp-admin|wp-json|feed)(/|$)#', $path ) ) {
			return null;
		}

		$query = '';

		if ( isset( $parts['query'] ) ) {
			parse_str( $parts['query'], $query_args );

			foreach ( $query_args as $key => $value ) {
				if ( is_array( $value ) ) {
					return null;
				}

				if ( 'ssgwp_export' === $key ) {
					unset( $query_args[ $key ] );
				}
			}

			ksort( $query_args, SORT_STRING );
			$query = http_build_query( $query_args, '', '&', PHP_QUERY_RFC3986 );
		}

		$scheme = isset( $home_parts['scheme'] ) ? $home_parts['scheme'] : 'https';

		return $scheme . '://' . strtolower( $parts['host'] ) . $path . ( '' !== $query ? '?' . $query : '' );
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

$pattern_method = new ReflectionMethod( $rewriter, 'rewrite_html_attributes_with_patterns' );
$pattern_method->setAccessible( true );

$pattern_rewritten = $pattern_method->invoke(
	$rewriter,
	'<link rel="preconnect" href="https://example.test">'
		. '<link rel="dns-prefetch" href="//example.test">'
		. '<base href="https://example.test/">'
		. '<link rel="home" href="https://example.test/">',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'<link rel="preconnect" href="https://example.test">',
	$pattern_rewritten,
	'rewrite_html_attributes_with_patterns preserves same-origin preconnect resource hints.'
);

ssgwp_assert_contains(
	'<link rel="dns-prefetch" href="//example.test">',
	$pattern_rewritten,
	'rewrite_html_attributes_with_patterns preserves same-origin DNS prefetch resource hints.'
);

ssgwp_assert_contains(
	'<base href="./">',
	$pattern_rewritten,
	'rewrite_html_attributes_with_patterns anchors same-site base hrefs to the static document.'
);

ssgwp_assert_contains(
	'<link rel="home" href="index.html">',
	$pattern_rewritten,
	'rewrite_html_attributes_with_patterns still rewrites semantic page link relations.'
);

$pattern_unquoted_rewritten = $pattern_method->invoke(
	$rewriter,
	'<link rel=preconnect href=https://example.test>'
		. '<base href=https://example.test/>'
		. '<a href=/static-page/>Static</a>'
		. '<img src=/wp-content/uploads/photo.jpg?pattern=1 alt="">'
		. '<object data=/object-page/></object>'
		. '<object data=/wp-content/uploads/social-video.mp4?pattern=1></object>',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'<link rel=preconnect href=https://example.test>',
	$pattern_unquoted_rewritten,
	'rewrite_html_attributes_with_patterns preserves unquoted resource hints.'
);

ssgwp_assert_contains(
	'<base href=./>',
	$pattern_unquoted_rewritten,
	'rewrite_html_attributes_with_patterns rewrites unquoted same-site base hrefs.'
);

ssgwp_assert_contains(
	'<a href=static-page/index.html>Static</a>',
	$pattern_unquoted_rewritten,
	'rewrite_html_attributes_with_patterns rewrites unquoted page links.'
);

ssgwp_assert_contains(
	'<img src=wp-content/uploads/photo.jpg?pattern=1 alt="">',
	$pattern_unquoted_rewritten,
	'rewrite_html_attributes_with_patterns rewrites unquoted asset links.'
);

ssgwp_assert_contains(
	'<object data=object-page/index.html></object>',
	$pattern_unquoted_rewritten,
	'rewrite_html_attributes_with_patterns treats unquoted object pages as page links.'
);

ssgwp_assert_contains(
	'<object data=wp-content/uploads/social-video.mp4?pattern=1></object>',
	$pattern_unquoted_rewritten,
	'rewrite_html_attributes_with_patterns treats unquoted object media as assets.'
);

$pattern_lazy_rewritten = $pattern_method->invoke(
	$rewriter,
	'<div data-bg="/wp-content/uploads/bg.jpg?lazy=1"'
		. ' data-bgset="/wp-content/uploads/photo.jpg 1x, /wp-content/uploads/photo-2x.jpg 2x">'
		. '<span data-src="/wp-content/uploads/photo.jpg?lazy=2"></span></div>'
		. '<a data-href="/deferred-page/">Deferred</a>'
		. '<button data-href="/wp-content/uploads/photo.jpg?deferred=1">Asset</button>'
		. '<div data-url="/generic-page/" data-link="/wp-content/uploads/photo.jpg?data-link=1"></div>'
		. '<iframe src="/framed-page/" data-src="/lazy-frame/" data-lazy-src="/wp-content/uploads/photo.jpg?frame=1"></iframe>'
		. '<embed src="/embed-page/">'
		. '<embed src="/wp-content/uploads/social-video.mp4?embed=1">'
		. '<embed data-src="/embed-page/" data-lazy-src="/wp-content/uploads/social-video.mp4?lazy-embed=1">',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'data-bg="wp-content/uploads/bg.jpg?lazy=1"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns rewrites lazy background asset attributes.'
);

ssgwp_assert_contains(
	'data-bgset="wp-content/uploads/photo.jpg 1x, wp-content/uploads/photo-2x.jpg 2x"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns rewrites lazy background srcset attributes.'
);

ssgwp_assert_contains(
	'data-src="wp-content/uploads/photo.jpg?lazy=2"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns rewrites lazy source attributes on any tag.'
);

ssgwp_assert_contains(
	'data-href="deferred-page/index.html"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats data-href page URLs as links.'
);

ssgwp_assert_contains(
	'data-href="wp-content/uploads/photo.jpg?deferred=1"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats data-href media URLs as assets.'
);

ssgwp_assert_contains(
	'data-url="generic-page/index.html"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats data-url page URLs as links.'
);

ssgwp_assert_contains(
	'data-link="wp-content/uploads/photo.jpg?data-link=1"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats data-link media URLs as assets.'
);

ssgwp_assert_contains(
	'data-src="lazy-frame/index.html"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats lazy iframe page sources as page links.'
);

ssgwp_assert_contains(
	'<iframe src="framed-page/index.html"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats iframe src page URLs as page links.'
);

ssgwp_assert_contains(
	'data-lazy-src="wp-content/uploads/photo.jpg?frame=1"',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns keeps lazy iframe media sources as assets.'
);

ssgwp_assert_contains(
	'<embed src="embed-page/index.html">',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats embed src page URLs as page links.'
);

ssgwp_assert_contains(
	'<embed src="wp-content/uploads/social-video.mp4?embed=1">',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns keeps embed src media URLs as assets.'
);

ssgwp_assert_contains(
	'<embed data-src="embed-page/index.html" data-lazy-src="wp-content/uploads/social-video.mp4?lazy-embed=1">',
	$pattern_lazy_rewritten,
	'rewrite_html_attributes_with_patterns treats lazy embed sources as page-or-asset URLs.'
);

$pattern_srcdoc_method = new ReflectionMethod( $rewriter, 'rewrite_srcdoc_attributes_with_patterns' );
$pattern_srcdoc_method->setAccessible( true );

$pattern_srcdoc_rewritten = $pattern_srcdoc_method->invoke(
	$rewriter,
	'<iframe srcdoc="'
		. esc_attr( '<a href="/embedded-page/">Embedded</a><img src="/wp-content/uploads/photo.jpg?srcdoc=1">' )
		. '"></iframe>',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'href=&quot;embedded-page/index.html&quot;',
	$pattern_srcdoc_rewritten,
	'rewrite_srcdoc_attributes_with_patterns rewrites page links inside srcdoc.'
);

ssgwp_assert_contains(
	'src=&quot;wp-content/uploads/photo.jpg?srcdoc=1&quot;',
	$pattern_srcdoc_rewritten,
	'rewrite_srcdoc_attributes_with_patterns rewrites asset URLs inside srcdoc.'
);

$pattern_meta_refresh_method = new ReflectionMethod( $rewriter, 'rewrite_meta_refresh_with_patterns' );
$pattern_meta_refresh_method->setAccessible( true );

$pattern_meta_refresh_rewritten = $pattern_meta_refresh_method->invoke(
	$rewriter,
	'<meta http-equiv="refresh" content="0; url=/static-page/#section">'
		. '<meta name="viewport" content="width=device-width">',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'<meta http-equiv="refresh" content="0; url=static-page/index.html#section">',
	$pattern_meta_refresh_rewritten,
	'rewrite_meta_refresh_with_patterns rewrites refresh URLs without the HTML API.'
);

ssgwp_assert_contains(
	'<meta name="viewport" content="width=device-width">',
	$pattern_meta_refresh_rewritten,
	'rewrite_meta_refresh_with_patterns leaves non-URL meta content unchanged.'
);

$pattern_meta_refresh_unquoted = $pattern_meta_refresh_method->invoke(
	$rewriter,
	'<meta http-equiv=refresh content=0;url=/static-page/>',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'<meta http-equiv=refresh content=0;url=static-page/index.html>',
	$pattern_meta_refresh_unquoted,
	'rewrite_meta_refresh_with_patterns rewrites unquoted refresh URLs.'
);

$pattern_meta_content_method = new ReflectionMethod( $rewriter, 'rewrite_meta_content_urls_with_patterns' );
$pattern_meta_content_method->setAccessible( true );

$pattern_meta_content_rewritten = $pattern_meta_content_method->invoke(
	$rewriter,
	'<meta property="og:url" content="/meta-page/#share">'
		. '<meta name="twitter:image" content="/wp-content/uploads/social.jpg?ver=1">'
		. '<meta itemprop="contentUrl" content="/wp-content/uploads/social-video.mp4?schema=1">'
		. '<meta itemprop="embedUrl" content="/video-player/">'
		. '<meta property="article:author" content="/author/admin/">'
		. '<meta property="article:publisher" content="/publisher/">'
		. '<meta property="og:see_also" content="/related/">'
		. '<meta name="twitter:player" content="/video-player/">'
		. '<meta name="msapplication-TileImage" content="/wp-content/uploads/tile.png">'
		. '<meta name="description" content="Plain text">',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'<meta property="og:url" content="meta-page/index.html#share">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites page meta URLs without the HTML API.'
);

ssgwp_assert_contains(
	'<meta name="twitter:image" content="wp-content/uploads/social.jpg?ver=1">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites asset meta URLs without the HTML API.'
);

ssgwp_assert_contains(
	'<meta itemprop="contentUrl" content="wp-content/uploads/social-video.mp4?schema=1">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites schema.org contentUrl media URLs.'
);

ssgwp_assert_contains(
	'<meta itemprop="embedUrl" content="video-player/index.html">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites schema.org embedUrl page URLs.'
);

ssgwp_assert_contains(
	'<meta property="article:author" content="author/admin/index.html">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites article author page URLs.'
);

ssgwp_assert_contains(
	'<meta property="article:publisher" content="publisher/index.html">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites article publisher page URLs.'
);

ssgwp_assert_contains(
	'<meta property="og:see_also" content="related/index.html">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites Open Graph related page URLs.'
);

ssgwp_assert_contains(
	'<meta name="twitter:player" content="video-player/index.html">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites Twitter player page URLs.'
);

ssgwp_assert_contains(
	'<meta name="msapplication-TileImage" content="wp-content/uploads/tile.png">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns rewrites tile image meta URLs.'
);

ssgwp_assert_contains(
	'<meta name="description" content="Plain text">',
	$pattern_meta_content_rewritten,
	'rewrite_meta_content_urls_with_patterns leaves non-URL meta content unchanged.'
);

$pattern_meta_content_unquoted = $pattern_meta_content_method->invoke(
	$rewriter,
	'<meta property=og:url content=/meta-page/>'
		. '<meta name=twitter:image content=/wp-content/uploads/social.jpg>',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'<meta property=og:url content=meta-page/index.html>',
	$pattern_meta_content_unquoted,
	'rewrite_meta_content_urls_with_patterns rewrites unquoted page meta URLs.'
);

ssgwp_assert_contains(
	'<meta name=twitter:image content=wp-content/uploads/social.jpg>',
	$pattern_meta_content_unquoted,
	'rewrite_meta_content_urls_with_patterns rewrites unquoted asset meta URLs.'
);

$export_root = ssgwp_make_fixture_dir();
$query_hash  = substr( md5( 'p=42' ), 0, 8 );
$view_hash   = substr( md5( 'view=grid' ), 0, 8 );

foreach (
	array(
		'index.html',
		'index-' . $query_hash . '.html',
		'static-page/index.html',
		'static-page-' . $view_hash . '.html',
			'blog/page/2/index.html',
			'comments/index.html',
			'embed-page/index.html',
			'framed-page/index.html',
			'generic-page/index.html',
			'meta-page/index.html',
		'nested/page/index.html',
		'protocol-escaped/index.html',
		'protocol-page/index.html',
		'protocol-text/index.html',
		'prefetched-page/index.html',
		'deferred-page/index.html',
		'sample-page/index.html',
		'lazy-frame/index.html',
		'object-page/index.html',
		'author/admin/index.html',
		'publisher/index.html',
		'related/index.html',
		'embedded-page/index.html',
		'video-player/index.html',
		'encoded%20page/index.html',
		'collision%20page/index.html',
		'collision%2Bpage/index.html',
		'nested%2Fsegment/index.html',
		'%2E%2E/secret/index.html',
		'wp-content/uploads/bg.jpg',
		'wp-content/uploads/captions.vtt',
		'wp-content/uploads/photo.jpg',
		'wp-content/uploads/photo-2x.jpg',
		'wp-content/uploads/image-set.jpg',
		'wp-content/uploads/image-set-2x.jpg',
		'wp-content/uploads/social.jpg',
		'wp-content/uploads/social-audio.mp3',
		'wp-content/uploads/social-video.mp4',
		'wp-content/uploads/tile.png',
		'wp-includes/fonts/dashicons.eot',
	)
	as $fixture_file
) {
	ssgwp_touch_export_file( $export_root, $fixture_file );
}

$srcdoc = esc_attr(
	'<a class="embedded" href="/embedded-page/">Embedded</a>'
		. '<img src="/wp-content/uploads/photo.jpg?srcdoc=1" alt="">'
		. '<style>.embed{background:url("/wp-content/uploads/bg.jpg?srcdoc=1")}</style>'
);

$html = implode(
	'',
	array(
		'<a class="pretty" href="/static-page/">Pretty</a>',
		'<a class="no-trailing" href="/static-page">No slash</a>',
		'<a class="absolute" href="https://example.test/nested/page/#section">Absolute</a>',
		'<a class="protocol" href="//example.test/protocol-page/">Protocol</a>',
		'<a class="encoded" href="/encoded%20page/">Encoded</a>',
		'<a class="encoded-space" href="/collision%20page/">Encoded space</a>',
		'<a class="literal-plus" href="/collision+page/">Literal plus</a>',
		'<a class="encoded-slash" href="/nested%2Fsegment/">Encoded slash</a>',
		'<a class="encoded-parent" href="/%2e%2e/secret/">Encoded parent</a>',
		'<a class="non-pretty" href="/?p=42#comments">Query</a>',
		'<a class="query" href="/static-page/?view=grid#items">Query page</a>',
		'<a class="archive" href="/blog/page/2/#posts">Archive</a>',
		'<a class="comments-page" href="/comments/">Comments page</a>',
		'<base href="https://example.test/">',
		'<a class="admin" href="/wp-admin/admin.php">Admin</a>',
		'<a class="api" href="/wp-json/wp/v2/posts">API</a>',
		'<a class="rest-query" href="/?rest_route=/wp/v2/posts">REST query</a>',
		'<a class="feed" href="/feed/">Feed</a>',
		'<a class="feed-query" href="/?feed=rss2">Feed query</a>',
		'<link rel="alternate" type="application/rss+xml" href="/feed/">',
		'<link rel="alternate" type="application/rss+xml" href="/?feed=rss2">',
		'<link rel="alternate" type="application/rss+xml" href="/comments/feed/">',
		'<link rel="home" href="https://example.test/">',
		'<link rel="preconnect" href="https://example.test">',
		'<link rel="dns-prefetch" href="//example.test">',
		'<link rel="prefetch" href="/prefetched-page/">',
		'<link rel="prerender" href="/prefetched-page/#ready">',
		'<link rel="prefetch" as="image" href="/wp-content/uploads/photo.jpg?prefetch=1">',
		'<link rel="author" href="/author/admin/">',
		'<a class="deferred" data-href="/deferred-page/">Deferred</a>',
		'<button data-href="/wp-content/uploads/photo.jpg?deferred=1">Deferred asset</button>',
		'<a class="generic-data-url" data-url="/generic-page/">Generic data URL</a>',
		'<button data-link="/wp-content/uploads/photo.jpg?data-link=1">Generic data asset</button>',
		'<a class="external" href="https://external.test/static-page/">External</a>',
		'<a class="external-port" href="https://example.test:8443/static-page/">External port</a>',
		'<a class="external-scheme" href="http://example.test:443/static-page/">External scheme</a>',
		'<a class="mail" href="mailto:test@example.test">Mail</a>',
		'<a class="tel" href="tel:+15551234567">Tel</a>',
		'<a class="js" href="javascript:void(0)">JS</a>',
		'<a class="data" href="data:text/plain,hello">Data</a>',
		'<a class="blob" href="blob:https://example.test/id">Blob</a>',
		'<meta charset="UTF-8" />',
		'<meta property="og:url" content="https://example.test/nested/page/#share">',
		'<meta property="og:image" content="https://example.test/wp-content/uploads/social.jpg?ver=1">',
		'<meta property="og:audio" content="https://example.test/wp-content/uploads/social-audio.mp3?ver=1">',
		'<meta property="og:video" content="https://example.test/wp-content/uploads/social-video.mp4?ver=1">',
		'<meta name="twitter:image" content="/wp-content/uploads/photo.jpg">',
		'<meta name="msapplication-TileImage" content="/wp-content/uploads/tile.png">',
		'<meta name="msapplication-square70x70logo" content="/wp-content/uploads/tile.png?small=1">',
		'<meta name="msapplication-wide310x150logo" content="/wp-content/uploads/tile.png?wide=1">',
		'<meta name="msapplication-config" content="/browserconfig.xml">',
		'<meta itemprop="contentUrl" content="/wp-content/uploads/social-video.mp4?schema=1">',
		'<meta itemprop="embedUrl" content="/video-player/">',
		'<meta property="article:author" content="/author/admin/">',
		'<meta property="article:publisher" content="/publisher/">',
		'<meta property="og:see_also" content="/related/">',
		'<meta name="twitter:player" content="/video-player/">',
		'<meta name="twitter:player:stream" content="/wp-content/uploads/social-video.mp4?stream=1">',
		'<link rel="preload" as="image" href="/wp-content/uploads/photo.jpg" imagesrcset="/wp-content/uploads/photo.jpg 1x, /wp-content/uploads/photo-2x.jpg 2x">',
		'<img src="/wp-content/uploads/photo.jpg?size=large" alt="">',
		'<img srcset="/wp-content/uploads/photo.jpg 1x, /wp-content/uploads/photo-2x.jpg 2x" alt="">',
		'<img srcset="data:image/gif;base64,R0lGODlhAQABAAAAACw= 1x, /wp-content/uploads/photo-2x.jpg 2x" alt="">',
		'<div data-bg="/wp-content/uploads/bg.jpg?lazy=1"'
			. ' data-background="/wp-content/uploads/bg.jpg?lazy=2"'
			. ' data-bgset="/wp-content/uploads/photo.jpg 1x, /wp-content/uploads/photo-2x.jpg 2x"></div>',
		'<span data-src="/wp-content/uploads/photo.jpg?lazy=3"'
			. ' data-original="/wp-content/uploads/photo.jpg?lazy=4"'
			. ' data-poster="/wp-content/uploads/bg.jpg?lazy=5"></span>',
		'<iframe src="/framed-page/"></iframe>',
		'<iframe data-src="/lazy-frame/" data-lazy-src="/wp-content/uploads/photo.jpg?frame=1"></iframe>',
		'<embed src="/embed-page/">',
		'<embed src="/wp-content/uploads/social-video.mp4?embed=1">',
		'<embed data-src="/embed-page/" data-lazy-src="/wp-content/uploads/social-video.mp4?lazy-embed=1">',
		'<object data="/object-page/"></object>',
		'<object data="/wp-content/uploads/social-video.mp4?object=1"></object>',
		'<video><track kind="captions" src="/wp-content/uploads/captions.vtt?lang=en"></video>',
		'<svg><filter><feImage href="/wp-content/uploads/filter.png?svg=1"'
			. ' xlink:href="/wp-content/uploads/filter-2x.png?svg=2"></feImage></filter></svg>',
		'<style>.hero{background:url("/wp-content/uploads/bg.jpg?ver=1")}</style>',
		'<style>.responsive{background-image:image-set("/wp-content/uploads/image-set.jpg?density=1" 1x,'
			. ' "/wp-content/uploads/image-set-2x.jpg?density=2" 2x, type("image/jpeg"))}</style>',
		'<div style="background-image:url(/wp-content/uploads/bg.jpg?inline=1)"></div>',
		'<div style=background:url(/wp-content/uploads/bg.jpg?unquoted=1)></div>',
		'<iframe srcdoc="' . $srcdoc . '"></iframe>',
		'<script type="application/json">{"url":"https:\/\/example.test\/nested\/page\/"}</script>',
		'<script type="application/json">{"protocol":"//example.test/protocol-text/","protocolEscaped":"\/\/example.test\/protocol-escaped\/"}</script>',
		'<script type="application/json">{"root":"\/nested\/page\/","rootAsset":"\/wp-content\/uploads\/photo.jpg?json=1"}</script>',
		'<script type="application/json">{"plainRoot":"/static-page/","plainAsset":"/wp-content/uploads/photo.jpg?plain=1"}</script>',
		'<script type="application/json">{"rest":"https:\/\/example.test\/?rest_route=\/wp\/v2\/posts"}</script>',
		'<script type="speculationrules">{"prefetch":[{"where":{"href_matches":"\/*","not":{"href_matches":["\/wp-admin\/*","\/wp-content\/uploads\/*","/wp-content/themes/*"]}}}]}</script>',
		'<script>const next = "https://example.test/static-page/";</script>',
	)
);

$result = $rewriter->rewrite_html( $html, 'https://example.test/', 'index.html' );

ssgwp_assert_contains(
	'href="static-page/index.html"',
	$result['content'],
	'rewrite_html points pretty page links at generated index files.'
);

ssgwp_assert_contains(
	'href="nested/page/index.html#section"',
	$result['content'],
	'rewrite_html preserves fragments after normalizing page URLs.'
);

ssgwp_assert_contains(
	'href="protocol-page/index.html"',
	$result['content'],
	'rewrite_html rewrites protocol-relative same-site page URLs.'
);

ssgwp_assert_contains(
	'href="encoded%20page/index.html"',
	$result['content'],
	'rewrite_html preserves encoded paths in generated file URLs.'
);

ssgwp_assert_contains(
	'href="collision%20page/index.html"',
	$result['content'],
	'rewrite_html maps encoded spaces to distinct generated files.'
);

ssgwp_assert_contains(
	'href="collision%2Bpage/index.html"',
	$result['content'],
	'rewrite_html maps literal plus signs to distinct generated files.'
);

ssgwp_assert_contains(
	'href="nested%2Fsegment/index.html"',
	$result['content'],
	'rewrite_html keeps encoded slashes inside one generated path segment.'
);

ssgwp_assert_contains(
	'href="%2E%2E/secret/index.html"',
	$result['content'],
	'rewrite_html keeps encoded parent segments literal.'
);

ssgwp_assert_contains(
	'href="index-' . $query_hash . '.html#comments"',
	$result['content'],
	'rewrite_html rewrites non-pretty query pages to their generated files.'
);

ssgwp_assert_contains(
	'href="static-page-' . $view_hash . '.html#items"',
	$result['content'],
	'rewrite_html rewrites queried pretty URLs to their generated files.'
);

ssgwp_assert_contains(
	'href="blog/page/2/index.html#posts"',
	$result['content'],
	'rewrite_html rewrites archive pagination URLs to generated files.'
);

ssgwp_assert_contains(
	'href="comments/index.html"',
	$result['content'],
	'rewrite_html rewrites a public page whose slug is comments.'
);

ssgwp_assert_contains(
	'<base href="./">',
	$result['content'],
	'rewrite_html anchors same-site base hrefs to the static document directory.'
);

ssgwp_assert_contains(
	'<link rel="home" href="index.html">',
	$result['content'],
	'rewrite_html treats same-site rel=home links as page links.'
);

ssgwp_assert_contains(
	'<link rel="preconnect" href="https://example.test">',
	$result['content'],
	'rewrite_html leaves same-origin preconnect resource hints unchanged.'
);

ssgwp_assert_contains(
	'<link rel="dns-prefetch" href="//example.test">',
	$result['content'],
	'rewrite_html leaves same-origin DNS prefetch resource hints unchanged.'
);

ssgwp_assert_contains(
	'<link rel="prefetch" href="prefetched-page/index.html">',
	$result['content'],
	'rewrite_html rewrites page prefetch hints as crawlable pages.'
);

ssgwp_assert_contains(
	'<link rel="prerender" href="prefetched-page/index.html#ready">',
	$result['content'],
	'rewrite_html rewrites page prerender hints as crawlable pages.'
);

ssgwp_assert_contains(
	'<link rel="prefetch" as="image" href="wp-content/uploads/photo.jpg?prefetch=1">',
	$result['content'],
	'rewrite_html keeps image prefetch hints as copied assets.'
);

ssgwp_assert_contains(
	'<link rel="author" href="author/admin/index.html">',
	$result['content'],
	'rewrite_html treats same-site rel=author links as page links.'
);

ssgwp_assert_contains(
	'data-href="deferred-page/index.html"',
	$result['content'],
	'rewrite_html treats data-href page URLs as links.'
);

ssgwp_assert_contains(
	'data-href="wp-content/uploads/photo.jpg?deferred=1"',
	$result['content'],
	'rewrite_html treats data-href media URLs as assets.'
);

ssgwp_assert_contains(
	'data-url="generic-page/index.html"',
	$result['content'],
	'rewrite_html treats data-url page URLs as links.'
);

ssgwp_assert_contains(
	'data-link="wp-content/uploads/photo.jpg?data-link=1"',
	$result['content'],
	'rewrite_html treats data-link media URLs as assets.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/prefetched-page/', $result['links'], true ),
	'rewrite_html records page prefetch hints as links to crawl.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/photo.jpg?prefetch=1', $result['assets'], true ),
	'rewrite_html records image prefetch hints as assets to copy.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/author/admin/', $result['links'], true ),
	'rewrite_html records rel=author links as pages to crawl.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/deferred-page/', $result['links'], true ),
	'rewrite_html records data-href page URLs as links to crawl.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/generic-page/', $result['links'], true ),
	'rewrite_html records data-url page URLs as links to crawl.'
);

ssgwp_assert_same(
	false,
	in_array( 'https://example.test/?rest_route=/wp/v2/posts', $result['links'], true ),
	'rewrite_html does not record query-based REST API URLs as links to crawl.'
);

ssgwp_assert_same(
	false,
	in_array( 'https://example.test/?feed=rss2', $result['links'], true ),
	'rewrite_html does not record query-based feed URLs as links to crawl.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/photo.jpg?deferred=1', $result['assets'], true ),
	'rewrite_html records data-href media URLs as assets to copy.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/photo.jpg?data-link=1', $result['assets'], true ),
	'rewrite_html records data-link media URLs as assets to copy.'
);

ssgwp_assert_contains(
	'src="wp-content/uploads/photo.jpg?size=large"',
	$result['content'],
	'rewrite_html keeps asset URLs as asset file paths with query strings.'
);

ssgwp_assert_contains(
	'srcset="wp-content/uploads/photo.jpg 1x, wp-content/uploads/photo-2x.jpg 2x"',
	$result['content'],
	'rewrite_html rewrites srcset candidates to copied asset files.'
);

ssgwp_assert_contains(
	'srcset="data:image/gif;base64,R0lGODlhAQABAAAAACw= 1x, wp-content/uploads/photo-2x.jpg 2x"',
	$result['content'],
	'rewrite_html rewrites mixed data and same-site srcset candidates.'
);

ssgwp_assert_contains(
	'imagesrcset="wp-content/uploads/photo.jpg 1x, wp-content/uploads/photo-2x.jpg 2x"',
	$result['content'],
	'rewrite_html rewrites responsive image preload srcset candidates.'
);

ssgwp_assert_contains(
	'data-bg="wp-content/uploads/bg.jpg?lazy=1"',
	$result['content'],
	'rewrite_html rewrites lazy background asset attributes on non-image tags.'
);

ssgwp_assert_contains(
	'data-background="wp-content/uploads/bg.jpg?lazy=2"',
	$result['content'],
	'rewrite_html rewrites lazy data-background asset attributes.'
);

ssgwp_assert_contains(
	'data-bgset="wp-content/uploads/photo.jpg 1x, wp-content/uploads/photo-2x.jpg 2x"',
	$result['content'],
	'rewrite_html rewrites lazy background srcset attributes.'
);

ssgwp_assert_contains(
	'data-src="wp-content/uploads/photo.jpg?lazy=3"',
	$result['content'],
	'rewrite_html rewrites lazy data-src attributes on non-image tags.'
);

ssgwp_assert_contains(
	'data-original="wp-content/uploads/photo.jpg?lazy=4"',
	$result['content'],
	'rewrite_html rewrites lazy data-original attributes.'
);

ssgwp_assert_contains(
	'data-poster="wp-content/uploads/bg.jpg?lazy=5"',
	$result['content'],
	'rewrite_html rewrites lazy data-poster attributes.'
);

ssgwp_assert_contains(
	'data-src="lazy-frame/index.html"',
	$result['content'],
	'rewrite_html treats lazy iframe page sources as page links.'
);

ssgwp_assert_contains(
	'<iframe src="framed-page/index.html"></iframe>',
	$result['content'],
	'rewrite_html treats iframe src page URLs as page links.'
);

ssgwp_assert_contains(
	'data-lazy-src="wp-content/uploads/photo.jpg?frame=1"',
	$result['content'],
	'rewrite_html keeps lazy iframe media sources as assets.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/lazy-frame/', $result['links'], true ),
	'rewrite_html records lazy iframe page sources as links to crawl.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/photo.jpg?frame=1', $result['assets'], true ),
	'rewrite_html records lazy iframe media sources as assets to copy.'
);

ssgwp_assert_contains(
	'<embed src="embed-page/index.html">',
	$result['content'],
	'rewrite_html treats embed src page URLs as page links.'
);

ssgwp_assert_contains(
	'<embed src="wp-content/uploads/social-video.mp4?embed=1">',
	$result['content'],
	'rewrite_html keeps embed src media URLs as assets.'
);

ssgwp_assert_contains(
	'<embed data-src="embed-page/index.html" data-lazy-src="wp-content/uploads/social-video.mp4?lazy-embed=1">',
	$result['content'],
	'rewrite_html treats lazy embed sources as page-or-asset URLs.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/framed-page/', $result['links'], true ),
	'rewrite_html records iframe src page URLs as links to crawl.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/embed-page/', $result['links'], true ),
	'rewrite_html records embed src page URLs as links to crawl.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/social-video.mp4?embed=1', $result['assets'], true ),
	'rewrite_html records embed src media URLs as assets to copy.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/social-video.mp4?lazy-embed=1', $result['assets'], true ),
	'rewrite_html records lazy embed media URLs as assets to copy.'
);

ssgwp_assert_contains(
	'<meta property="og:url" content="nested/page/index.html#share">',
	$result['content'],
	'rewrite_html rewrites Open Graph page URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta property="og:image" content="wp-content/uploads/social.jpg?ver=1">',
	$result['content'],
	'rewrite_html rewrites Open Graph image URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta property="og:audio" content="wp-content/uploads/social-audio.mp3?ver=1">',
	$result['content'],
	'rewrite_html rewrites Open Graph audio URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta property="og:video" content="wp-content/uploads/social-video.mp4?ver=1">',
	$result['content'],
	'rewrite_html rewrites Open Graph video URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta name="twitter:image" content="wp-content/uploads/photo.jpg">',
	$result['content'],
	'rewrite_html rewrites Twitter image URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta name="msapplication-TileImage" content="wp-content/uploads/tile.png">',
	$result['content'],
	'rewrite_html rewrites Windows tile image URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta name="msapplication-square70x70logo" content="wp-content/uploads/tile.png?small=1">',
	$result['content'],
	'rewrite_html rewrites small Windows tile image URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta name="msapplication-wide310x150logo" content="wp-content/uploads/tile.png?wide=1">',
	$result['content'],
	'rewrite_html rewrites wide Windows tile image URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta name="msapplication-config" content="browserconfig.xml">',
	$result['content'],
	'rewrite_html rewrites Windows browser config URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta itemprop="contentUrl" content="wp-content/uploads/social-video.mp4?schema=1">',
	$result['content'],
	'rewrite_html rewrites schema.org contentUrl media URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta itemprop="embedUrl" content="video-player/index.html">',
	$result['content'],
	'rewrite_html rewrites schema.org embedUrl page URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta property="article:author" content="author/admin/index.html">',
	$result['content'],
	'rewrite_html rewrites article author page URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta property="article:publisher" content="publisher/index.html">',
	$result['content'],
	'rewrite_html rewrites article publisher page URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta property="og:see_also" content="related/index.html">',
	$result['content'],
	'rewrite_html rewrites Open Graph related page URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta name="twitter:player" content="video-player/index.html">',
	$result['content'],
	'rewrite_html rewrites Twitter player page URLs in meta content attributes.'
);

ssgwp_assert_contains(
	'<meta name="twitter:player:stream" content="wp-content/uploads/social-video.mp4?stream=1">',
	$result['content'],
	'rewrite_html rewrites Twitter player stream URLs in meta content attributes.'
);

$meta_only_result = $rewriter->rewrite_html(
	'<meta property="og:url" content="/meta-page/">'
		. '<meta property="og:image" content="/wp-content/uploads/social.jpg">'
		. '<meta property="article:publisher" content="/publisher/">'
		. '<meta property="og:see_also" content="/related/">'
		. '<meta itemprop="embedUrl" content="/video-player/">'
		. '<meta name="twitter:player" content="/video-player/">'
		. '<meta name="msapplication-TileImage" content="/wp-content/uploads/tile.png">'
		. '<meta name="msapplication-square310x310logo" content="/wp-content/uploads/tile.png?square=1">'
		. '<meta name="msapplication-config" content="/browserconfig.xml">',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_same(
	array(
		'https://example.test/meta-page/',
		'https://example.test/publisher/',
		'https://example.test/related/',
		'https://example.test/video-player/',
	),
	$meta_only_result['links'],
	'rewrite_html records meta page, social, and structured-data embed URLs as links to crawl.'
);

ssgwp_assert_same(
	array(
		'https://example.test/wp-content/uploads/social.jpg',
		'https://example.test/wp-content/uploads/tile.png',
		'https://example.test/wp-content/uploads/tile.png?square=1',
		'https://example.test/browserconfig.xml',
	),
	$meta_only_result['assets'],
	'rewrite_html records meta image and tile URLs as assets to copy.'
);

$browser_config_none_result = $rewriter->rewrite_html(
	'<meta name="msapplication-config" content="none">',
	'https://example.test/',
	'index.html'
);

ssgwp_assert_contains(
	'<meta name="msapplication-config" content="none">',
	$browser_config_none_result['content'],
	'rewrite_html leaves disabled Windows browser config metadata unchanged.'
);

ssgwp_assert_same(
	array(),
	$browser_config_none_result['assets'],
	'rewrite_html does not record disabled Windows browser config metadata as an asset.'
);

ssgwp_assert_contains(
	'url("wp-content/uploads/bg.jpg?ver=1")',
	$result['content'],
	'rewrite_html rewrites inline CSS asset URLs.'
);

ssgwp_assert_contains(
	'image-set("wp-content/uploads/image-set.jpg?density=1" 1x,'
		. ' "wp-content/uploads/image-set-2x.jpg?density=2" 2x, type("image/jpeg"))',
	$result['content'],
	'rewrite_html rewrites quoted CSS image-set asset URLs.'
);

ssgwp_assert_contains(
	'style="background-image:url(wp-content/uploads/bg.jpg?inline=1)"',
	$result['content'],
	'rewrite_html rewrites inline style attribute URLs.'
);

ssgwp_assert_contains(
	'style=background:url(wp-content/uploads/bg.jpg?unquoted=1)',
	$result['content'],
	'rewrite_html rewrites unquoted inline style attribute URLs.'
);

ssgwp_assert_contains(
	'href=&quot;embedded-page/index.html&quot;',
	$result['content'],
	'rewrite_html rewrites page links inside iframe srcdoc attributes.'
);

ssgwp_assert_contains(
	'src=&quot;wp-content/uploads/photo.jpg?srcdoc=1&quot;',
	$result['content'],
	'rewrite_html rewrites asset URLs inside iframe srcdoc attributes.'
);

ssgwp_assert_contains(
	'url(&quot;wp-content/uploads/bg.jpg?srcdoc=1&quot;)',
	$result['content'],
	'rewrite_html rewrites CSS URLs inside iframe srcdoc attributes.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/embedded-page/', $result['links'], true ),
	'rewrite_html records iframe srcdoc page links as links to crawl.'
);

ssgwp_assert_contains(
	'data="object-page/index.html"',
	$result['content'],
	'rewrite_html rewrites object data page URLs to generated files.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/object-page/', $result['links'], true ),
	'rewrite_html records object data page URLs as links to crawl.'
);

ssgwp_assert_contains(
	'data="wp-content/uploads/social-video.mp4?object=1"',
	$result['content'],
	'rewrite_html keeps object data media URLs as copied assets.'
);

ssgwp_assert_contains(
	'<track kind="captions" src="wp-content/uploads/captions.vtt?lang=en">',
	$result['content'],
	'rewrite_html rewrites video track captions as copied assets.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/social-video.mp4?object=1', $result['assets'], true ),
	'rewrite_html records object data media URLs as assets to copy.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/captions.vtt?lang=en', $result['assets'], true ),
	'rewrite_html records video track captions as assets to copy.'
);

ssgwp_assert_contains(
	'href="wp-content/uploads/filter.png?svg=1"',
	$result['content'],
	'rewrite_html rewrites SVG filter image href attributes.'
);

ssgwp_assert_contains(
	'xlink:href="wp-content/uploads/filter-2x.png?svg=2"',
	$result['content'],
	'rewrite_html rewrites SVG filter image xlink:href attributes.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/filter.png?svg=1', $result['assets'], true ),
	'rewrite_html records SVG filter image href assets to copy.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/uploads/filter-2x.png?svg=2', $result['assets'], true ),
	'rewrite_html records SVG filter image xlink:href assets to copy.'
);

ssgwp_assert_contains(
	'nested\/page\/index.html',
	$result['content'],
	'rewrite_html rewrites JSON-escaped same-site page URLs.'
);

ssgwp_assert_contains(
	'"protocol":"protocol-text/index.html"',
	$result['content'],
	'rewrite_html rewrites protocol-relative same-site page URLs in JSON text.'
);

ssgwp_assert_contains(
	'"protocolEscaped":"protocol-escaped\/index.html"',
	$result['content'],
	'rewrite_html rewrites JSON-escaped protocol-relative same-site page URLs.'
);

ssgwp_assert_contains(
	'"root":"nested\/page\/index.html"',
	$result['content'],
	'rewrite_html rewrites JSON-escaped root-relative page URLs.'
);

ssgwp_assert_contains(
	'"rootAsset":"wp-content\/uploads\/photo.jpg?json=1"',
	$result['content'],
	'rewrite_html rewrites JSON-escaped root-relative asset URLs.'
);

ssgwp_assert_contains(
	'"plainRoot":"static-page/index.html"',
	$result['content'],
	'rewrite_html rewrites plain root-relative page URLs in JSON text.'
);

ssgwp_assert_contains(
	'"plainAsset":"wp-content/uploads/photo.jpg?plain=1"',
	$result['content'],
	'rewrite_html rewrites plain root-relative asset URLs in JSON text.'
);

ssgwp_assert_contains(
	'<meta charset="UTF-8" />',
	$result['content'],
	'rewrite_html does not rewrite self-closing tag slashes as URLs.'
);

ssgwp_assert_contains(
	'"href_matches":"\/*"',
	$result['content'],
	'rewrite_html does not rewrite wildcard speculation-rule URL patterns.'
);

ssgwp_assert_contains(
	'"\/wp-admin\/*"',
	$result['content'],
	'rewrite_html does not rewrite escaped wildcard URL patterns.'
);

ssgwp_assert_contains(
	'"\/wp-content\/uploads\/*"',
	$result['content'],
	'rewrite_html does not rewrite escaped wildcard WordPress asset patterns.'
);

ssgwp_assert_contains(
	'"/wp-content/themes/*"',
	$result['content'],
	'rewrite_html does not rewrite plain wildcard WordPress asset patterns.'
);

ssgwp_assert_contains(
	'const next = "static-page/index.html";',
	$result['content'],
	'rewrite_html rewrites JavaScript same-site page strings.'
);

$rewritten_json = $rewriter->rewrite_text_asset(
	'{"url":"https:\/\/example.test\/nested\/page\/",'
		. '"asset":"https:\/\/example.test\/wp-content\/uploads\/photo.jpg?size=large",'
		. '"protocol":"\/\/example.test\/protocol-escaped\/",'
		. '"root":"\/static-page\/",'
		. '"root_asset":"\/wp-content\/uploads\/photo.jpg?root=1"}',
	'app/data.json'
);

ssgwp_assert_contains(
	'..\/nested\/page\/index.html',
	$rewritten_json,
	'rewrite_text_asset rewrites JSON-escaped page URLs to generated files.'
);

ssgwp_assert_contains(
	'..\/wp-content\/uploads\/photo.jpg?size=large',
	$rewritten_json,
	'rewrite_text_asset rewrites JSON-escaped asset URLs to copied files.'
);

ssgwp_assert_contains(
	'..\/protocol-escaped\/index.html',
	$rewritten_json,
	'rewrite_text_asset rewrites JSON-escaped protocol-relative page URLs.'
);

ssgwp_assert_contains(
	'..\/static-page\/index.html',
	$rewritten_json,
	'rewrite_text_asset rewrites JSON-escaped root-relative page URLs.'
);

ssgwp_assert_contains(
	'..\/wp-content\/uploads\/photo.jpg?root=1',
	$rewritten_json,
	'rewrite_text_asset rewrites JSON-escaped root-relative asset URLs.'
);

$rewritten_manifest = $rewriter->rewrite_text_asset_with_assets(
	'{"icons":[{"src":"icon-192.png"},{"src":".hidden.png"},{"src":"icons/icon.png"},{"src":".\/icons\/maskable.svg?purpose=any"},{"src":"..\/shared\/logo.webp"}]}',
	'wp-content/plugins/app/manifest.json'
);

ssgwp_assert_contains(
	'"src":"../../../wp-content/plugins/app/icon-192.png"',
	$rewritten_manifest['content'],
	'rewrite_text_asset_with_assets rewrites sibling manifest icon paths.'
);

ssgwp_assert_contains(
	'"src":"../../../wp-content/plugins/app/icons/icon.png"',
	$rewritten_manifest['content'],
	'rewrite_text_asset_with_assets rewrites same-directory manifest icon paths.'
);

ssgwp_assert_contains(
	'"src":".hidden.png"',
	$rewritten_manifest['content'],
	'rewrite_text_asset_with_assets leaves hidden sibling asset paths unchanged.'
);

ssgwp_assert_contains(
	'"src":"..\/..\/..\/wp-content\/plugins\/app\/icons\/maskable.svg?purpose=any"',
	$rewritten_manifest['content'],
	'rewrite_text_asset_with_assets normalizes escaped manifest icon paths.'
);

ssgwp_assert_same(
	array(
		'https://example.test/wp-content/plugins/app/icon-192.png',
		'https://example.test/wp-content/plugins/app/icons/icon.png',
		'https://example.test/wp-content/plugins/app/icons/maskable.svg?purpose=any',
		'https://example.test/wp-content/plugins/shared/logo.webp',
	),
	$rewritten_manifest['assets'],
	'rewrite_text_asset_with_assets records relative manifest icon assets to copy.'
);

$rewritten_copied_html = $rewriter->rewrite_text_asset_with_assets(
	'<meta http-equiv="refresh" content="0; url=/static-page/">'
		. '<meta property="og:image" content="/wp-content/uploads/social.jpg">',
	'wp-content/plugins/app/landing.html'
);

ssgwp_assert_contains(
	'content="0; url=../../../static-page/index.html"',
	$rewritten_copied_html['content'],
	'rewrite_text_asset_with_assets rewrites meta refresh URLs in copied HTML assets.'
);

ssgwp_assert_contains(
	'content="../../../wp-content/uploads/social.jpg"',
	$rewritten_copied_html['content'],
	'rewrite_text_asset_with_assets rewrites social meta URLs in copied HTML assets.'
);

$rewritten_copied_svg = $rewriter->rewrite_text_asset_with_assets(
	'<svg><filter><feImage href="icons/filter.png"></feImage></filter></svg>',
	'wp-content/plugins/app/filter.svg'
);

ssgwp_assert_contains(
	'href="../../../wp-content/plugins/app/icons/filter.png"',
	$rewritten_copied_svg['content'],
	'rewrite_text_asset_with_assets rewrites SVG filter image href attributes.'
);

ssgwp_assert_same(
	array( 'https://example.test/wp-content/plugins/app/icons/filter.png' ),
	$rewritten_copied_svg['assets'],
	'rewrite_text_asset_with_assets records SVG filter image href assets to copy.'
);

$rewritten_copied_xml = $rewriter->rewrite_text_asset_with_assets(
	'<browserconfig><msapplication><tile>'
		. '<square70x70logo src="tile-small.png"/>'
		. '<square150x150logo src="icons/tile-150.png"/>'
		. '</tile></msapplication></browserconfig>',
	'wp-content/plugins/app/browserconfig.xml'
);

ssgwp_assert_contains(
	'src="../../../wp-content/plugins/app/tile-small.png"',
	$rewritten_copied_xml['content'],
	'rewrite_text_asset_with_assets rewrites XML sibling asset paths.'
);

ssgwp_assert_contains(
	'src="../../../wp-content/plugins/app/icons/tile-150.png"',
	$rewritten_copied_xml['content'],
	'rewrite_text_asset_with_assets rewrites XML nested asset paths.'
);

ssgwp_assert_same(
	array(
		'https://example.test/wp-content/plugins/app/tile-small.png',
		'https://example.test/wp-content/plugins/app/icons/tile-150.png',
	),
	$rewritten_copied_xml['assets'],
	'rewrite_text_asset_with_assets records XML tile assets to copy.'
);

$rewritten_asset_text = $rewriter->rewrite_text_asset(
	'asset=/wp-content/uploads/photo.jpg?text=1 escaped=\/wp-content\/uploads\/photo.jpg?text=2',
	'app/app.js'
);

ssgwp_assert_contains(
	'asset=../wp-content/uploads/photo.jpg?text=1',
	$rewritten_asset_text,
	'rewrite_text_asset rewrites unstructured root-relative WordPress asset paths.'
);

ssgwp_assert_contains(
	'escaped=..\/wp-content\/uploads\/photo.jpg?text=2',
	$rewritten_asset_text,
	'rewrite_text_asset rewrites unstructured escaped root-relative WordPress asset paths.'
);

$rewritten_js = $rewriter->rewrite_text_asset(
	'const next = "https://example.test/static-page/";'
		. ' const protocol = "//example.test/protocol-text/";'
		. ' const root = "/nested/page/";',
	'app/app.js'
);

ssgwp_assert_contains(
	'../static-page/index.html',
	$rewritten_js,
	'rewrite_text_asset rewrites JavaScript same-site page strings.'
);

ssgwp_assert_contains(
	'../nested/page/index.html',
	$rewritten_js,
	'rewrite_text_asset rewrites JavaScript root-relative page strings.'
);

ssgwp_assert_contains(
	'../protocol-text/index.html',
	$rewritten_js,
	'rewrite_text_asset rewrites JavaScript protocol-relative page strings.'
);

$rewritten_player_json = $rewriter->rewrite_text_asset_with_assets(
	'{"captions":"captions.vtt","thumbnail":"poster.webp"}',
	'wp-content/plugins/player/config.json'
);

ssgwp_assert_contains(
	'"captions":"../../../wp-content/plugins/player/captions.vtt"',
	$rewritten_player_json['content'],
	'rewrite_text_asset_with_assets rewrites relative WebVTT captions.'
);

ssgwp_assert_same(
	true,
	in_array( 'https://example.test/wp-content/plugins/player/captions.vtt', $rewritten_player_json['assets'], true ),
	'rewrite_text_asset_with_assets records relative WebVTT captions to copy.'
);

$rewritten_css = $rewriter->rewrite_text_asset(
	'.hero{background:url("https://example.test/wp-content/uploads/bg.jpg?ver=1")}',
	'wp-content/themes/theme/app.css'
);

ssgwp_assert_contains(
	'../../../wp-content/uploads/bg.jpg?ver=1',
	$rewritten_css,
	'rewrite_text_asset rewrites CSS same-site asset URLs.'
);

$rewritten_css = $rewriter->rewrite_text_asset(
	'@font-face{src:url("../fonts/dashicons.eot?ver=1")}',
	'wp-includes/css/dashicons.css'
);

ssgwp_assert_contains(
	'../../wp-includes/fonts/dashicons.eot?ver=1',
	$rewritten_css,
	'rewrite_text_asset resolves relative CSS URLs from the copied asset path.'
);

$rewritten_image_set_css = $rewriter->rewrite_text_asset_with_assets(
	'.hero{background-image:image-set("images/hero.png" 1x, '
		. '"/wp-content/uploads/photo-2x.jpg?image-set=2" 2x, type("image/png"))}'
		. '.wide{background-image:-webkit-image-set("../shared/hero.webp" 1x)}',
	'wp-content/plugins/app/styles/app.css'
);

ssgwp_assert_contains(
	'image-set("../../../../wp-content/plugins/app/styles/images/hero.png" 1x, '
		. '"../../../../wp-content/uploads/photo-2x.jpg?image-set=2" 2x, type("image/png"))',
	$rewritten_image_set_css['content'],
	'rewrite_text_asset_with_assets rewrites quoted CSS image-set URLs.'
);

ssgwp_assert_contains(
	'-webkit-image-set("../../../../wp-content/plugins/app/shared/hero.webp" 1x)',
	$rewritten_image_set_css['content'],
	'rewrite_text_asset_with_assets rewrites prefixed image-set URLs.'
);

ssgwp_assert_same(
	array(
		'https://example.test/wp-content/plugins/app/styles/images/hero.png',
		'https://example.test/wp-content/uploads/photo-2x.jpg?image-set=2',
		'https://example.test/wp-content/plugins/app/shared/hero.webp',
	),
	$rewritten_image_set_css['assets'],
	'rewrite_text_asset_with_assets records CSS image-set assets to copy.'
);

ssgwp_assert_static_target_exists(
	$export_root,
	'wp-includes/css/dashicons.css',
	'../../wp-includes/fonts/dashicons.eot?ver=1',
	'rewritten relative CSS URL target exists.'
);

foreach (
	array(
		'static-page/index.html',
		'static-page-' . $view_hash . '.html#items',
		'blog/page/2/index.html#posts',
		'comments/index.html',
		'nested/page/index.html#section',
		'nested/page/index.html#share',
		'protocol-escaped/index.html',
		'protocol-page/index.html',
		'protocol-text/index.html',
		'prefetched-page/index.html',
		'deferred-page/index.html',
		'framed-page/index.html',
		'lazy-frame/index.html',
		'embed-page/index.html',
		'author/admin/index.html',
		'publisher/index.html',
		'related/index.html',
		'embedded-page/index.html',
		'video-player/index.html',
		'encoded%20page/index.html',
		'collision%20page/index.html',
		'collision%2Bpage/index.html',
		'nested%2Fsegment/index.html',
		'%2E%2E/secret/index.html',
		'index-' . $query_hash . '.html#comments',
		'wp-content/uploads/social.jpg?ver=1',
		'wp-content/uploads/social-audio.mp3?ver=1',
		'wp-content/uploads/social-video.mp4?ver=1',
		'wp-content/uploads/social-video.mp4?schema=1',
		'wp-content/uploads/social-video.mp4?embed=1',
		'wp-content/uploads/social-video.mp4?lazy-embed=1',
		'wp-content/uploads/social-video.mp4?stream=1',
		'wp-content/uploads/captions.vtt?lang=en',
			'wp-content/uploads/tile.png',
			'wp-content/uploads/tile.png?small=1',
			'wp-content/uploads/tile.png?wide=1',
			'wp-content/uploads/photo.jpg?size=large',
			'wp-content/uploads/photo.jpg?prefetch=1',
			'wp-content/uploads/photo.jpg?deferred=1',
			'wp-content/uploads/photo.jpg?data-link=1',
			'wp-content/uploads/photo.jpg?lazy=3',
		'wp-content/uploads/photo.jpg?lazy=4',
		'wp-content/uploads/photo.jpg?frame=1',
		'wp-content/uploads/photo-2x.jpg',
		'wp-content/uploads/image-set.jpg?density=1',
		'wp-content/uploads/image-set-2x.jpg?density=2',
		'wp-content/uploads/bg.jpg?lazy=1',
		'wp-content/uploads/bg.jpg?lazy=2',
		'wp-content/uploads/bg.jpg?lazy=5',
		'wp-content/uploads/bg.jpg?unquoted=1',
	)
	as $static_url
) {
	ssgwp_assert_static_target_exists(
		$export_root,
		'index.html',
		$static_url,
		'rewritten URL target exists: ' . $static_url
	);
}

$nested_result = $rewriter->rewrite_html(
	'<base href="https://example.test/nested/page/"><a href="/static-page/">Nested</a>',
	'https://example.test/nested/page/',
	'nested/page/index.html'
);

ssgwp_assert_contains(
	'<base href="./">',
	$nested_result['content'],
	'rewrite_html keeps nested page base hrefs relative to the generated document.'
);

ssgwp_assert_contains(
	'href="../../static-page/index.html"',
	$nested_result['content'],
	'rewrite_html builds file-targeting relative URLs from nested pages.'
);

ssgwp_assert_static_target_exists(
	$export_root,
	'nested/page/index.html',
	'../../static-page/index.html',
	'nested page rewritten URL target exists.'
);

$ssgwp_test_home_url     = 'https://playground.wordpress.net/scope:sad-quiet-school';
$ssgwp_test_site_url     = 'https://playground.wordpress.net/scope:sad-quiet-school';
$ssgwp_test_content_url  = 'https://playground.wordpress.net/scope:sad-quiet-school/wp-content';
$ssgwp_test_includes_url = 'https://playground.wordpress.net/scope:sad-quiet-school/wp-includes';

$scoped_result = $rewriter->rewrite_html(
	'<a href="https://playground.wordpress.net/scope:sad-quiet-school/sample-page/">Sample</a>'
		. '<a href="/scope:sad-quiet-school/sample-page/">Root</a>'
		. '<base href="https://playground.wordpress.net/scope:sad-quiet-school/">'
		. '<a href="https://playground.wordpress.net/scope:other-site/sample-page/">Other</a>'
		. '<img src="https://playground.wordpress.net/scope:other-site/wp-content/uploads/photo.jpg" alt="">'
		. '<img src="/scope:sad-quiet-school/wp-content/uploads/photo.jpg" alt="">'
		. '<script type="application/json">{"plainRootAsset":"/wp-content/uploads/photo.jpg","plainRootAssetEscaped":"\/wp-content\/uploads\/photo.jpg"}</script>',
	'https://playground.wordpress.net/scope:sad-quiet-school/',
	'index.html'
);

ssgwp_assert_contains(
	'href="sample-page/index.html"',
	$scoped_result['content'],
	'rewrite_html strips the Playground scope base from same-site page links.'
);

ssgwp_assert_contains(
	'src="wp-content/uploads/photo.jpg"',
	$scoped_result['content'],
	'rewrite_html strips the Playground scope base from same-site asset links.'
);

ssgwp_assert_contains(
	'<base href="./">',
	$scoped_result['content'],
	'rewrite_html anchors scoped same-site base hrefs to the static document directory.'
);

ssgwp_assert_contains(
	'"plainRootAsset":"/wp-content/uploads/photo.jpg"',
	$scoped_result['content'],
	'rewrite_html leaves root-level WordPress asset paths outside the Playground scope unchanged.'
);

ssgwp_assert_contains(
	'"plainRootAssetEscaped":"\/wp-content\/uploads\/photo.jpg"',
	$scoped_result['content'],
	'rewrite_html leaves escaped root-level WordPress asset paths outside the Playground scope unchanged.'
);

ssgwp_assert_contains(
	'href="https://playground.wordpress.net/scope:other-site/sample-page/"',
	$scoped_result['content'],
	'rewrite_html leaves same-host page links from another Playground scope unchanged.'
);

ssgwp_assert_contains(
	'src="https://playground.wordpress.net/scope:other-site/wp-content/uploads/photo.jpg"',
	$scoped_result['content'],
	'rewrite_html leaves same-host asset links from another Playground scope unchanged.'
);

ssgwp_assert_not_contains(
	'scope%3Asad-quiet-school/scope%3Asad-quiet-school',
	$scoped_result['content'],
	'rewrite_html avoids duplicated encoded Playground scope paths.'
);

ssgwp_assert_static_target_exists(
	$export_root,
	'index.html',
	'sample-page/index.html',
	'scoped page rewritten URL target exists.'
);

$ssgwp_test_home_url     = 'https://example.test';
$ssgwp_test_site_url     = 'https://example.test';
$ssgwp_test_content_url  = 'https://example.test/wp-content';
$ssgwp_test_includes_url = 'https://example.test/wp-includes';

foreach (
	array(
		'href="/wp-admin/admin.php"',
		'href="/wp-json/wp/v2/posts"',
		'href="/?rest_route=/wp/v2/posts"',
		'href="/feed/"',
		'href="/?feed=rss2"',
		'type="application/rss+xml" href="/feed/"',
		'type="application/rss+xml" href="/?feed=rss2"',
		'type="application/rss+xml" href="/comments/feed/"',
		'href="https://external.test/static-page/"',
		'href="https://example.test:8443/static-page/"',
		'href="http://example.test:443/static-page/"',
		'href="mailto:test@example.test"',
		'href="tel:+15551234567"',
		'href="javascript:void(0)"',
		'href="data:text/plain,hello"',
		'href="blob:https://example.test/id"',
		'"rest":"https:\/\/example.test\/?rest_route=\/wp\/v2\/posts"',
	)
	as $unchanged
) {
	ssgwp_assert_contains(
		$unchanged,
		$result['content'],
		'rewrite_html leaves unsupported or external URL unchanged: ' . $unchanged
	);
}

ssgwp_assert_same(
	true,
	$rewriter->is_same_site_url( 'https://example.test:443/static-page/' ),
	'is_same_site_url treats the explicit HTTPS default port as same-origin.'
);

ssgwp_assert_same(
	false,
	$rewriter->is_same_site_url( 'https://example.test:8443/static-page/' ),
	'is_same_site_url rejects a different explicit port.'
);

ssgwp_assert_same(
	false,
	$rewriter->is_same_site_url( 'http://example.test:443/static-page/' ),
	'is_same_site_url rejects a different scheme even when the port matches.'
);

ssgwp_delete_directory( $export_root );

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
 * @param string $needle   Expected substring.
 * @param string $haystack String to search.
 * @param string $message  Failure message.
 */
function ssgwp_assert_contains( $needle, $haystack, $message ) {
	if ( false !== strpos( $haystack, $needle ) ) {
		return;
	}

	ssgwp_fail( $message . ' Missing ' . var_export( $needle, true ) . '.' );
}

/**
 * Assert text does not contain a substring.
 *
 * @param string $needle  Expected absent substring.
 * @param string $haystack Text to inspect.
 * @param string $message Failure message.
 */
function ssgwp_assert_not_contains( $needle, $haystack, $message ) {
	if ( false === strpos( $haystack, $needle ) ) {
		return;
	}

	ssgwp_fail( $message . ' Unexpected ' . var_export( $needle, true ) . '.' );
}

/**
 * Create a file in the export fixture.
 *
 * @param string $export_root Export fixture root.
 * @param string $relative    Relative file path.
 */
function ssgwp_touch_export_file( $export_root, $relative ) {
	$path = trailingslashit( $export_root ) . $relative;

	if ( ! is_dir( dirname( $path ) ) && ! mkdir( dirname( $path ), 0777, true ) ) {
		ssgwp_fail( 'Could not create fixture directory for ' . $relative . '.' );
	}

	file_put_contents( $path, '' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
}

/**
 * Assert a rewritten static URL points to an existing exported file.
 *
 * @param string $export_root Export fixture root.
 * @param string $from_file   Referencing file.
 * @param string $url         Rewritten URL.
 * @param string $message     Failure message.
 */
function ssgwp_assert_static_target_exists( $export_root, $from_file, $url, $message ) {
	$path = preg_replace( '/[?#].*$/', '', $url );

	if ( preg_match( '#^[a-z][a-z0-9+.-]*:#i', $path ) || 0 === strpos( $path, '/' ) ) {
		ssgwp_fail( $message . ' Expected a relative static URL, got ' . var_export( $url, true ) . '.' );
	}

	$target = ssgwp_normalize_fixture_path( dirname( $from_file ) . '/' . $path );
	$target = trailingslashit( $export_root ) . $target;

	if ( is_file( $target ) ) {
		return;
	}

	ssgwp_fail( $message . ' Missing exported file ' . var_export( $target, true ) . '.' );
}

/**
 * Normalize a relative fixture path.
 *
 * @param string $path Relative path.
 * @return string
 */
function ssgwp_normalize_fixture_path( $path ) {
	$segments = array();

	foreach ( explode( '/', wp_normalize_path( $path ) ) as $segment ) {
		if ( '' === $segment || '.' === $segment ) {
			continue;
		}

		if ( '..' === $segment ) {
			array_pop( $segments );
			continue;
		}

		$segments[] = $segment;
	}

	return implode( '/', $segments );
}

/**
 * Create a temporary fixture directory.
 *
 * @return string
 */
function ssgwp_make_fixture_dir() {
	$directory = sys_get_temp_dir() . '/ssgwp-url-rewriter-' . getmypid() . '-' . mt_rand();

	if ( ! mkdir( $directory ) ) {
		ssgwp_fail( 'Could not create fixture directory.' );
	}

	return wp_normalize_path( $directory );
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
