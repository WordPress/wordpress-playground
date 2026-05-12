<?php
/**
 * Collects public WordPress URLs for export.
 *
 * @package PlaygroundStaticSiteGenerator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Discovers canonical public URLs.
 */
final class SSGWP_URL_Collector {
	/**
	 * Collect public URLs.
	 *
	 * @return string[]
	 */
	public function collect() {
		$urls = array();

		$this->add_url( $urls, home_url( '/' ) );
		$this->add_posts_index_pages( $urls );
		$this->add_posts( $urls );
		$this->add_terms( $urls );
		$this->add_author_archives( $urls );

		return array_values( $urls );
	}

	/**
	 * Add published post URLs.
	 *
	 * @param array $urls URL set.
	 */
	private function add_posts( array &$urls ) {
		$post_types = get_post_types( array( 'public' => true ), 'objects' );
		$per_page   = $this->get_posts_per_page();

		foreach ( $post_types as $post_type => $post_type_object ) {
			if ( 'attachment' === $post_type ) {
				continue;
			}

			if ( ! empty( $post_type_object->exclude_from_search ) && ! $post_type_object->has_archive ) {
				continue;
			}

			if ( ! empty( $post_type_object->has_archive ) ) {
				$archive = get_post_type_archive_link( $post_type );
				$this->add_url( $urls, $archive );
				$this->add_paginated_urls( $urls, $archive, $this->count_published_posts( $post_type ), $per_page );
			}

			$page     = 1;
			$per_page = $this->get_post_query_batch_size();

			do {
				$query = new WP_Query(
					array(
						'post_type'              => $post_type,
						'post_status'            => 'publish',
						'posts_per_page'         => $per_page,
						'paged'                  => $page,
						'fields'                 => 'ids',
						'no_found_rows'          => true,
						'update_post_meta_cache' => false,
						'update_post_term_cache' => false,
					)
				);

				foreach ( $query->posts as $post_id ) {
					$this->add_url( $urls, get_permalink( $post_id ) );
					$this->add_multipage_post_urls( $urls, $post_id );
				}

				++$page;
			} while ( count( $query->posts ) === $per_page );
		}
	}

	/**
	 * Add the posts index and its pagination.
	 *
	 * @param array $urls URL set.
	 */
	private function add_posts_index_pages( array &$urls ) {
		$post_count = $this->count_published_posts( 'post' );

		if ( 0 === $post_count ) {
			return;
		}

		$page_for_posts = (int) get_option( 'page_for_posts' );

		if ( 'page' === get_option( 'show_on_front' ) && 0 === $page_for_posts ) {
			return;
		}

		$base_url = $page_for_posts > 0 ? get_permalink( $page_for_posts ) : home_url( '/' );

		$this->add_url( $urls, $base_url );
		$this->add_paginated_urls( $urls, $base_url, $post_count, $this->get_posts_per_page() );
	}

