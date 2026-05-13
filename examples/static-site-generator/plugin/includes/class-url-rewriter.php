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
		$html = $this->rewrite_srcdoc_attributes( $html, $page_url, $target_path );
		$html = $this->rewrite_meta_refresh( $html, $page_url, $target_path );
		$html = $this->rewrite_meta_content_urls( $html, $page_url, $target_path );
		$html = $this->rewrite_css_in_style_blocks( $html, $page_url, $target_path );
		$html = $this->rewrite_css_in_style_attributes( $html, $page_url, $target_path );
		$html = $this->rewrite_same_site_text_urls_preserving_resource_hints(
			$html,
			$target_path
		);

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
		$rewritten = $this->rewrite_text_asset_with_assets( $content, $relative_path );

		return $rewritten['content'];
	}

	/**
	 * Rewrite URLs in a copied text asset and report discovered asset URLs.
	 *
	 * @param string $content       File content.
	 * @param string $relative_path Relative static file path.
	 * @return array{content:string,links:string[],assets:string[]}
	 */
	public function rewrite_text_asset_with_assets( $content, $relative_path ) {
		$this->links  = array();
		$this->assets = array();

		$extension = strtolower( pathinfo( $relative_path, PATHINFO_EXTENSION ) );
		$content   = (string) $content;
		$base_url  = $this->asset_base_url_for_path( $relative_path );

		if ( 'css' === $extension ) {
			$content = $this->rewrite_css_urls( $content, $base_url, $relative_path );
		} elseif ( in_array( $extension, array( 'html', 'svg' ), true ) ) {
			$content = $this->rewrite_html_attributes( $content, $base_url, $relative_path );
			$content = $this->rewrite_srcdoc_attributes( $content, $base_url, $relative_path );
			$content = $this->rewrite_meta_refresh( $content, $base_url, $relative_path );
			$content = $this->rewrite_meta_content_urls( $content, $base_url, $relative_path );
			$content = $this->rewrite_css_in_style_blocks( $content, $base_url, $relative_path );
			$content = $this->rewrite_css_in_style_attributes( $content, $base_url, $relative_path );
		}

		$content = $this->rewrite_relative_asset_text_urls( $content, $base_url, $relative_path, false );
		$content = $this->rewrite_relative_asset_text_urls( $content, $base_url, $relative_path, true );
		$content = $this->rewrite_same_site_text_urls_preserving_resource_hints(
			$content,
			$relative_path
		);

		return array(
			'content' => $content,
			'links'   => array_values( $this->links ),
			'assets'  => array_values( $this->assets ),
		);
	}

	/**
	 * Get the public source URL for a copied text asset.
	 *
	 * @param string $relative_path Relative static file path.
	 * @return string Asset URL.
	 */
	private function asset_base_url_for_path( $relative_path ) {
		return home_url( '/' . ltrim( wp_normalize_path( $relative_path ), '/' ) );
	}

	/**
	 * Rewrite text URLs while preserving origin-only resource hints.
	 *
	 * @param string $content     File content.
	 * @param string $target_path Relative static file path.
	 * @return string Rewritten content.
	 */
	private function rewrite_same_site_text_urls_preserving_resource_hints( $content, $target_path ) {
		$placeholders = array();
		$content      = $this->preserve_resource_hint_link_urls( $content, $placeholders );
		$content      = $this->rewrite_same_site_text_urls( $content, $target_path );

		return strtr( $content, $placeholders );
	}

	/**
	 * Replace preconnect and DNS prefetch href values with temporary placeholders.
	 *
	 * @param string $html         HTML content.
	 * @param array  $placeholders Placeholder replacements.
	 * @return string HTML with placeholders.
	 */
	private function preserve_resource_hint_link_urls( $html, array &$placeholders ) {
		return preg_replace_callback(
			'/<link\b[^>]*>/i',
			function ( $matches ) use ( &$placeholders ) {
				$tag        = $matches[0];
				$attributes = $this->parse_html_tag_attributes( $tag );

				if ( empty( $attributes['rel']['value'] ) || empty( $attributes['href']['value'] ) ) {
					return $tag;
				}

				if ( ! preg_match( '/\b(dns-prefetch|preconnect)\b/i', $attributes['rel']['value'] ) ) {
					return $tag;
				}

				$placeholder = '#__SSGWP_PRESERVED_RESOURCE_HINT_'
					. count( $placeholders ) . '__';
				$placeholders[ $placeholder ] = $attributes['href']['value'];

				return $this->replace_html_tag_attribute( $tag, $attributes['href'], $placeholder );
			},
			$html
		);
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

		$global_attribute_kinds = array(
			'data-bg'          => 'asset',
			'data-background'  => 'asset',
			'data-bgset'       => 'srcset',
			'data-full-url'    => 'asset',
			'data-lazy-src'    => 'asset',
			'data-lazy-srcset' => 'srcset',
			'data-original'    => 'asset',
			'data-poster'      => 'asset',
			'data-src'         => 'asset',
			'data-srcset'      => 'srcset',
			'data-thumb'       => 'asset',
			'data-thumbnail'   => 'asset',
		);
		$attributes_by_tag      = array(
			'A'          => array( 'href' => 'page' ),
			'AREA'       => array( 'href' => 'page' ),
			'AUDIO'      => array( 'src' => 'asset' ),
			'BASE'       => array( 'href' => 'base' ),
			'BLOCKQUOTE' => array( 'cite' => 'page' ),
			'BODY'       => array( 'background' => 'asset' ),
			'BUTTON'     => array( 'formaction' => 'page' ),
			'DEL'        => array( 'cite' => 'page' ),
			'EMBED'      => array(
				'data-lazy-src' => 'maybe',
				'data-src'      => 'maybe',
				'src'           => 'maybe',
			),
			'FEIMAGE'    => array(
				'href'       => 'asset',
				'xlink:href' => 'asset',
			),
			'FORM'       => array( 'action' => 'page' ),
			'HTML'       => array(
				'background' => 'asset',
				'manifest'   => 'asset',
			),
			'IFRAME'     => array(
				'data-lazy-src' => 'maybe',
				'data-src'      => 'maybe',
				'src'           => 'maybe',
			),
			'IMG'        => array(
				'poster' => 'asset',
				'src'    => 'asset',
				'srcset' => 'srcset',
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
			'LINK'       => array(
				'href'        => 'link',
				'imagesrcset' => 'srcset',
			),
			'OBJECT'     => array(
				'data'          => 'maybe',
				'data-lazy-src' => 'maybe',
				'data-src'      => 'maybe',
			),
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

		$processor    = new WP_HTML_Tag_Processor( $html );
		$changed      = false;
		$placeholders = array();

		while ( $processor->next_tag() ) {
			$tag_name = $processor->get_tag();

			$attributes = $global_attribute_kinds;

			if ( isset( $attributes_by_tag[ $tag_name ] ) ) {
				$attributes = array_merge( $attributes, $attributes_by_tag[ $tag_name ] );
			}

			if ( empty( $attributes ) ) {
				continue;
			}

			foreach ( $attributes as $attribute => $kind ) {
				$value = $processor->get_attribute( $attribute );

				if ( ! is_string( $value ) || '' === $value ) {
					continue;
				}

				if ( 'link' === $kind ) {
					$kind = $this->link_attribute_kind( $processor );

					if ( null === $kind ) {
						continue;
					}
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

		return $changed ? strtr( $processor->get_updated_html(), $placeholders ) : $html;
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
		$placeholders = array();
		$html         = $this->preserve_resource_hint_link_urls( $html, $placeholders );
		$html         = $this->rewrite_base_href_with_patterns(
			$html,
			$base_url,
			$target_path,
			$placeholders
		);
		$html         = $this->rewrite_embedded_page_sources_with_patterns(
			$html,
			$base_url,
			$target_path,
			$placeholders
		);

		$attribute_kinds = array(
			'href'             => 'maybe',
			'src'              => 'asset',
			'srcset'           => 'srcset',
			'poster'           => 'asset',
			'action'           => 'page',
			'formaction'       => 'page',
			'data'             => 'maybe',
			'cite'             => 'page',
			'manifest'         => 'asset',
			'background'       => 'asset',
			'data-src'         => 'asset',
			'data-srcset'      => 'srcset',
			'data-lazy-src'    => 'asset',
			'data-lazy-srcset' => 'srcset',
			'data-bg'          => 'asset',
			'data-background'  => 'asset',
			'data-bgset'       => 'srcset',
			'data-full-url'    => 'asset',
			'data-original'    => 'asset',
			'data-poster'      => 'asset',
			'data-thumb'       => 'asset',
			'data-thumbnail'   => 'asset',
			'imagesrcset'      => 'srcset',
			'xlink:href'       => 'asset',
		);

		foreach ( $attribute_kinds as $attribute => $kind ) {
			$pattern = '/(\s' . preg_quote( $attribute, '/' )
				. '\s*=\s*)(?:(["\'])(.*?)\2|([^\s"\'<>`]+))/is';
			$html    = preg_replace_callback(
				$pattern,
				function ( $matches ) use ( $base_url, $target_path, $kind ) {
					$value = $this->html_attribute_match_value( $matches );

					if ( 'srcset' === $kind ) {
						$rewritten = $this->rewrite_srcset( $value, $base_url, $target_path );
					} else {
						$rewritten = $this->rewrite_url_value( $value, $base_url, $target_path, $kind );
					}

					if ( '' !== $matches[2] ) {
						return $matches[1] . $matches[2] . esc_attr( $rewritten ) . $matches[2];
					}

					return $matches[1] . esc_attr( $rewritten );
				},
				$html
			);
		}

		return strtr( $html, $placeholders );
	}

	/**
	 * Rewrite same-site base hrefs before the generic href fallback pass.
	 *
	 * @param string $html         HTML.
	 * @param string $base_url     Base URL.
	 * @param string $target_path  Relative static file path.
	 * @param array  $placeholders Placeholder replacements.
	 * @return string HTML with same-site base hrefs temporarily preserved.
	 */
	private function rewrite_base_href_with_patterns(
		$html,
		$base_url,
		$target_path,
		array &$placeholders
	) {
		return preg_replace_callback(
			'/<base\b[^>]*>/is',
			function ( $matches ) use ( $base_url, $target_path, &$placeholders ) {
				$tag        = $matches[0];
				$attributes = $this->parse_html_tag_attributes( $tag );

				if ( empty( $attributes['href']['value'] ) ) {
					return $tag;
				}

				$attribute = $attributes['href'];
				$rewritten = $this->rewrite_url_value(
					$attribute['value'],
					$base_url,
					$target_path,
					'base'
				);

				if ( $rewritten === $attribute['value'] ) {
					return $tag;
				}

				$placeholder                  = '#__SSGWP_BASE_HREF_'
					. count( $placeholders ) . '__';
				$placeholders[ $placeholder ] = $rewritten;

				return $this->replace_html_tag_attribute( $tag, $attribute, $placeholder );
			},
			$html
		);
	}

	/**
	 * Rewrite iframe, embed, and object sources as page-or-asset URLs.
	 *
	 * @param string $html         HTML.
	 * @param string $base_url     Base URL.
	 * @param string $target_path  Relative static file path.
	 * @param array  $placeholders Placeholder replacements.
	 * @return string HTML with embed sources temporarily preserved.
	 */
	private function rewrite_embedded_page_sources_with_patterns(
		$html,
		$base_url,
		$target_path,
		array &$placeholders
	) {
		return preg_replace_callback(
			'/<(iframe|embed|object)\b[^>]*>/is',
			function ( $matches ) use ( $base_url, $target_path, &$placeholders ) {
				$tag             = $matches[0];
				$tag_name        = strtolower( $matches[1] );
				$attribute_names = array( 'data-src', 'data-lazy-src' );

				if ( 'object' === $tag_name ) {
					array_unshift( $attribute_names, 'data' );
				} else {
					array_unshift( $attribute_names, 'src' );
				}

				foreach ( $attribute_names as $attribute_name ) {
					$attributes = $this->parse_html_tag_attributes( $tag );

					if ( empty( $attributes[ $attribute_name ]['value'] ) ) {
						continue;
					}

					$attribute = $attributes[ $attribute_name ];
					$rewritten = $this->rewrite_url_value(
						$attribute['value'],
						$base_url,
						$target_path,
						'maybe'
					);

					if ( $rewritten === $attribute['value'] ) {
						continue;
					}

					$placeholder                  = '#__SSGWP_EMBEDDED_PAGE_SOURCE_'
						. count( $placeholders ) . '__';
					$placeholders[ $placeholder ] = $rewritten;
					$tag                          = $this->replace_html_tag_attribute(
						$tag,
						$attribute,
						$placeholder
					);
				}

				return $tag;
			},
			$html
		);
	}

	/**
	 * Rewrite URLs inside iframe srcdoc documents.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string HTML with rewritten srcdoc attributes.
	 */
	private function rewrite_srcdoc_attributes( $html, $base_url, $target_path ) {
		if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			return $this->rewrite_srcdoc_attributes_with_patterns( $html, $base_url, $target_path );
		}

		$processor = new WP_HTML_Tag_Processor( $html );
		$changed   = false;

		while ( $processor->next_tag( 'IFRAME' ) ) {
			$srcdoc = $processor->get_attribute( 'srcdoc' );

			if ( ! is_string( $srcdoc ) || '' === $srcdoc ) {
				continue;
			}

			$rewritten = $this->rewrite_srcdoc_html( $srcdoc, $base_url, $target_path );

			if ( $rewritten !== $srcdoc ) {
				$processor->set_attribute( 'srcdoc', $rewritten );
				$changed = true;
			}
		}

		return $changed ? $processor->get_updated_html() : $html;
	}

	/**
	 * Rewrite URLs inside iframe srcdoc attributes without the HTML API.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string HTML with rewritten srcdoc attributes.
	 */
	private function rewrite_srcdoc_attributes_with_patterns( $html, $base_url, $target_path ) {
		return preg_replace_callback(
			'/<iframe\b[^>]*>/is',
			function ( $matches ) use ( $base_url, $target_path ) {
				$tag        = $matches[0];
				$attributes = $this->parse_html_tag_attributes( $tag );

				if ( empty( $attributes['srcdoc']['value'] ) ) {
					return $tag;
				}

				$rewritten = $this->rewrite_srcdoc_html(
					$attributes['srcdoc']['value'],
					$base_url,
					$target_path
				);

				if ( $rewritten === $attributes['srcdoc']['value'] ) {
					return $tag;
				}

				return $this->replace_html_tag_attribute( $tag, $attributes['srcdoc'], $rewritten );
			},
			$html
		);
	}

	/**
	 * Rewrite a srcdoc HTML fragment.
	 *
	 * @param string $srcdoc      srcdoc HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string Rewritten srcdoc HTML.
	 */
	private function rewrite_srcdoc_html( $srcdoc, $base_url, $target_path ) {
		$srcdoc = html_entity_decode( (string) $srcdoc, ENT_QUOTES );
		$srcdoc = $this->rewrite_html_attributes( $srcdoc, $base_url, $target_path );
		$srcdoc = $this->rewrite_srcdoc_attributes( $srcdoc, $base_url, $target_path );
		$srcdoc = $this->rewrite_meta_refresh( $srcdoc, $base_url, $target_path );
		$srcdoc = $this->rewrite_meta_content_urls( $srcdoc, $base_url, $target_path );
		$srcdoc = $this->rewrite_css_in_style_blocks( $srcdoc, $base_url, $target_path );
		$srcdoc = $this->rewrite_css_in_style_attributes( $srcdoc, $base_url, $target_path );

		return $this->rewrite_same_site_text_urls_preserving_resource_hints(
			$srcdoc,
			$target_path
		);
	}

	/**
	 * Determine how to treat a link element href.
	 *
	 * @param WP_HTML_Tag_Processor $processor HTML processor.
	 * @return string|null URL kind, or null when the link should not be rewritten.
	 */
	private function link_attribute_kind( $processor ) {
		$rel  = strtolower( (string) $processor->get_attribute( 'rel' ) );
		$as   = strtolower( (string) $processor->get_attribute( 'as' ) );
		$type = strtolower( (string) $processor->get_attribute( 'type' ) );
		$page_rel_pattern = '/\b('
			. 'alternate|appendix|archives|author|bookmark|canonical|chapter|contents|help|home|index|'
			. 'license|next|prev|privacy-policy|search|section|shortlink|start|subsection|tag|'
			. 'terms-of-service'
			. ')\b/';
		$asset_as_values  = array(
			'audio',
			'font',
			'image',
			'manifest',
			'script',
			'style',
			'track',
			'video',
			'worker',
		);

		if ( preg_match( '/\b(dns-prefetch|preconnect)\b/', $rel ) ) {
			return null;
		}

		if ( preg_match( '/\b(prefetch|prerender)\b/', $rel ) ) {
			if (
				in_array( $as, $asset_as_values, true )
				|| preg_match( '#/(css|javascript|json|xml|rss|atom)#', $type )
			) {
				return 'asset';
			}

			return 'maybe';
		}

		if (
			preg_match( $page_rel_pattern, $rel )
			&& ! preg_match( '#/(css|javascript|json|xml|rss|atom)#', $type )
		) {
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
		$candidates = $this->split_srcset_candidates( $srcset );
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
	 * Split a srcset into candidates without splitting inside data URLs.
	 *
	 * @param string $srcset Srcset attribute value.
	 * @return string[] Srcset candidates.
	 */
	private function split_srcset_candidates( $srcset ) {
		$candidates      = array();
		$candidate       = '';
		$length          = strlen( (string) $srcset );
		$url_started     = false;
		$url_finished    = false;
		$data_url_prefix = false;

		for ( $index = 0; $index < $length; $index++ ) {
			$char = $srcset[ $index ];

			if ( ! $url_started && ! ctype_space( $char ) ) {
				$url_started     = true;
				$data_url_prefix = 0 === stripos( substr( $srcset, $index, 5 ), 'data:' );
			}

			if ( $url_started && ! $url_finished && ctype_space( $char ) ) {
				$url_finished = true;
			}

			if (
				',' === $char
				&& (
					! $data_url_prefix
					|| $url_finished
					|| $this->is_srcset_separator_after_data_url( $srcset, $index )
				)
			) {
				$candidates[] = trim( $candidate );
				$candidate       = '';
				$url_started     = false;
				$url_finished    = false;
				$data_url_prefix = false;
				continue;
			}

			$candidate .= $char;
		}

		if ( '' !== trim( $candidate ) ) {
			$candidates[] = trim( $candidate );
		}

		return $candidates;
	}

	/**
	 * Determine whether a comma after a data URL starts the next candidate.
	 *
	 * @param string $srcset Srcset attribute value.
	 * @param int    $index  Current comma index.
	 * @return bool Whether the comma separates srcset candidates.
	 */
	private function is_srcset_separator_after_data_url( $srcset, $index ) {
		return isset( $srcset[ $index + 1 ] ) && ctype_space( $srcset[ $index + 1 ] );
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
			return $this->rewrite_meta_refresh_with_patterns( $html, $base_url, $target_path );
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
	 * Rewrite meta refresh URLs without the HTML API.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_meta_refresh_with_patterns( $html, $base_url, $target_path ) {
		return preg_replace_callback(
			'/<meta\b[^>]*>/is',
			function ( $matches ) use ( $base_url, $target_path ) {
				$tag        = $matches[0];
				$attributes = $this->parse_html_tag_attributes( $tag );
				$http_equiv = isset( $attributes['http-equiv'] )
					? strtolower( $attributes['http-equiv']['value'] )
					: '';

				if (
					'refresh' !== $http_equiv
					|| empty( $attributes['content']['value'] )
					|| false === stripos( $attributes['content']['value'], 'url=' )
				) {
					return $tag;
				}

				$rewritten = $this->rewrite_meta_refresh_content(
					$attributes['content']['value'],
					$base_url,
					$target_path
				);

				if ( $rewritten === $attributes['content']['value'] ) {
					return $tag;
				}

				return $this->replace_html_tag_attribute( $tag, $attributes['content'], $rewritten );
			},
			$html
		);
	}

	/**
	 * Rewrite a meta refresh content value.
	 *
	 * @param string $content     Meta refresh content value.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_meta_refresh_content( $content, $base_url, $target_path ) {
		return preg_replace_callback(
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
	}

	/**
	 * Rewrite URLs in social and structured-data meta content attributes.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_meta_content_urls( $html, $base_url, $target_path ) {
		if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			return $this->rewrite_meta_content_urls_with_patterns( $html, $base_url, $target_path );
		}

		$processor    = new WP_HTML_Tag_Processor( $html );
		$changed      = false;
		$placeholders = array();

		while ( $processor->next_tag( 'META' ) ) {
			$kind = $this->meta_content_url_kind( $processor );

			if ( null === $kind ) {
				continue;
			}

			$content = $processor->get_attribute( 'content' );

			if ( ! is_string( $content ) || '' === $content ) {
				continue;
			}

			$rewritten = $this->rewrite_url_value( $content, $base_url, $target_path, $kind );

			if ( $rewritten !== $content ) {
				$processor->set_attribute(
					'content',
					$this->prepare_html_attribute_value( $rewritten, $placeholders )
				);
				$changed = true;
			}
		}

		return $changed ? strtr( $processor->get_updated_html(), $placeholders ) : $html;
	}

	/**
	 * Rewrite social and structured-data meta URLs without the HTML API.
	 *
	 * @param string $html        HTML.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string
	 */
	private function rewrite_meta_content_urls_with_patterns( $html, $base_url, $target_path ) {
		return preg_replace_callback(
			'/<meta\b[^>]*>/is',
			function ( $matches ) use ( $base_url, $target_path ) {
				$tag        = $matches[0];
				$attributes = $this->parse_html_tag_attributes( $tag );
				$kind       = $this->meta_attribute_url_kind(
					isset( $attributes['property']['value'] ) ? $attributes['property']['value'] : '',
					isset( $attributes['name']['value'] ) ? $attributes['name']['value'] : '',
					isset( $attributes['itemprop']['value'] ) ? $attributes['itemprop']['value'] : ''
				);

				if ( null === $kind || empty( $attributes['content']['value'] ) ) {
					return $tag;
				}

				$rewritten = $this->rewrite_url_value(
					$attributes['content']['value'],
					$base_url,
					$target_path,
					$kind
				);

				if ( $rewritten === $attributes['content']['value'] ) {
					return $tag;
				}

				return $this->replace_html_tag_attribute( $tag, $attributes['content'], $rewritten );
			},
			$html
		);
	}

	/**
	 * Determine whether a meta content attribute contains a page or asset URL.
	 *
	 * @param WP_HTML_Tag_Processor $processor HTML processor.
	 * @return string|null URL kind: page, asset, browserconfig, or null.
	 */
	private function meta_content_url_kind( $processor ) {
		return $this->meta_attribute_url_kind(
			(string) $processor->get_attribute( 'property' ),
			(string) $processor->get_attribute( 'name' ),
			(string) $processor->get_attribute( 'itemprop' )
		);
	}

	/**
	 * Determine whether meta attributes identify a page or asset URL.
	 *
	 * @param string $property Meta property attribute.
	 * @param string $name     Meta name attribute.
	 * @param string $itemprop Meta itemprop attribute.
	 * @return string|null URL kind: page, asset, browserconfig, or null.
	 */
	private function meta_attribute_url_kind( $property, $name, $itemprop ) {
		$property = strtolower( (string) $property );
		$name     = strtolower( (string) $name );
		$itemprop = strtolower( (string) $itemprop );

		$page_keys = array(
			'article:author',
			'article:publisher',
			'embedurl',
			'og:see_also',
			'og:url',
			'twitter:player',
			'twitter:url',
			'url',
			'mainentityofpage',
		);

		$browser_config_keys = array(
			'msapplication-config',
		);

		$asset_keys = array(
			'contenturl',
			'image',
			'logo',
			'msapplication-square150x150logo',
			'msapplication-square310x310logo',
			'msapplication-square70x70logo',
			'msapplication-tileimage',
			'msapplication-wide310x150logo',
			'og:audio',
			'og:audio:secure_url',
			'og:audio:url',
			'og:image',
			'og:image:secure_url',
			'og:image:url',
			'og:video',
			'og:video:secure_url',
			'og:video:url',
			'thumbnail',
			'thumbnailurl',
			'twitter:image',
			'twitter:image:src',
			'twitter:player:stream',
		);

		foreach ( array( $property, $name, $itemprop ) as $key ) {
			if ( in_array( $key, $page_keys, true ) ) {
				return 'page';
			}

			if ( in_array( $key, $browser_config_keys, true ) ) {
				return 'browserconfig';
			}

			if ( in_array( $key, $asset_keys, true ) ) {
				return 'asset';
			}
		}

		return null;
	}

	/**
	 * Parse quoted attributes from an HTML tag.
	 *
	 * @param string $tag HTML tag.
	 * @return array<string,array{value:string,offset:int,length:int}>
	 */
	private function parse_html_tag_attributes( $tag ) {
		$attributes = array();

		preg_match_all(
			'/([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(?:(["\'])(.*?)\2|([^\s"\'<>`]+))/s',
			$tag,
			$matches,
			PREG_OFFSET_CAPTURE
		);

		foreach ( $matches[1] as $index => $name_match ) {
			$key         = strtolower( $name_match[0] );
			$value_match = '' !== $matches[2][ $index ][0]
				? $matches[3][ $index ]
				: $matches[4][ $index ];

			$attributes[ $key ] = array(
				'value'  => $value_match[0],
				'offset' => $value_match[1],
				'length' => strlen( $value_match[0] ),
			);
		}

		return $attributes;
	}

	/**
	 * Return the value captured by a quoted-or-unquoted HTML attribute regex.
	 *
	 * @param array $matches Regex matches.
	 * @return string Attribute value.
	 */
	private function html_attribute_match_value( array $matches ) {
		return '' !== $matches[2] ? $matches[3] : $matches[4];
	}

	/**
	 * Replace a quoted or unquoted attribute value in a tag.
	 *
	 * @param string $tag       HTML tag.
	 * @param array  $attribute Parsed attribute.
	 * @param string $value     Replacement value.
	 * @return string Updated tag.
	 */
	private function replace_html_tag_attribute( $tag, array $attribute, $value ) {
		return substr_replace(
			$tag,
			esc_attr( $value ),
			$attribute['offset'],
			$attribute['length']
		);
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
		if ( 'relative' !== $this->url_mode || preg_match( '~^(?:[a-z][a-z0-9+.-]*:|/|#|\?)~i', $value ) ) {
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
			'/(\sstyle\s*=\s*)(?:(["\'])(.*?)\2|([^\s"\'<>`]+))/is',
			function ( $matches ) use ( $base_url, $target_path ) {
				$value     = html_entity_decode( $this->html_attribute_match_value( $matches ), ENT_QUOTES );
				$rewritten = esc_attr( $this->rewrite_css_urls( $value, $base_url, $target_path ) );

				if ( '' !== $matches[2] ) {
					return $matches[1] . $matches[2] . $rewritten . $matches[2];
				}

				return $matches[1] . $rewritten;
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
		$css = $this->rewrite_css_image_set_string_urls( $css, $base_url, $target_path );

		return preg_replace_callback(
			'/@import\s+([\'"])(.*?)\1/i',
			function ( $matches ) use ( $base_url, $target_path ) {
				return '@import ' . $matches[1] . $this->rewrite_url_value( $matches[2], $base_url, $target_path, 'asset' ) . $matches[1];
			},
			$css
		);
	}

	/**
	 * Rewrite quoted image candidates inside CSS image-set() functions.
	 *
	 * @param string $css         CSS.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string CSS with rewritten image-set string URLs.
	 */
	private function rewrite_css_image_set_string_urls( $css, $base_url, $target_path ) {
		$output = '';
		$offset = 0;

		while (
			preg_match(
				'/(?:-webkit-)?image-set\s*\(/i',
				$css,
				$match,
				PREG_OFFSET_CAPTURE,
				$offset
			)
		) {
			$start      = $match[0][1];
			$open_index = $start + strlen( $match[0][0] ) - 1;
			$end_index  = $this->find_matching_css_parenthesis( $css, $open_index );

			if ( null === $end_index ) {
				break;
			}

			$output .= substr( $css, $offset, $open_index + 1 - $offset );
			$output .= $this->rewrite_css_image_set_inner_string_urls(
				substr( $css, $open_index + 1, $end_index - $open_index - 1 ),
				$base_url,
				$target_path
			);
			$output .= ')';
			$offset  = $end_index + 1;
		}

		return $output . substr( $css, $offset );
	}

	/**
	 * Find the matching closing parenthesis for a CSS function.
	 *
	 * @param string $css        CSS.
	 * @param int    $open_index Opening parenthesis offset.
	 * @return int|null Closing parenthesis offset, or null.
	 */
	private function find_matching_css_parenthesis( $css, $open_index ) {
		$depth  = 1;
		$quote  = '';
		$length = strlen( $css );

		for ( $index = $open_index + 1; $index < $length; $index++ ) {
			$char = $css[ $index ];

			if ( '' !== $quote ) {
				if ( '\\' === $char ) {
					++$index;
					continue;
				}

				if ( $char === $quote ) {
					$quote = '';
				}

				continue;
			}

			if ( '"' === $char || "'" === $char ) {
				$quote = $char;
				continue;
			}

			if ( '(' === $char ) {
				++$depth;
				continue;
			}

			if ( ')' === $char ) {
				--$depth;

				if ( 0 === $depth ) {
					return $index;
				}
			}
		}

		return null;
	}

	/**
	 * Rewrite quoted URL strings inside a CSS image-set() body.
	 *
	 * @param string $inner       CSS inside image-set(...).
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @return string Rewritten image-set body.
	 */
	private function rewrite_css_image_set_inner_string_urls( $inner, $base_url, $target_path ) {
		$output = '';
		$offset = 0;
		$length = strlen( $inner );

		while ( $offset < $length ) {
			$quote_index = strcspn( $inner, '"\'', $offset );

			if ( $offset + $quote_index >= $length ) {
				break;
			}

			$quote_index += $offset;
			$quote        = $inner[ $quote_index ];
			$end_index    = $quote_index + 1;

			while ( $end_index < $length ) {
				if ( '\\' === $inner[ $end_index ] ) {
					$end_index += 2;
					continue;
				}

				if ( $quote === $inner[ $end_index ] ) {
					break;
				}

				++$end_index;
			}

			if ( $end_index >= $length ) {
				break;
			}

			$value  = substr( $inner, $quote_index + 1, $end_index - $quote_index - 1 );
			$output .= substr( $inner, $offset, $quote_index - $offset ) . $quote;

			if (
				$this->is_css_image_set_url_string( $value )
				&& ! $this->is_nested_css_function_string( $inner, $quote_index )
			) {
				$output .= $this->rewrite_url_value( $value, $base_url, $target_path, 'asset' );
			} else {
				$output .= $value;
			}

			$output .= $quote;
			$offset  = $end_index + 1;
		}

		return $output . substr( $inner, $offset );
	}

	/**
	 * Determine whether a quoted image-set() string should be treated as a URL.
	 *
	 * @param string $value Quoted string value.
	 * @return bool Whether the value looks like an image URL.
	 */
	private function is_css_image_set_url_string( $value ) {
		$value = trim( $value );

		if ( '' === $value || $this->is_special_url( $value ) || preg_match( '/[*{}]/', $value ) ) {
			return false;
		}

		if ( preg_match( '#^(?:[a-z][a-z0-9+.-]*:|//|/|\./|\../)#i', $value ) ) {
			return true;
		}

		$path     = (string) wp_parse_url( $value, PHP_URL_PATH );
		$basename = basename( $path );

		return (bool) preg_match( '/\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i', $basename );
	}

	/**
	 * Check whether a quoted string belongs to another CSS function.
	 *
	 * @param string $inner       CSS inside image-set(...).
	 * @param int    $quote_index Opening quote offset.
	 * @return bool Whether the string is inside url() or type().
	 */
	private function is_nested_css_function_string( $inner, $quote_index ) {
		$prefix = rtrim( substr( $inner, 0, $quote_index ) );

		return (bool) preg_match( '/(?:url|type)\s*\($/i', $prefix );
	}

	/**
	 * Rewrite one URL value.
	 *
	 * @param string $value       URL value.
	 * @param string $base_url    Base URL.
	 * @param string $target_path Relative static file path.
	 * @param string $kind        URL kind: page, asset, maybe, base, browserconfig.
	 * @return string
	 */
	private function rewrite_url_value( $value, $base_url, $target_path, $kind ) {
		$value = html_entity_decode( trim( (string) $value ), ENT_QUOTES );

		if ( '' === $value || $this->is_special_url( $value ) ) {
			return $value;
		}

		if ( 'browserconfig' === $kind ) {
			if ( 'none' === strtolower( $value ) ) {
				return $value;
			}

			$kind = 'asset';
		}

		$absolute = $this->collector->resolve_relative_url( $value, $base_url );
		$absolute = $this->normalize_absolute_url_path( $absolute );

		if ( ! $this->is_same_site_url( $absolute ) ) {
			return $value;
		}

		if ( $this->is_non_exportable_same_site_url( $absolute ) ) {
			return $value;
		}

		$is_page_like = $this->is_page_like_url( $absolute );

		if ( ! $this->is_exportable_same_site_path( $absolute, $kind, $is_page_like ) ) {
			return $value;
		}

		if ( 'base' === $kind ) {
			return $this->static_document_base_for_path( $target_path );
		}

		if ( 'maybe' === $kind ) {
			$kind = $is_page_like ? 'page' : 'asset';
		}

		$static_url = $absolute;

		if ( 'page' === $kind && $is_page_like ) {
			$normalized = $this->collector->normalize_url( $absolute );

			if ( null === $normalized ) {
				return $value;
			}

			$this->links[ $normalized ] = $normalized;
			$static_url                 = $this->restore_fragment( $normalized, $absolute );
		} elseif ( 'page' === $kind ) {
			$this->assets[ $absolute ] = $absolute;
			$kind                      = 'asset';
		} elseif ( 'asset' === $kind ) {
			$this->assets[ $absolute ] = $absolute;
		}

		return $this->url_to_static_url( $static_url, $target_path, $kind );
	}

	/**
	 * Return a base href that keeps relative URLs anchored to the exported file.
	 *
	 * @param string $target_path Relative static file path.
	 * @return string Static document base href.
	 */
	private function static_document_base_for_path( $target_path ) {
		$target_dir = dirname( wp_normalize_path( $target_path ) );
		$target_dir = '.' === $target_dir ? '' : trim( $target_dir, '/' );

		if ( 'absolute' === $this->url_mode ) {
			return trailingslashit( home_url( '/' . $target_dir ) );
		}

		if ( 'root' === $this->url_mode ) {
			return '' === $target_dir ? '/' : '/' . trailingslashit( $target_dir );
		}

		return './';
	}

	/**
	 * Normalize dot segments in an absolute URL path.
	 *
	 * @param string $url URL.
	 * @return string URL with normalized path segments.
	 */
	private function normalize_absolute_url_path( $url ) {
		$parts = wp_parse_url( $url );

		if ( empty( $parts['host'] ) || ! isset( $parts['path'] ) ) {
			return $url;
		}

		$segments = array();

		foreach ( explode( '/', $parts['path'] ) as $segment ) {
			if ( '' === $segment || '.' === $segment ) {
				continue;
			}

			if ( '..' === $segment ) {
				array_pop( $segments );
				continue;
			}

			$segments[] = $segment;
		}

		$path = '/' . implode( '/', $segments );

		if ( '/' !== $path && '/' === substr( $parts['path'], -1 ) ) {
			$path = trailingslashit( $path );
		}

		$scheme   = isset( $parts['scheme'] ) ? $parts['scheme'] . '://' : '';
		$port     = isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '';
		$query    = isset( $parts['query'] ) ? '?' . $parts['query'] : '';
		$fragment = isset( $parts['fragment'] ) ? '#' . $parts['fragment'] : '';

		return $scheme . $parts['host'] . $port . $path . $query . $fragment;
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
	 * Check whether a same-site URL belongs to a dynamic WordPress endpoint.
	 *
	 * @param string $url URL.
	 * @return bool
	 */
	private function is_non_exportable_same_site_url( $url ) {
		$path = (string) wp_parse_url( $url, PHP_URL_PATH );

		if ( preg_match( '#/(wp-admin|wp-comments-post\.php|wp-cron\.php|wp-login\.php|wp-json|xmlrpc\.php)(/|$)#', $path ) ) {
			return true;
		}

		return (bool) preg_match( '#/(?:comments/)?(?:feed|rdf|rss|rss2|atom)(/|$)#', $path );
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

		$url_scheme  = isset( $url_parts['scheme'] ) ? strtolower( $url_parts['scheme'] ) : '';
		$home_scheme = isset( $home_parts['scheme'] ) ? strtolower( $home_parts['scheme'] ) : '';

		if ( $url_scheme !== $home_scheme ) {
			return false;
		}

		if ( $this->effective_url_port( $home_parts ) !== $this->effective_url_port( $url_parts ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Check whether a same-site URL path belongs to this export.
	 *
	 * @param string $url          URL.
	 * @param string $kind         URL kind: page, asset, maybe.
	 * @param bool   $is_page_like Whether the URL path looks like an HTML page.
	 * @return bool Whether the URL can be rewritten as part of this export.
	 */
	private function is_exportable_same_site_path( $url, $kind, $is_page_like ) {
		if ( ! SSGWP_Path_Utils::has_deployment_base_path() ) {
			return true;
		}

		$path = (string) wp_parse_url( $url, PHP_URL_PATH );

		if ( SSGWP_Path_Utils::is_url_path_under_deployment_base( $path ) ) {
			return true;
		}

		if ( 'page' === $kind || ( 'maybe' === $kind && $is_page_like ) ) {
			return false;
		}

		return SSGWP_Path_Utils::is_url_path_under_url_bases(
			$path,
			array(
				content_url( '/' ),
				includes_url( '/' ),
			)
		);
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
	 * Return the effective port for a parsed URL.
	 *
	 * @param array $parts Parsed URL parts.
	 * @return int|null Effective port, or null when the scheme has no default.
	 */
	private function effective_url_port( array $parts ) {
		if ( isset( $parts['port'] ) ) {
			return (int) $parts['port'];
		}

		if ( empty( $parts['scheme'] ) ) {
			return null;
		}

		$scheme = strtolower( $parts['scheme'] );

		if ( 'https' === $scheme ) {
			return 443;
		}

		if ( 'http' === $scheme ) {
			return 80;
		}

		return null;
	}

	/**
	 * Convert a same-site URL to its static export URL.
	 *
	 * @param string $url         URL.
	 * @param string $target_path Relative static file path of the referencing file.
	 * @param string $kind        URL kind: page or asset.
	 * @return string
	 */
	private function url_to_static_url( $url, $target_path, $kind = 'asset' ) {
		$parts    = wp_parse_url( $url );
		$path     = isset( $parts['path'] ) ? $parts['path'] : '/';
		$query    = isset( $parts['query'] ) ? $parts['query'] : '';
		$fragment = isset( $parts['fragment'] ) ? $parts['fragment'] : '';
		$web_path = 'page' === $kind
			? SSGWP_Path_Utils::url_to_export_file_path( $path, $query )
			: $this->url_path_to_static_web_path( $path, $query );
		$has_ext  = $this->path_has_exported_extension( $path );

		if ( 'absolute' === $this->url_mode ) {
			$output = trailingslashit( home_url( '/' ) ) . ltrim( $web_path, '/' );
		} elseif ( 'root' === $this->url_mode ) {
			$output = '' === $web_path ? '/' : '/' . ltrim( $web_path, '/' );
		} else {
			$output = $this->make_relative_url( $target_path, $web_path );
		}

		if ( 'page' !== $kind && '' !== $query && $has_ext ) {
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
		$path = SSGWP_Path_Utils::map_wordpress_asset_url_path( $path );
		$path = SSGWP_Path_Utils::remove_deployment_base_path( $path );
		$path = trim( rawurldecode( $path ), '/' );

		if ( '' === $path ) {
			$file_path = 'index.html';
			$web_path  = '';
		} elseif ( $this->path_has_exported_extension( $path ) ) {
			$sanitized_path = SSGWP_Path_Utils::sanitize_relative_path( $path );
			$file_path      = $sanitized_path;
			$web_path       = $file_path;
		} else {
			$sanitized_path = SSGWP_Path_Utils::sanitize_relative_path( $path );
			$file_path      = trailingslashit( $sanitized_path ) . 'index.html';
			$web_path       = $file_path;
		}

		if ( '' === $query || $this->path_has_exported_extension( $path ) ) {
			return $web_path;
		}

		return preg_replace( '#(?:/index)?\.html$#', '-' . substr( md5( $query ), 0, 8 ) . '.html', $file_path );
	}

	/**
	 * Determine whether a path has a file extension that should remain a file.
	 *
	 * @param string $path URL path.
	 * @return bool
	 */
	private function path_has_exported_extension( $path ) {
		$segments = explode( '/', (string) $path );
		$basename = rawurldecode( end( $segments ) );

		return (bool) preg_match( '#\.[a-z0-9]{1,12}$#i', $basename );
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
		$content = $this->rewrite_absolute_text_urls( $content, $target_path, false );
		$content = $this->rewrite_absolute_text_urls( $content, $target_path, true );
		$content = $this->rewrite_protocol_relative_text_urls( $content, $target_path, false );
		$content = $this->rewrite_protocol_relative_text_urls( $content, $target_path, true );
		$content = $this->rewrite_root_relative_text_urls( $content, $target_path, false );
		$content = $this->rewrite_root_relative_text_urls( $content, $target_path, true );
		$content = $this->rewrite_root_asset_text_urls( $content, $target_path, false );
		$content = $this->rewrite_root_asset_text_urls( $content, $target_path, true );

		return $content;
	}

	/**
	 * Rewrite relative asset URLs embedded in copied text assets.
	 *
	 * This covers text files such as web manifests where icon paths are quoted
	 * relative to the manifest file instead of root-relative or absolute.
	 *
	 * @param string $content     File content.
	 * @param string $base_url    Source URL of the copied asset.
	 * @param string $target_path Relative static file path.
	 * @param bool   $escaped     Whether slashes are JSON escaped.
	 * @return string Rewritten content.
	 */
	private function rewrite_relative_asset_text_urls( $content, $base_url, $target_path, $escaped ) {
		$extensions = 'avif|bmp|css|gif|ico|jpe?g|js|json|mjs|mp3|mp4|ogg|otf|png|svg|ttf|webm|webp|woff2?';
		$pattern    = $escaped
			? '#(?<=["\'])(?![a-z][a-z0-9+.-]*:|\\\\/)(?:(?:\\.\\\\/|\\.\\.\\\\/|[A-Za-z0-9._~-]+\\\\/)(?:[^\\\\\s\'"<>)]|\\\\/)*|[A-Za-z0-9._~-]+)\\.(?:' . $extensions . ')(?:[?\\#](?:[^\\\\\s\'"<>)]|\\\\/)*)?(?=["\'])#i'
			: '#(?<=["\'])(?![a-z][a-z0-9+.-]*:|/)(?:\\./|\\.\\./|[A-Za-z0-9._~-]+/)?[^\\s\'"<>)]*\\.(?:' . $extensions . ')(?:[?\\#][^\\s\'"<>)]*)?(?=["\'])#i';

		return preg_replace_callback(
			$pattern,
			function ( $matches ) use ( $base_url, $target_path, $escaped ) {
				$url = $escaped ? str_replace( '\\/', '/', $matches[0] ) : $matches[0];

				if ( ! $escaped && false !== strpos( $url, '\\/' ) ) {
					return $matches[0];
				}

				if ( preg_match( '#^(?:[a-z][a-z0-9+.-]*:|/)#i', $url ) ) {
					return $matches[0];
				}

				$basename = basename( (string) wp_parse_url( $url, PHP_URL_PATH ) );

				if ( '' === $basename || '.' === $basename[0] ) {
					return $matches[0];
				}

				if ( preg_match( '/[*{}]/', $url ) ) {
					return $matches[0];
				}

				$rewritten = $this->rewrite_url_value( $url, $base_url, $target_path, 'asset' );

				return $escaped ? str_replace( '/', '\\/', $rewritten ) : $rewritten;
			},
			$content
		);
	}

	/**
	 * Rewrite unstructured root-relative WordPress asset paths in text.
	 *
	 * This catches legacy strings such as CSS snippets that are not quoted like
	 * JSON values. The URL still passes through the normal exportability checks
	 * so scoped Playground exports do not claim root-level paths from another
	 * deployment.
	 *
	 * @param string $content     File content.
	 * @param string $target_path Relative static file path.
	 * @param bool   $escaped     Whether slashes are JSON escaped.
	 * @return string
	 */
	private function rewrite_root_asset_text_urls( $content, $target_path, $escaped ) {
		$pattern = $escaped
			? '#(?<=[("=\'\s])\\\\/(?:wp-content|wp-includes)\\\\/(?:[^\\\\\s\'"<>)]|\\\\/)*#i'
			: '#(?<=[("=\'\s])/(?:wp-content|wp-includes)/[^\s\'"<>)]*#i';

		return preg_replace_callback(
			$pattern,
			function ( $matches ) use ( $target_path, $escaped ) {
				$url       = $escaped ? str_replace( '\\/', '/', $matches[0] ) : $matches[0];

				if ( preg_match( '/[*{}]/', $url ) ) {
					return $matches[0];
				}

				$rewritten = $this->rewrite_url_value( $url, home_url( '/' ), $target_path, 'asset' );

				return $escaped ? str_replace( '/', '\\/', $rewritten ) : $rewritten;
			},
			$content
		);
	}

	/**
	 * Rewrite absolute same-site URLs in text-like assets.
	 *
	 * @param string $content     File content.
	 * @param string $target_path Relative static file path.
	 * @param bool   $escaped     Whether slashes are JSON escaped.
	 * @return string
	 */
	private function rewrite_absolute_text_urls( $content, $target_path, $escaped ) {
		$home_parts = wp_parse_url( home_url( '/' ) );

		if ( empty( $home_parts['host'] ) ) {
			return $content;
		}

		$scheme_pattern = isset( $home_parts['scheme'] ) ? preg_quote( $home_parts['scheme'], '#' ) : 'https?';
		$host_pattern   = preg_quote( $home_parts['host'], '#' );
		$port_pattern   = isset( $home_parts['port'] ) ? ':' . (int) $home_parts['port'] : '(?::[0-9]+)?';

		if ( $escaped ) {
			$slash   = '\\\\/';
			$pattern = '#(?<![A-Za-z0-9+.-]:)'
				. $scheme_pattern . ':' . $slash . $slash . $host_pattern
				. $port_pattern . '(?:' . $slash . '[^\\s\'"<>)]*)?#i';
		} else {
			$pattern = '#(?<![A-Za-z0-9+.-]:)'
				. $scheme_pattern . '://' . $host_pattern . $port_pattern
				. '(?:/[^\\s\'"<>)]*)?#i';
		}

		return preg_replace_callback(
			$pattern,
			function ( $matches ) use ( $target_path, $escaped ) {
				$url       = $escaped ? str_replace( '\\/', '/', $matches[0] ) : $matches[0];
				$rewritten = $this->rewrite_url_value( $url, home_url( '/' ), $target_path, 'maybe' );

				return $escaped ? str_replace( '/', '\\/', $rewritten ) : $rewritten;
			},
			$content
		);
	}

	/**
	 * Rewrite protocol-relative same-site URLs embedded in text or JSON.
	 *
	 * @param string $content     File content.
	 * @param string $target_path Relative static file path.
	 * @param bool   $escaped     Whether slashes are JSON escaped.
	 * @return string
	 */
	private function rewrite_protocol_relative_text_urls( $content, $target_path, $escaped ) {
		$home_parts = wp_parse_url( home_url( '/' ) );

		if ( empty( $home_parts['host'] ) ) {
			return $content;
		}

		$host_pattern = preg_quote( $home_parts['host'], '#' );
		$port_pattern = isset( $home_parts['port'] ) ? ':' . (int) $home_parts['port'] : '(?::[0-9]+)?';

		if ( $escaped ) {
			$slash   = '\\\\/';
			$pattern = '#(?<![A-Za-z0-9+.-]:)' . $slash . $slash . $host_pattern
				. $port_pattern . '(?:' . $slash . '[^\\s\'"<>)]*)?#i';
		} else {
			$pattern = '#(?<![A-Za-z0-9+.-]:)//' . $host_pattern . $port_pattern
				. '(?:/[^\\s\'"<>)]*)?#i';
		}

		return preg_replace_callback(
			$pattern,
			function ( $matches ) use ( $target_path, $escaped ) {
				$url       = $escaped ? str_replace( '\\/', '/', $matches[0] ) : $matches[0];
				$rewritten = $this->rewrite_url_value( $url, home_url( '/' ), $target_path, 'maybe' );

				return $escaped ? str_replace( '/', '\\/', $rewritten ) : $rewritten;
			},
			$content
		);
	}

	/**
	 * Rewrite root-relative same-site URLs embedded in text or JSON.
	 *
	 * @param string $content     File content.
	 * @param string $target_path Relative static file path.
	 * @param bool   $escaped     Whether slashes are JSON escaped.
	 * @return string
	 */
	private function rewrite_root_relative_text_urls( $content, $target_path, $escaped ) {
		$pattern = $escaped
			? '#(?<=["\'])(?:\\\\/)(?!\\\\/)(?=[A-Za-z0-9._~%:@-])(?:[^\\\\\s\'"<>)]|\\\\/)*#'
			: '#(?<=["\'])/(?!/)(?=[A-Za-z0-9._~%:@-])[^\s\'"<>)]*#';

		return preg_replace_callback(
			$pattern,
			function ( $matches ) use ( $target_path, $escaped ) {
				$url       = $escaped ? str_replace( '\\/', '/', $matches[0] ) : $matches[0];

				if ( preg_match( '/[*{}]/', $url ) ) {
					return $matches[0];
				}

				$rewritten = $this->rewrite_url_value( $url, home_url( '/' ), $target_path, 'maybe' );

				return $escaped ? str_replace( '/', '\\/', $rewritten ) : $rewritten;
			},
			$content
		);
	}

	/**
	 * Restore a fragment stripped during WordPress URL normalization.
	 *
	 * @param string $normalized Normalized URL.
	 * @param string $source     Source URL before normalization.
	 * @return string URL with the source fragment restored.
	 */
	private function restore_fragment( $normalized, $source ) {
		$fragment = wp_parse_url( $source, PHP_URL_FRAGMENT );

		if ( ! is_string( $fragment ) || '' === $fragment ) {
			return $normalized;
		}

		return strtok( $normalized, '#' ) . '#' . $fragment;
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
}
