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
	 * Convert a WordPress URL path and query string to an exported file path.
	 *
	 * @param string $path  URL path.
	 * @param string $query URL query string.
	 * @return string Relative export file path.
	 */
	public static function url_to_export_file_path( $path, $query = '' ) {
		$path = self::remove_deployment_base_path( $path );
		$path = self::sanitize_url_path( $path );

		if ( '' === $path ) {
			$file = 'index.html';
		} elseif ( self::url_path_has_exported_extension( $path ) ) {
			$file = $path;
		} else {
			$file = trailingslashit( $path ) . 'index.html';
		}

		if ( '' !== (string) $query ) {
			$query_hash = substr( md5( (string) $query ), 0, 8 );
			$file       = preg_replace( '#(?:/index)?\.html$#', '-' . $query_hash . '.html', $file );
		}

		return $file;
	}

	/**
	 * Remove the WordPress deployment base path from a URL path once.
	 *
	 * Playground scoped URLs include a runtime prefix such as /scope:example/.
	 * Static exports should be rooted at the generated ZIP, not under that
	 * deployment prefix.
	 *
	 * @param string $path URL path.
	 * @return string URL path relative to the WordPress deployment base.
	 */
	public static function remove_deployment_base_path( $path ) {
		$path = wp_normalize_path( (string) $path );

		foreach ( self::get_deployment_base_paths() as $base_path ) {
			$relative = self::remove_path_prefix( $path, $base_path );

			if ( null !== $relative ) {
				return $relative;
			}
		}

		return $path;
	}

	/**
	 * Determine whether the current WordPress deployment uses a non-root base.
	 *
	 * @return bool Whether home_url() or site_url() has a path prefix.
	 */
	public static function has_deployment_base_path() {
		return ! empty( self::get_deployment_base_paths() );
	}

	/**
	 * Determine whether a URL path is under the current deployment base.
	 *
	 * @param string $path URL path.
	 * @return bool Whether the URL path belongs to this deployment base.
	 */
	public static function is_url_path_under_deployment_base( $path ) {
		return self::is_url_path_under_base_paths( $path, self::get_deployment_base_paths() );
	}

	/**
	 * Determine whether a URL path is under any URL base.
	 *
	 * @param string   $path URL path.
	 * @param string[] $urls Base URLs.
	 * @return bool Whether the URL path belongs to one of the URL bases.
	 */
	public static function is_url_path_under_url_bases( $path, array $urls ) {
		return self::is_url_path_under_base_paths( $path, self::get_url_base_paths( $urls ) );
	}

	/**
	 * Sanitize a URL path while preserving distinct encoded segments.
	 *
	 * @param string $path URL path.
	 * @return string Relative export path without leading or trailing slashes.
	 */
	public static function sanitize_url_path( $path ) {
		$segments = array();

		foreach ( explode( '/', wp_normalize_path( (string) $path ) ) as $segment ) {
			if ( '' === $segment ) {
				continue;
			}

			$decoded = rawurldecode( $segment );

			if ( '' === $decoded ) {
				continue;
			}

			if ( '.' === $decoded ) {
				$segments[] = '%2E';
			} elseif ( '..' === $decoded ) {
				$segments[] = '%2E%2E';
			} else {
				$segments[] = rawurlencode( $decoded );
			}
		}

		return implode( '/', $segments );
	}

	/**
	 * Determine whether a sanitized URL path should export as a file.
	 *
	 * @param string $path Sanitized URL path.
	 * @return bool
	 */
	private static function url_path_has_exported_extension( $path ) {
		$segments = explode( '/', (string) $path );
		$basename = rawurldecode( end( $segments ) );

		return (bool) preg_match( '#\.[a-z0-9]{1,12}$#i', $basename );
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
	 * Resolve a child path and ensure it stays within the provided directory.
	 *
	 * @param string $directory Directory path.
	 * @param string $relative  Relative child path.
	 * @return string|null
	 */
	public static function resolve_child_file_path( $directory, $relative ) {
		if ( self::has_parent_segment( $relative ) ) {
			return null;
		}

		$directory = realpath( $directory );

		if ( false === $directory ) {
			return null;
		}

		$path = realpath( trailingslashit( $directory ) . $relative );

		if ( false === $path ) {
			return null;
		}

		$directory = wp_normalize_path( $directory );
		$path      = wp_normalize_path( $path );

		if ( ! is_file( $path ) || ! self::is_path_inside_directory( $path, $directory ) ) {
			return null;
		}

		return $path;
	}

	/**
	 * Resolve a child path but return the requested path before symlink resolution.
	 *
	 * @param string $directory Directory path.
	 * @param string $relative  Relative child path.
	 * @return string|null
	 */
	public static function resolve_child_file_path_preserving_requested_path( $directory, $relative ) {
		$relative = wp_normalize_path( (string) $relative );

		if (
			'' === $relative ||
			0 === strpos( $relative, '/' ) ||
			preg_match( '#^[A-Za-z]:/#', $relative ) ||
			self::has_parent_segment( $relative )
		) {
			return null;
		}

		$directory = realpath( $directory );

		if ( false === $directory ) {
			return null;
		}

		$requested_path = wp_normalize_path( trailingslashit( $directory ) . $relative );
		$real_path      = realpath( $requested_path );

		if ( false === $real_path ) {
			return null;
		}

		$directory = wp_normalize_path( $directory );
		$real_path = wp_normalize_path( $real_path );

		if ( ! is_file( $real_path ) || ! self::is_path_inside_directory( $real_path, $directory ) ) {
			return null;
		}

		return $requested_path;
	}

	/**
	 * Determine whether any segment in a path is a symbolic link.
	 *
	 * @param string $path Path.
	 * @return bool Whether the path traverses a symbolic link.
	 */
	public static function path_has_symlink_segment( $path ) {
		$path     = wp_normalize_path( (string) $path );
		$segments = array_values(
			array_filter(
				explode( '/', trim( $path, '/' ) ),
				static function ( $segment ) {
					return '' !== $segment;
				}
			)
		);

		$current = 0 === strpos( $path, '/' ) ? '/' : '';

		foreach ( $segments as $segment ) {
			if ( '' === $current ) {
				$current = $segment;
			} elseif ( '/' === $current ) {
				$current = '/' . $segment;
			} else {
				$current .= '/' . $segment;
			}

			if ( is_link( $current ) ) {
				return true;
			}
		}

		return false;
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
	 * Return deployment base paths sorted by specificity.
	 *
	 * @return string[]
	 */
	private static function get_deployment_base_paths() {
		$urls = array();

		if ( function_exists( 'home_url' ) ) {
			$urls[] = home_url( '/' );
		}

		if ( function_exists( 'site_url' ) ) {
			$urls[] = site_url( '/' );
		}

		$paths = array();

		foreach ( $urls as $url ) {
			$path = (string) wp_parse_url( $url, PHP_URL_PATH );
			$path = '/' . trim( $path, '/' );

			if ( '/' !== $path && ! isset( $paths[ $path ] ) ) {
				$paths[ $path ] = $path;
			}
		}

		usort(
			$paths,
			static function ( $a, $b ) {
				return strlen( $b ) <=> strlen( $a );
			}
		);

		return array_values( $paths );
	}

	/**
	 * Return non-root URL paths sorted by specificity.
	 *
	 * @param string[] $urls URLs.
	 * @return string[]
	 */
	private static function get_url_base_paths( array $urls ) {
		$paths = array();

		foreach ( $urls as $url ) {
			$path = (string) wp_parse_url( $url, PHP_URL_PATH );
			$path = '/' . trim( $path, '/' );

			if ( '/' !== $path && ! isset( $paths[ $path ] ) ) {
				$paths[ $path ] = $path;
			}
		}

		usort(
			$paths,
			static function ( $a, $b ) {
				return strlen( $b ) <=> strlen( $a );
			}
		);

		return array_values( $paths );
	}

	/**
	 * Determine whether a URL path is under any base path.
	 *
	 * @param string   $path       URL path.
	 * @param string[] $base_paths Base URL paths.
	 * @return bool Whether the URL path belongs under one of the base paths.
	 */
	private static function is_url_path_under_base_paths( $path, array $base_paths ) {
		if ( empty( $base_paths ) ) {
			return true;
		}

		foreach ( $base_paths as $base_path ) {
			if ( null !== self::remove_path_prefix( $path, $base_path ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Remove a URL path prefix when it matches complete decoded path segments.
	 *
	 * @param string $path   URL path.
	 * @param string $prefix URL path prefix.
	 * @return string|null Relative URL path, or null when the prefix does not match.
	 */
	private static function remove_path_prefix( $path, $prefix ) {
		$path_segments   = self::split_url_path_segments( $path );
		$prefix_segments = self::split_url_path_segments( $prefix );

		if ( empty( $prefix_segments ) || count( $path_segments ) < count( $prefix_segments ) ) {
			return null;
		}

		foreach ( $prefix_segments as $index => $prefix_segment ) {
			if ( rawurldecode( $path_segments[ $index ] ) !== rawurldecode( $prefix_segment ) ) {
				return null;
			}
		}

		$relative_segments = array_slice( $path_segments, count( $prefix_segments ) );

		return empty( $relative_segments ) ? '/' : '/' . implode( '/', $relative_segments );
	}

	/**
	 * Split a URL path into non-empty segments.
	 *
	 * @param string $path URL path.
	 * @return string[]
	 */
	private static function split_url_path_segments( $path ) {
		return array_values(
			array_filter(
				explode( '/', trim( wp_normalize_path( (string) $path ), '/' ) ),
				static function ( $segment ) {
					return '' !== $segment;
				}
			)
		);
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
