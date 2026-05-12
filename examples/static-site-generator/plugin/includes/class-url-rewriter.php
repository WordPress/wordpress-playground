<?php
/**
 * Rewrites WordPress URLs for static exports.
 *
 * @package PlaygroundStaticSiteGenerator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Rewrites same-site URLs in HTML and text assets.
 */
final class SSGWP_URL_Rewriter {
	/**
	 * URL collector used for same-site normalization.
	 *
	 * @var SSGWP_URL_Collector
	 */
	private $collector;

	/**
	 * URL output mode.
	 *
	 * @var string
	 */
	private $url_mode;

	/**
	 * Discovered page URLs.
	 *
	 * @var string[]
	 */
	private $links = array();

	/**
	 * Discovered asset URLs.
	 *
	 * @var string[]
	 */
	private $assets = array();

	/**
	 * Constructor.
	 *
	 * @param SSGWP_URL_Collector $collector URL collector.
	 * @param string              $url_mode  URL mode.
	 */
	public function __construct( SSGWP_URL_Collector $collector, $url_mode ) {
		$this->collector = $collector;
		$this->url_mode  = $url_mode;
	}

	/**
	 * Rewrite URLs in an HTML document.
	 *
	 * @param string $html        HTML.
	 * @param string $page_url    URL being exported.
	 * @param string $target_path Relative static file path.
	 * @return array{content:string,links:string[],assets:string[]}
	 */
	public function rewrite_html( $html, $page_url, $target_path ) {
		$this->links  = array();
		$this->assets = array();

		$html = $this->rewrite_html_attributes( (string) $html, $page_url, $target_path );
		$html = $this->rewrite_meta_refresh( $html, $page_url, $target_path );
		$html = $this->rewrite_css_in_style_blocks( $html, $page_url, $target_path );
		$html = $this->rewrite_css_in_style_attributes( $html, $page_url, $target_path );
		$html = $this->rewrite_same_site_text_urls( $html, $target_path );

		return array(
			'content' => $html,
			'links'   => array_values( $this->links ),
			'assets'  => array_values( $this->assets ),
		);
	}

	/**
	 * Rewrite URLs in a copied text asset.
	 *
	 * @param string $content       File content.
	 * @param string $relative_path Relative static file path.
	 * @return string
	 */
	public function rewrite_text_asset( $content, $relative_path ) {
		$extension = strtolower( pathinfo( $relative_path, PATHINFO_EXTENSION ) );
		$content   = (string) $content;
		$base_url  = home_url( '/' );

		if ( 'css' === $extension ) {
			$content = $this->rewrite_css_urls( $content, $base_url, $relative_path );
		} elseif ( in_array( $extension, array( 'html', 'svg' ), true ) ) {
			$content = $this->rewrite_html_attributes( $content, $base_url, $relative_path );
			$content = $this->rewrite_css_in_style_blocks( $content, $base_url, $relative_path );
			$content = $this->rewrite_css_in_style_attributes( $content, $base_url, $relative_path );
		}

		return $this->rewrite_same_site_text_urls( $content, $relative_path );
	}

