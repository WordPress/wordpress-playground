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
			}

			$query = new WP_Query(
				array(
					'post_type'              => $post_type,
					'post_status'            => 'publish',
					'posts_per_page'         => -1,
					'fields'                 => 'ids',
					'no_found_rows'          => true,
					'update_post_meta_cache' => false,
					'update_post_term_cache' => false,
				)
			);

			foreach ( $query->posts as $post_id ) {
				$this->add_url( $urls, get_permalink( $post_id ) );
			}
		}
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
			$this->add_url( $urls, get_term_link( $term ) );
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
			$this->add_url( $urls, get_author_posts_url( $user_id ) );
		}
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

		if ( ! empty( $url_parts['query'] ) ) {
			return null;
		}

		if ( preg_match( '#/(wp-admin|wp-login\.php|wp-json|xmlrpc\.php)(/|$)#', $path ) ) {
			return null;
		}

		if ( preg_match( '#/(feed|comments)(/|$)#', $path ) ) {
			return null;
		}

		$scheme = isset( $home_parts['scheme'] ) ? $home_parts['scheme'] : 'http';
		$port   = isset( $url_parts['port'] ) ? ':' . (int) $url_parts['port'] : ( isset( $home_parts['port'] ) ? ':' . (int) $home_parts['port'] : '' );

		return $scheme . '://' . $url_parts['host'] . $port . $path;
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

		if ( 0 === strpos( $url, '/' ) ) {
			return $scheme . '://' . $host . $port . $url;
		}

		$base_path = isset( $base_parts['path'] ) ? $base_parts['path'] : '/';
		$base_dir  = '/' === substr( $base_path, -1 ) ? $base_path : trailingslashit( dirname( $base_path ) );

		return $scheme . '://' . $host . $port . $this->collapse_path( $base_dir . $url );
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