	/**
	 * Add public taxonomy archives.
	 *
	 * @param array $urls URL set.
	 */
	private function add_terms( array &$urls ) {
		$taxonomies = get_taxonomies( array( 'public' => true ), 'names' );

		if ( empty( $taxonomies ) ) {
			return;
		}

		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomies,
				'hide_empty' => true,
			)
		);

		if ( is_wp_error( $terms ) ) {
			return;
		}

		foreach ( $terms as $term ) {
			$term_link = get_term_link( $term );

			$this->add_url( $urls, $term_link );
			$this->add_paginated_urls( $urls, $term_link, (int) $term->count, $this->get_posts_per_page() );
		}
	}

	/**
	 * Add author archive URLs for users with published posts.
	 *
	 * @param array $urls URL set.
	 */
	private function add_author_archives( array &$urls ) {
		$users = get_users(
			array(
				'has_published_posts' => true,
				'fields'              => 'ID',
			)
		);

		foreach ( $users as $user_id ) {
			$author_url = get_author_posts_url( $user_id );

			$this->add_url( $urls, $author_url );
			$this->add_paginated_urls( $urls, $author_url, $this->count_user_published_posts( $user_id ), $this->get_posts_per_page() );
		}
	}

	/**
	 * Add paginated archive URLs.
	 *
	 * @param array       $urls        URL set.
	 * @param string|bool $base_url    Base archive URL.
	 * @param int         $total_items Total items in the archive.
	 * @param int         $per_page    Items per page.
	 */
	private function add_paginated_urls( array &$urls, $base_url, $total_items, $per_page ) {
		if ( empty( $base_url ) || is_wp_error( $base_url ) ) {
			return;
		}

		$per_page = max( 1, (int) $per_page );
		$pages    = (int) ceil( max( 0, (int) $total_items ) / $per_page );

		for ( $page = 2; $page <= $pages; $page++ ) {
			$this->add_url( $urls, $this->get_paged_url( $base_url, $page ) );
		}
	}

	/**
	 * Add URLs for posts split with the nextpage tag.
	 *
	 * @param array $urls    URL set.
	 * @param int   $post_id Post ID.
	 */
	private function add_multipage_post_urls( array &$urls, $post_id ) {
		$post = get_post( $post_id );

		if ( ! $post || false === strpos( $post->post_content, '<!--nextpage-->' ) ) {
			return;
		}

		$page_count = substr_count( $post->post_content, '<!--nextpage-->' ) + 1;
		$permalink  = get_permalink( $post_id );

		for ( $page = 2; $page <= $page_count; $page++ ) {
			if ( get_option( 'permalink_structure' ) ) {
				$this->add_url( $urls, trailingslashit( $permalink ) . $page . '/' );
			} else {
				$this->add_url( $urls, add_query_arg( 'page', $page, $permalink ) );
			}
		}
	}

	/**
	 * Build a paginated URL.
	 *
	 * @param string $base_url Base URL.
	 * @param int    $page     Page number.
	 * @return string
	 */
	private function get_paged_url( $base_url, $page ) {
		if ( get_option( 'permalink_structure' ) ) {
			return trailingslashit( $base_url ) . 'page/' . (int) $page . '/';
		}

		return add_query_arg( 'paged', (int) $page, $base_url );
	}

	/**
	 * Count published posts for a post type.
	 *
	 * @param string $post_type Post type.
	 * @return int
	 */
	private function count_published_posts( $post_type ) {
		$count = wp_count_posts( $post_type );

		return isset( $count->publish ) ? (int) $count->publish : 0;
	}

	/**
	 * Count public published posts for an author.
	 *
	 * @param int $user_id User ID.
	 * @return int
	 */
	private function count_user_published_posts( $user_id ) {
		return (int) count_user_posts( $user_id, 'post', true );
	}

	/**
	 * Return the configured posts-per-page value.
	 *
	 * @return int
	 */
	private function get_posts_per_page() {
		return max( 1, (int) get_option( 'posts_per_page', 10 ) );
	}

	/**
	 * Return the number of posts to load in each discovery query.
	 *
	 * @return int
	 */
	private function get_post_query_batch_size() {
		return 100;
	}

	/**
	 * Add a normalized same-site URL to the URL set.
	 *
	 * @param array       $urls URL set.
	 * @param string|bool $url  URL to add.
	 */
	private function add_url( array &$urls, $url ) {
		if ( empty( $url ) || is_wp_error( $url ) ) {
			return;
		}

		$url = $this->normalize_url( $url );

		if ( null === $url ) {
			return;
		}

		$urls[ $url ] = $url;
	}

	/**
	 * Normalize and validate an export URL.
	 *
	 * @param string $url URL.
	 * @return string|null
	 */
	public function normalize_url( $url ) {
		$url = html_entity_decode( (string) $url, ENT_QUOTES );
		$url = remove_query_arg( 'ssgwp_export', $url );
		$url = strtok( $url, '#' );

		if ( false === $url || '' === $url ) {
			return null;
		}

		$url_parts  = wp_parse_url( $url );
		$home_parts = wp_parse_url( home_url( '/' ) );

		if ( empty( $url_parts['host'] ) ) {
			$url = $this->resolve_relative_url( $url, home_url( '/' ) );
			$url_parts = wp_parse_url( $url );
		}

		if ( empty( $url_parts['host'] ) || empty( $home_parts['host'] ) ) {
			return null;
		}

		if ( strtolower( $url_parts['host'] ) !== strtolower( $home_parts['host'] ) ) {
			return null;
		}

		if ( isset( $home_parts['port'], $url_parts['port'] ) && (int) $home_parts['port'] !== (int) $url_parts['port'] ) {
			return null;
		}

		$path = isset( $url_parts['path'] ) ? $url_parts['path'] : '/';

		$query = isset( $url_parts['query'] ) ? $this->normalize_query( $url_parts['query'] ) : '';

		if ( null === $query ) {
			return null;
		}

		$canonical_url = $this->canonical_permalink_from_query( $query );

		if ( null !== $canonical_url ) {
			return $this->normalize_url( $canonical_url );
		}

		if ( preg_match( '#/(wp-admin|wp-comments-post\.php|wp-cron\.php|wp-login\.php|wp-json|xmlrpc\.php)(/|$)#', $path ) ) {
			return null;
		}

		if ( preg_match( '#/(feed|comments)(/|$)#', $path ) ) {
			return null;
		}

		$scheme = isset( $home_parts['scheme'] ) ? $home_parts['scheme'] : 'http';
		$port   = isset( $url_parts['port'] ) ? ':' . (int) $url_parts['port'] : ( isset( $home_parts['port'] ) ? ':' . (int) $home_parts['port'] : '' );

		return $scheme . '://' . $url_parts['host'] . $port . $path . ( '' !== $query ? '?' . $query : '' );
	}

	/**
	 * Resolve simple post ID query URLs to canonical permalinks when available.
	 *
	 * @param string $query Normalized query string.
	 * @return string|null Canonical permalink, or null.
	 */
	private function canonical_permalink_from_query( $query ) {
		if ( '' === $query || ! get_option( 'permalink_structure' ) ) {
			return null;
		}

		wp_parse_str( $query, $query_args );

		if ( 1 !== count( $query_args ) ) {
			return null;
		}

		$post_id = 0;

		if ( isset( $query_args['p'] ) ) {
			$post_id = absint( $query_args['p'] );
		} elseif ( isset( $query_args['page_id'] ) ) {
			$post_id = absint( $query_args['page_id'] );
		} elseif ( isset( $query_args['attachment_id'] ) ) {
			$post_id = absint( $query_args['attachment_id'] );
		}

		if ( 0 === $post_id ) {
			return null;
		}

		$post = get_post( $post_id );

		if ( ! $post || 'publish' !== $post->post_status ) {
			return null;
		}

		$permalink = get_permalink( $post );

		return $permalink && ! is_wp_error( $permalink ) ? $permalink : null;
	}

	/**
	 * Normalize finite public query strings.
	 *
	 * @param string $query Query string.
	 * @return string|null Normalized query, or null when it should not be exported.
	 */
	private function normalize_query( $query ) {
		wp_parse_str( $query, $query_args );

		if ( empty( $query_args ) ) {
			return '';
		}

		$blocked_keys = array(
			'_wp_http_referer',
			'_wpnonce',
			'customize_autosaved',
			'customize_changeset_uuid',
			'doing_wp_cron',
			'feed',
			'preview',
			'preview_id',
			'preview_nonce',
			'replytocom',
			'rest_route',
			'ssgwp_export',
		);

		foreach ( array_keys( $query_args ) as $key ) {
			$lower_key = strtolower( (string) $key );

			if ( in_array( $lower_key, $blocked_keys, true ) || 0 === strpos( $lower_key, 'utm_' ) || preg_match( '/^(fbclid|gclid|msclkid|mc_[a-z]+)$/', $lower_key ) ) {
				unset( $query_args[ $key ] );
				continue;
			}

			if ( is_array( $query_args[ $key ] ) ) {
				return null;
			}
		}

		if ( empty( $query_args ) ) {
			return '';
		}

		ksort( $query_args, SORT_STRING );

		return http_build_query( $query_args, '', '&', PHP_QUERY_RFC3986 );
	}

	/**
	 * Resolve a URL relative to a base URL.
	 *
	 * @param string $url  Relative URL.
	 * @param string $base Base URL.
	 * @return string
	 */
	public function resolve_relative_url( $url, $base ) {
		if ( preg_match( '#^[a-z][a-z0-9+.-]*:#i', $url ) ) {
			return $url;
		}

		if ( 0 === strpos( $url, '//' ) ) {
			$scheme = wp_parse_url( $base, PHP_URL_SCHEME );
			return $scheme . ':' . $url;
		}

		$base_parts = wp_parse_url( $base );
		$scheme     = isset( $base_parts['scheme'] ) ? $base_parts['scheme'] : 'http';
		$host       = isset( $base_parts['host'] ) ? $base_parts['host'] : '';
		$port       = isset( $base_parts['port'] ) ? ':' . (int) $base_parts['port'] : '';
		$url_parts  = wp_parse_url( $url );

		if ( false === $url_parts ) {
			return $url;
		}

		$relative_path = isset( $url_parts['path'] ) ? $url_parts['path'] : '';
		$query         = isset( $url_parts['query'] ) ? '?' . $url_parts['query'] : '';
		$fragment      = isset( $url_parts['fragment'] ) ? '#' . $url_parts['fragment'] : '';

		if ( 0 === strpos( $relative_path, '/' ) ) {
			return $scheme . '://' . $host . $port . $this->collapse_path( $relative_path ) . $query . $fragment;
		}

		$base_path = isset( $base_parts['path'] ) ? $base_parts['path'] : '/';
		$base_dir  = '/' === substr( $base_path, -1 ) ? $base_path : trailingslashit( dirname( $base_path ) );

		if ( '' === $relative_path ) {
			return $scheme . '://' . $host . $port . $base_path . $query . $fragment;
		}

		return $scheme . '://' . $host . $port . $this->collapse_path( $base_dir . $relative_path ) . $query . $fragment;
	}

	/**
	 * Collapse dot segments in a URL path.
	 *
	 * @param string $path URL path.
	 * @return string
	 */
	private function collapse_path( $path ) {
		$had_trailing_slash = '/' === substr( $path, -1 );
		$segments = explode( '/', $path );
		$output   = array();

		foreach ( $segments as $segment ) {
			if ( '' === $segment || '.' === $segment ) {
				continue;
			}

			if ( '..' === $segment ) {
				array_pop( $output );
				continue;
			}

			$output[] = $segment;
		}

		$collapsed = '/' . implode( '/', $output );

		if ( $had_trailing_slash && '/' !== $collapsed ) {
			$collapsed = trailingslashit( $collapsed );
		}

		return $collapsed;
	}
}