	/**
	 * Rewrite URL-bearing HTML attributes.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_html_attributes( $html, $base_url, $target_path ) {
		if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			return $this->rewrite_html_attributes_with_patterns( $html, $base_url, $target_path );
		}

		$attributes_by_tag = array(
			'A'          => array( 'href' => 'page' ),
			'AREA'       => array( 'href' => 'page' ),
			'AUDIO'      => array( 'src' => 'asset' ),
			'BLOCKQUOTE' => array( 'cite' => 'page' ),
			'BODY'       => array( 'background' => 'asset' ),
			'BUTTON'     => array( 'formaction' => 'page' ),
			'DEL'        => array( 'cite' => 'page' ),
			'EMBED'      => array( 'src' => 'asset' ),
			'FORM'       => array( 'action' => 'page' ),
			'HTML'       => array(
				'background' => 'asset',
				'manifest'   => 'asset',
			),
			'IFRAME'     => array( 'src' => 'maybe' ),
			'IMG'        => array(
				'data-bg'          => 'asset',
				'data-lazy-src'    => 'asset',
				'data-lazy-srcset' => 'srcset',
				'data-src'         => 'asset',
				'data-srcset'      => 'srcset',
				'poster'           => 'asset',
				'src'              => 'asset',
				'srcset'           => 'srcset',
			),
			'IMAGE'      => array(
				'href'       => 'asset',
				'xlink:href' => 'asset',
			),
			'INPUT'      => array(
				'formaction' => 'page',
				'src'        => 'asset',
			),
			'INS'        => array( 'cite' => 'page' ),
			'LINK'       => array( 'href' => 'link' ),
			'OBJECT'     => array( 'data' => 'asset' ),
			'Q'          => array( 'cite' => 'page' ),
			'SCRIPT'     => array( 'src' => 'asset' ),
			'SOURCE'     => array(
				'src'    => 'asset',
				'srcset' => 'srcset',
			),
			'TRACK'      => array( 'src' => 'asset' ),
			'USE'        => array(
				'href'       => 'asset',
				'xlink:href' => 'asset',
			),
			'VIDEO'      => array(
				'poster' => 'asset',
				'src'    => 'asset',
				'srcset' => 'srcset',
			),
		);

		foreach ( $attributes_by_tag as $tag_name => $attributes ) {
			$processor    = new WP_HTML_Tag_Processor( $html );
			$changed      = false;
			$placeholders = array();

			while ( $processor->next_tag( $tag_name ) ) {
				foreach ( $attributes as $attribute => $kind ) {
					$value = $processor->get_attribute( $attribute );

					if ( ! is_string( $value ) || '' === $value ) {
						continue;
					}

					if ( 'link' === $kind ) {
						$kind = $this->link_attribute_kind( $processor );
					}

					if ( 'srcset' === $kind ) {
						$rewritten = $this->rewrite_srcset( $value, $base_url, $target_path );
					} else {
						$rewritten = $this->rewrite_url_value( $value, $base_url, $target_path, $kind );
					}

					if ( $rewritten !== $value ) {
						$processor->set_attribute( $attribute, $this->prepare_html_attribute_value( $rewritten, $placeholders ) );
						$changed = true;
					}
				}
			}

			if ( $changed ) {
				$html = strtr( $processor->get_updated_html(), $placeholders );
			}
		}

		return $html;
	}

	/**
	 * Rewrite common URL attributes without the HTML API.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_html_attributes_with_patterns( $html, $base_url, $target_path ) {
		$attribute_kinds = array(
			'href'             => 'maybe',
			'src'              => 'asset',
			'srcset'           => 'srcset',
			'poster'           => 'asset',
			'action'           => 'page',
			'formaction'       => 'page',
			'data'             => 'asset',
			'cite'             => 'page',
			'manifest'         => 'asset',
			'background'       => 'asset',
			'data-src'         => 'asset',
			'data-srcset'      => 'srcset',
			'data-lazy-src'    => 'asset',
			'data-lazy-srcset' => 'srcset',
			'data-bg'          => 'asset',
			'xlink:href'       => 'asset',
		);

		foreach ( $attribute_kinds as $attribute => $kind ) {
			$pattern = '/(\s' . preg_quote( $attribute, '/' ) . '\s*=\s*)(["\'])(.*?)\2/is';
			$html    = preg_replace_callback(
				$pattern,
				function ( $matches ) use ( $base_url, $target_path, $kind ) {
					if ( 'srcset' === $kind ) {
						$rewritten = $this->rewrite_srcset( $matches[3], $base_url, $target_path );
					} else {
						$rewritten = $this->rewrite_url_value( $matches[3], $base_url, $target_path, $kind );
					}

					return $matches[1] . $matches[2] . esc_attr( $rewritten ) . $matches[2];
				},
				$html
			);
		}

		return $html;
	}

	/**
	 * Determine how to treat a link element href.
	 *
	 * @param WP_HTML_Tag_Processor $processor HTML processor.
	 * @return string URL kind.
	 */
	private function link_attribute_kind( $processor ) {
		$rel  = strtolower( (string) $processor->get_attribute( 'rel' ) );
		$type = strtolower( (string) $processor->get_attribute( 'type' ) );

		if ( preg_match( '/\b(canonical|alternate|prev|next|shortlink|bookmark)\b/', $rel ) && ! preg_match( '#/(css|javascript|json|xml|rss|atom)#', $type ) ) {
			return 'page';
		}

		return 'asset';
	}

