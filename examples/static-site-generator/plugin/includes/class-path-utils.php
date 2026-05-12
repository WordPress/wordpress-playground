<?php
/**
 * Shared path helpers for static exports.
 *
 * @package PlaygroundStaticSiteGenerator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalizes export paths without depending on the host operating system.
 */
final class SSGWP_Path_Utils {
	/**
	 * Sanitize a relative file path.
	 *
	 * @param string $path Relative path.
	 * @return string
	 */
	public static function sanitize_relative_path( $path ) {
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

	/**
	 * Determine whether a path contains a parent-directory segment.
	 *
	 * @param string $path Path.
	 * @return bool
	 */
	public static function has_parent_segment( $path ) {
		$path = wp_normalize_path( rawurldecode( (string) $path ) );

		return (bool) preg_match( '#(?:^|/)\.\.(?:/|$)#', $path );
	}

	/**
	 * Map WordPress asset URL paths to the export directory layout.
	 *
	 * @param string $path URL path.
	 * @return string Static path.
	 */
	public static function map_wordpress_asset_url_path( $path ) {
		$path = '/' . trim( rawurldecode( $path ), '/' );

		foreach ( self::get_wordpress_asset_path_mappings() as $mapping ) {
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
	 * Determine whether a path is inside a directory.
	 *
	 * @param string $path      Path.
	 * @param string $directory Directory.
	 * @return bool
	 */
	public static function is_path_inside_directory( $path, $directory ) {
		$path      = untrailingslashit( wp_normalize_path( $path ) );
		$directory = untrailingslashit( wp_normalize_path( $directory ) );

		return $path === $directory || 0 === strpos( $path, trailingslashit( $directory ) );
	}

	/**
	 * Return asset URL mappings sorted by URL path specificity.
	 *
	 * @return array<int,array{url:string,static:string}>
	 */
	private static function get_wordpress_asset_path_mappings() {
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

		return $mappings;
	}
}