	/**
	 * Rewrite URLs inside srcset attributes.
	 *
	 * @param string $srcset      srcset value.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_srcset( $srcset, $base_url, $target_path ) {
		if ( false !== stripos( $srcset, 'data:' ) ) {
			return $srcset;
		}

		$candidates = preg_split( '/\s*,\s*/', trim( $srcset ) );
		$output     = array();

		foreach ( $candidates as $candidate ) {
			if ( '' === $candidate ) {
				continue;
			}

			if ( ! preg_match( '/^(\S+)(\s+.+)?$/', $candidate, $matches ) ) {
				$output[] = $candidate;
				continue;
			}

			$url        = $matches[1];
			$descriptor = isset( $matches[2] ) ? $matches[2] : '';
			$output[]   = $this->rewrite_url_value( $url, $base_url, $target_path, 'asset' ) . $descriptor;
		}

		return implode( ', ', $output );
	}

	/**
	 * Rewrite meta refresh URLs.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_meta_refresh( $html, $base_url, $target_path ) {
		if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			return $html;
		}

		$processor    = new WP_HTML_Tag_Processor( $html );
		$changed      = false;
		$placeholders = array();

		while ( $processor->next_tag( 'META' ) ) {
			$http_equiv = strtolower( (string) $processor->get_attribute( 'http-equiv' ) );

			if ( 'refresh' !== $http_equiv ) {
				continue;
			}

			$content = $processor->get_attribute( 'content' );

			if ( ! is_string( $content ) || false === stripos( $content, 'url=' ) ) {
				continue;
			}

			$rewritten = preg_replace_callback(
				'/(url\s*=\s*)([^;]+)/i',
				function ( $matches ) use ( $base_url, $target_path ) {
					$url   = trim( $matches[2], " \t\n\r\0\x0B'\"" );
					$quote = '';

					if ( preg_match( '/^\s*([\'"])/', $matches[2], $quote_match ) ) {
						$quote = $quote_match[1];
					}

					return $matches[1] . $quote . $this->rewrite_url_value( $url, $base_url, $target_path, 'page' ) . $quote;
				},
				$content
			);

			if ( $rewritten !== $content ) {
				$processor->set_attribute( 'content', $this->prepare_html_attribute_value( $rewritten, $placeholders ) );
				$changed = true;
			}
		}

		return $changed ? strtr( $processor->get_updated_html(), $placeholders ) : $html;
	}

	/**
	 * Prepare a value for WP_HTML_Tag_Processor::set_attribute().
	 *
	 * WordPress escapes URL attributes through esc_url(), which prepends a scheme
	 * to relative paths such as ../page/. A temporary root-relative placeholder
	 * keeps the HTML API mutation safe while preserving the requested output mode.
	 *
	 * @param string $value        Attribute value.
	 * @param array  $placeholders Placeholder replacements.
	 * @return string Value safe to pass to set_attribute().
	 */
	private function prepare_html_attribute_value( $value, array &$placeholders ) {
		if ( 'relative' !== $this->url_mode || preg_match( '#^(?:[a-z][a-z0-9+.-]*:|/|#|\?)#i', $value ) ) {
			return $value;
		}

		$placeholder                  = '/__ssgwp_relative_url_' . count( $placeholders ) . '__';
		$placeholders[ $placeholder ] = esc_attr( $value );

		return $placeholder;
	}

	/**
	 * Rewrite URLs inside style blocks.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_css_in_style_blocks( $html, $base_url, $target_path ) {
		return preg_replace_callback(
			'#(<style\b[^>]*>)(.*?)(</style>)#is',
			function ( $matches ) use ( $base_url, $target_path ) {
				return $matches[1] . $this->rewrite_css_urls( $matches[2], $base_url, $target_path ) . $matches[3];
			},
			$html
		);
	}

	/**
	 * Rewrite URLs inside inline style attributes.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_css_in_style_attributes( $html, $base_url, $target_path ) {
		return preg_replace_callback(
			'/(\sstyle\s*=\s*)(["\'])(.*?)\2/is',
			function ( $matches ) use ( $base_url, $target_path ) {
				return $matches[1] . $matches[2] . esc_attr( $this->rewrite_css_urls( html_entity_decode( $matches[3], ENT_QUOTES ), $base_url, $target_path ) ) . $matches[2];
			},
			$html
		);
	}

	/**
	 * Rewrite URLs in CSS url() and @import statements.
	 *
	 * @param string $css         CSS.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_css_urls( $css, $base_url, $target_path ) {
		$css = preg_replace_callback(
			'/url\(\s*([\'"]?)(.*?)\1\s*\)/i',
			function ( $matches ) use ( $base_url, $target_path ) {
				$url = trim( $matches[2] );

				if ( '' === $url ) {
					return $matches[0];
				}

				$quote = $matches[1];

				return 'url(' . $quote . $this->rewrite_url_value( $url, $base_url, $target_path, 'asset' ) . $quote . ')';
			},
			$css
		);

		return preg_replace_callback(
			'/@import\s+([\'"])(.*?)\1/i',
			function ( $matches ) use ( $base_url, $target_path ) {
				return '@import ' . $matches[1] . $this->rewrite_url_value( $matches[2], $base_url, $target_path, 'asset' ) . $matches[1];
			},
			$css
		);
	}

	/**
	 * Rewrite one URL value.
	 *
	 * @param string $value       URL value.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @param string $kind        URL kind: page, asset, maybe.
	 * @return string
	 */
	private function rewrite_url_value( $value, $base_url, $target_path, $kind ) {
		$value = html_entity_decode( trim( (string) $value ), ENT_QUOTES );

		if ( '' === $value || $this->is_special_url( $value ) ) {
			return $value;
		}

		$absolute = $this->collector->resolve_relative_url( $value, $base_url );

		if ( ! $this->is_same_site_url( $absolute ) ) {
			return $value;
		}

		if ( 'maybe' === $kind ) {
			$kind = $this->is_page_like_url( $absolute ) ? 'page' : 'asset';
		}

		$static_url = $absolute;

		if ( 'page' === $kind && $this->is_page_like_url( $absolute ) ) {
			$normalized = $this->collector->normalize_url( $absolute );

			if ( null === $normalized ) {
				return $value;
			}

			$this->links[ $normalized ] = $normalized;
			$static_url                 = $normalized;
		} elseif ( 'page' === $kind ) {
			$this->assets[ $absolute ] = $absolute;
		} elseif ( 'asset' === $kind ) {
			$this->assets[ $absolute ] = $absolute;
		}

		return $this->url_to_static_url( $static_url, $target_path );
	}

	/**
	 * Check whether a URL should not be rewritten.
	 *
	 * @param string $url URL.
	 * @return bool
	 */
	private function is_special_url( $url ) {
		if ( '#' === $url[0] || 0 === strpos( $url, '{{' ) || 0 === strpos( $url, '<%' ) ) {
			return true;
		}

		return (bool) preg_match( '#^(?:about|blob|data|file|geo|javascript|mailto|sms|tel|urn|webcal|whatsapp):#i', $url );
	}

	/**
	 * Check if a URL belongs to this WordPress site.
	 *
	 * @param string $url URL.
	 * @return bool
	 */
	public function is_same_site_url( $url ) {
		$url_parts  = wp_parse_url( $url );
		$home_parts = wp_parse_url( home_url( '/' ) );

		if ( empty( $url_parts['host'] ) || empty( $home_parts['host'] ) ) {
			return false;
		}

		if ( strtolower( $url_parts['host'] ) !== strtolower( $home_parts['host'] ) ) {
			return false;
		}

		if ( isset( $home_parts['port'], $url_parts['port'] ) && (int) $home_parts['port'] !== (int) $url_parts['port'] ) {
			return false;
		}

		return true;
	}

	/**
	 * Determine whether a URL is likely to be an exportable HTML page.
	 *
	 * @param string $url URL.
	 * @return bool
	 */
	public function is_page_like_url( $url ) {
		$path      = (string) wp_parse_url( $url, PHP_URL_PATH );
		$extension = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );

		if ( '' === $extension ) {
			return true;
		}

		return in_array( $extension, array( 'htm', 'html', 'php' ), true );
	}

	/**
	 * Convert a same-site URL to its static export URL.
	 *
	 * @param string $url         URL.
	 * @param string $target_path Relative static file path of the referencing file.
	 * @return string
	 */
	private function url_to_static_url( $url, $target_path ) {
		$parts    = wp_parse_url( $url );
		$path     = isset( $parts['path'] ) ? rawurldecode( $parts['path'] ) : '/';
		$query    = isset( $parts['query'] ) ? $parts['query'] : '';
		$fragment = isset( $parts['fragment'] ) ? $parts['fragment'] : '';
		$web_path = $this->url_path_to_static_web_path( $path, $query );
		$has_ext  = $this->path_has_exported_extension( $path );

		if ( 'absolute' === $this->url_mode ) {
			$output = trailingslashit( home_url( '/' ) ) . ltrim( $web_path, '/' );
		} elseif ( 'root' === $this->url_mode ) {
			$output = '' === $web_path ? '/' : '/' . ltrim( $web_path, '/' );
		} else {
			$output = $this->make_relative_url( $target_path, $web_path );
		}

		if ( '' !== $query && $has_ext ) {
			$output .= '?' . $query;
		}

		if ( '' !== $fragment ) {
			$output .= '#' . $fragment;
		}

		return $output;
	}

	/**
	 * Convert a URL path to a static web path.
	 *
	 * @param string $path  URL path.
	 * @param string $query URL query string.
	 * @return string
	 */
	private function url_path_to_static_web_path( $path, $query = '' ) {
		$path = $this->map_wordpress_asset_path( $path );
		$path = trim( rawurldecode( $path ), '/' );

		if ( '' === $path ) {
			$file_path = 'index.html';
			$web_path  = '';
		} elseif ( $this->path_has_exported_extension( $path ) ) {
			$file_path = $this->sanitize_relative_path( $path );
			$web_path  = $file_path;
		} else {
			$file_path = trailingslashit( $this->sanitize_relative_path( $path ) ) . 'index.html';
			$web_path  = trailingslashit( $this->sanitize_relative_path( $path ) );
		}

		if ( '' === $query || $this->path_has_exported_extension( $path ) ) {
			return $web_path;
		}

		return preg_replace( '#(?:/index)?\.html$#', '-' . substr( md5( $query ), 0, 8 ) . '.html', $file_path );
	}

	/**
	 * Map WordPress asset URL paths to the export directory layout.
	 *
	 * @param string $path URL path.
	 * @return string Static path.
	 */
	private function map_wordpress_asset_path( $path ) {
		$path     = '/' . trim( rawurldecode( $path ), '/' );
		$mappings = array(
			array(
				'url'    => content_url( '/' ),
				'static' => 'wp-content/',
			),
			array(
				'url'    => includes_url( '/' ),
				'static' => 'wp-includes/',
			),
		);

		usort(
			$mappings,
			static function ( $a, $b ) {
				$a_path = (string) wp_parse_url( $a['url'], PHP_URL_PATH );
				$b_path = (string) wp_parse_url( $b['url'], PHP_URL_PATH );

				return strlen( $b_path ) <=> strlen( $a_path );
			}
		);

		foreach ( $mappings as $mapping ) {
			$base_path = '/' . trim( rawurldecode( (string) wp_parse_url( $mapping['url'], PHP_URL_PATH ) ), '/' );
			$base_path = '/' === $base_path ? '/' : trailingslashit( $base_path );

			if ( '/' === $base_path || 0 !== strpos( trailingslashit( $path ), $base_path ) ) {
				continue;
			}

			return trailingslashit( $mapping['static'] ) . ltrim( substr( $path, strlen( $base_path ) ), '/' );
		}

		return $path;
	}

	/**
	 * Determine whether a path has a file extension that should remain a file.
	 *
	 * @param string $path URL path.
	 * @return bool
	 */
	private function path_has_exported_extension( $path ) {
		return (bool) preg_match( '#\.[a-z0-9]{1,12}$#i', $path );
	}

	/**
	 * Build a relative URL from one exported file to another.
	 *
	 * @param string $from_file Relative source file path.
	 * @param string $to_path   Relative target web path.
	 * @return string
	 */
	private function make_relative_url( $from_file, $to_path ) {
		$from_dir = dirname( wp_normalize_path( $from_file ) );
		$from_dir = '.' === $from_dir ? '' : trim( $from_dir, '/' );
		$depth    = '' === $from_dir ? 0 : count( array_filter( explode( '/', $from_dir ) ) );
		$prefix   = str_repeat( '../', $depth );

		if ( '' === $to_path ) {
			return '' === $prefix ? './' : $prefix;
		}

		return $prefix . ltrim( $to_path, '/' );
	}

	/**
	 * Rewrite same-site URLs embedded in text or JSON.
	 *
	 * @param string $content     File content.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_same_site_text_urls( $content, $target_path ) {
		$bases = array_unique(
			array_filter(
				array(
					home_url( '/' ),
					site_url( '/' ),
					content_url( '/' ),
					includes_url( '/' ),
				)
			)
		);

		usort(
			$bases,
			static function ( $a, $b ) {
				return strlen( $b ) <=> strlen( $a );
			}
		);

		foreach ( $bases as $base ) {
			$base       = trailingslashit( $base );
			$static     = $this->url_to_static_url( $base, $target_path );
			$escaped_in = str_replace( '/', '\\/', $base );
			$escaped_to = str_replace( '/', '\\/', $static );

			$content = str_replace( $base, $static, $content );
			$content = str_replace( $escaped_in, $escaped_to, $content );

			$base_without_slash = untrailingslashit( $base );

			if ( $base_without_slash !== $base ) {
				$pattern         = '#' . preg_quote( $base_without_slash, '#' ) . '(?=([\'"\s<)]|$))#';
				$escaped_pattern = '#' . preg_quote( str_replace( '/', '\\/', $base_without_slash ), '#' ) . '(?=([\'"\s<)]|$))#';

				$content = preg_replace( $pattern, $static, $content );
				$content = preg_replace( $escaped_pattern, $escaped_to, $content );
			}
		}

		$replacement_base = $this->replacement_base_for_path( dirname( $target_path ) );
		$content          = preg_replace( '#(?<=[("=\'\s])/(wp-content|wp-includes)/#', $replacement_base . '$1/', $content );
		$content          = preg_replace( '#(?<=[("=\'\s])\\\/(wp-content|wp-includes)\\\/#', str_replace( '/', '\\/', $replacement_base ) . '$1\\/', $content );

		return $content;
	}

	/**
	 * Return the replacement URL base for a file directory.
	 *
	 * @param string $relative_dir Relative file directory.
	 * @return string
	 */
	private function replacement_base_for_path( $relative_dir ) {
		if ( 'absolute' === $this->url_mode ) {
			return trailingslashit( home_url( '/' ) );
		}

		if ( 'root' === $this->url_mode ) {
			return '/';
		}

		$relative_dir = trim( wp_normalize_path( $relative_dir ), './' );

		if ( '' === $relative_dir ) {
			return './';
		}

		return str_repeat( '../', count( array_filter( explode( '/', $relative_dir ) ) ) );
	}

	/**
	 * Sanitize a relative file path.
	 *
	 * @param string $path Relative path.
	 * @return string
	 */
	private function sanitize_relative_path( $path ) {
		$path     = wp_normalize_path( $path );
		$segments = array();

		foreach ( explode( '/', $path ) as $segment ) {
			if ( '' === $segment || '.' === $segment || '..' === $segment ) {
				continue;
			}

			$segment = preg_replace( '/[^A-Za-z0-9._~-]+/', '-', rawurldecode( $segment ) );
			$segment = trim( $segment, ". \t\n\r\0\x0B" );

			if ( '' !== $segment ) {
				$segments[] = $segment;
			}
		}

		return implode( '/', $segments );
	}
}
