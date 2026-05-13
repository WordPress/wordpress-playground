<?php
/**
 * Static export implementation.
 *
 * @package PlaygroundStaticSiteGenerator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Exports public WordPress pages and assets to a static directory or ZIP.
 */
final class SSGWP_Static_Exporter {
	/**
	 * Export warnings.
	 *
	 * @var string[]
	 */
	private $warnings = array();

	/**
	 * Exported file count.
	 *
	 * @var int
	 */
	private $files_exported = 0;

	/**
	 * Linked assets already copied during this export.
	 *
	 * @var array<string,bool>
	 */
	private $linked_assets_copied = array();

	/**
	 * Current export root directory.
	 *
	 * @var string
	 */
	private $current_output_dir = '';

	/**
	 * Progress callback for long-running exports.
	 *
	 * @var callable|null
	 */
	private $progress_callback = null;

	/**
	 * Progress events emitted during the current export.
	 *
	 * @var array<int,array<string,mixed>>
	 */
	private $progress = array();

	/**
	 * Export a site to a ZIP file.
	 *
	 * @param string $output_file Absolute path to the zip file.
	 * @param array  $args        Export options.
	 * @return array Export summary.
	 * @throws Exception When export fails.
	 */
	public function export_to_zip( $output_file, array $args = array() ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			throw new Exception( 'The PHP zip extension is required to create static exports.' );
		}

		$output_file = wp_normalize_path( $output_file );
		$output_dir  = dirname( $output_file );

		if ( ! wp_mkdir_p( $output_dir ) ) {
			throw new Exception( 'Could not create the export output directory.' );
		}

		$work_dir = $this->make_temp_dir();

		try {
			$result = $this->export_to_directory( $work_dir, $args );
			$this->report_progress( 'zip', 'Creating static export ZIP.', array( 'output_file' => $output_file ) );
			$this->zip_directory( $work_dir, $output_file );
			$this->report_progress( 'zip_complete', 'Static export ZIP created.', array( 'output_file' => $output_file ) );
			$result['progress'] = $this->progress;
		} finally {
			$this->delete_directory( $work_dir );
		}

		return $result;
	}

	/**
	 * Export a site to a directory.
	 *
	 * @param string $output_dir Directory path.
	 * @param array  $args       Export options.
	 * @return array Export summary.
	 * @throws Exception When export fails.
	 */
	public function export_to_directory( $output_dir, array $args = array() ) {
		$this->warnings             = array();
		$this->files_exported       = 0;
		$this->linked_assets_copied = array();
		$this->progress             = array();

		$args = wp_parse_args(
			$args,
			array(
				'url_mode'         => 'relative',
				'max_pages'        => 500,
				'copy_uploads'     => true,
				'copy_theme'       => true,
				'copy_plugins'     => true,
				'copy_core_assets' => true,
				'crawl_links'      => true,
				'include_manifest' => true,
				'fetch_mode'       => 'auto',
				'progress_callback' => null,
			)
		);

		$this->progress_callback = is_callable( $args['progress_callback'] ) ? $args['progress_callback'] : null;
		$output_dir = wp_normalize_path( $output_dir );

		if ( ! wp_mkdir_p( $output_dir ) ) {
			throw new Exception( 'Could not create the static export directory.' );
		}

		$output_dir = realpath( $output_dir );

		if ( false === $output_dir ) {
			throw new Exception( 'Could not resolve the static export directory.' );
		}

		$output_dir               = wp_normalize_path( $output_dir );
		$this->current_output_dir = $output_dir;

		$max_pages         = max( 1, (int) $args['max_pages'] );
		$collector         = new SSGWP_URL_Collector();
		$rewriter          = new SSGWP_URL_Rewriter( $collector, $args['url_mode'] );
		$queue             = $collector->collect( $max_pages );
		$queue_index       = 0;
		$seen              = array();
		$exported          = array();
		$linked_asset_urls = array();

		$this->report_progress(
			'discovered',
			sprintf( 'Discovered %d initial URLs for export.', count( $queue ) ),
			array(
				'queue_total' => count( $queue ),
				'max_pages'   => $max_pages,
			)
		);

		while ( isset( $queue[ $queue_index ] ) && count( $exported ) < $max_pages ) {
			$url = $queue[ $queue_index ];
			++$queue_index;

			$url = $collector->normalize_url( $url );

			if ( null === $url || isset( $seen[ $url ] ) ) {
				continue;
			}

			$seen[ $url ] = true;

			$this->report_progress(
				'render_page',
				sprintf( 'Rendering %s.', $url ),
				array(
					'url'            => $url,
					'queue_position' => $queue_index,
					'queue_total'    => count( $queue ),
				)
			);

			$response = $this->fetch_url( $url, $args );

			if ( is_wp_error( $response ) ) {
				$this->warnings[] = sprintf( 'Could not export %1$s: %2$s', $url, $response->get_error_message() );
				$this->report_progress(
					'page_failed',
					sprintf( 'Could not export %s.', $url ),
					array(
						'url'   => $url,
						'error' => $response->get_error_message(),
					)
				);
				continue;
			}

			$target_path = $this->url_to_file_path( $url );
			$response    = $this->inject_missing_core_block_styles( $response );
			$rewritten   = $rewriter->rewrite_html( $response, $url, $target_path );

			$this->write_file( trailingslashit( $output_dir ) . $target_path, $rewritten['content'] );
			$exported[] = $url;
			$this->report_progress(
				'page_exported',
				sprintf( 'Exported %s.', $url ),
				array(
					'url'            => $url,
					'target_path'    => $target_path,
					'pages_exported' => count( $exported ),
					'queue_total'    => count( $queue ),
				)
			);

			foreach ( $rewritten['assets'] as $asset_url ) {
				$linked_asset_urls[ $asset_url ] = $asset_url;
			}

			if ( ! empty( $args['crawl_links'] ) ) {
				foreach ( $rewritten['links'] as $linked_url ) {
					if ( ! isset( $seen[ $linked_url ] ) ) {
						$queue[] = $linked_url;
					}
				}
			}
		}

		if ( count( $exported ) >= $max_pages && $queue_index < count( $queue ) ) {
			$this->warnings[] = sprintf( 'Stopped after reaching the max page limit of %d.', $max_pages );
		}

		if ( empty( $exported ) ) {
			throw new Exception( 'No pages were exported. ' . implode( ' ', $this->warnings ) );
		}

		$this->report_progress( 'copy_assets', 'Copying frontend assets.', array( 'output_dir' => $output_dir ) );
		$this->copy_assets( $output_dir, $args );
		$this->report_progress( 'copy_linked_assets', 'Copying linked same-site assets.', array( 'asset_count' => count( $linked_asset_urls ) ) );
		$this->copy_linked_assets( array_values( $linked_asset_urls ), $output_dir );
		$this->rewrite_copied_text_assets_and_copy_dependencies( $output_dir, $rewriter );
		$this->report_progress(
			'complete',
			sprintf( 'Exported %1$d pages and %2$d files.', count( $exported ), $this->files_exported ),
			array(
				'pages_exported' => count( $exported ),
				'files_exported' => $this->files_exported,
			)
		);

		$result = array(
			'generated_at'    => gmdate( 'c' ),
			'home_url'        => home_url( '/' ),
			'pages_exported'  => count( $exported ),
			'files_exported'  => $this->files_exported,
			'exported_urls'   => $exported,
			'warnings'        => $this->warnings,
			'wordpress'       => get_bloginfo( 'version' ),
			'plugin_version'  => SSGWP_VERSION,
			'url_mode'        => $args['url_mode'],
			'progress'        => $this->progress,
			'playground_note' => 'This static export can be hosted anywhere. Keep a WordPress Playground site export separately if you want to restore the editable source site later.',
		);

		if ( ! empty( $args['include_manifest'] ) ) {
			$this->write_file(
				trailingslashit( $output_dir ) . 'static-export.json',
				wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES )
			);
		}

		return $result;
	}

	/**
	 * Emit a progress event.
	 *
	 * @param string $stage   Short stage identifier.
	 * @param string $message Human-readable progress message.
	 * @param array  $context Additional structured context.
	 */
	private function report_progress( $stage, $message, array $context = array() ) {
		$event = array(
			'time'           => gmdate( 'c' ),
			'stage'          => $stage,
			'message'        => $message,
			'pages_exported' => isset( $context['pages_exported'] ) ? (int) $context['pages_exported'] : 0,
			'files_exported' => $this->files_exported,
			'context'        => $context,
		);

		$this->progress[] = $event;

		if ( null !== $this->progress_callback ) {
			call_user_func( $this->progress_callback, $event );
		}
	}

	/**
	 * Add missing core block stylesheet links for rendered block classes.
	 *
	 * Internal rendering can produce block markup without separate core block
	 * stylesheet links. Static exports need those links because copied core block
	 * CSS files are otherwise present in the ZIP but never loaded by the page.
	 *
	 * @param string $html Rendered HTML.
	 * @return string HTML with missing core block stylesheet links.
	 */
	private function inject_missing_core_block_styles( $html ) {
		$html = (string) $html;
		$markup = preg_replace( '#<(style|script)\b[^>]*>.*?</\1>#is', '', $html );

		if ( ! is_string( $markup ) || false === strpos( $markup, 'wp-block-' ) ) {
			return $html;
		}

		if ( ! preg_match_all( '/\bwp-block-([a-z0-9-]+)\b/i', $markup, $matches ) ) {
			return $html;
		}

		$links = array();
		$block_names = array_unique( array_map( 'strtolower', $matches[1] ) );

		foreach ( $block_names as $block_name ) {
			if ( $this->has_core_block_style_link( $html, $block_name ) ) {
				continue;
			}

			$stylesheet = $this->core_block_stylesheet_path( $block_name );

			if ( null === $stylesheet ) {
				continue;
			}

			$href    = includes_url( 'blocks/' . $block_name . '/' . basename( $stylesheet ) );
			$href    = add_query_arg( 'ver', get_bloginfo( 'version' ), $href );
			$links[] = sprintf(
				'<link rel="stylesheet" id="%1$s" href="%2$s" media="all" />',
				esc_attr( 'wp-block-' . $block_name . '-css' ),
				esc_url( $href )
			);
		}

		if ( empty( $links ) ) {
			return $html;
		}

		$injected = implode( "\n", $links ) . "\n";

		if ( false !== stripos( $html, '</head>' ) ) {
			return preg_replace( '/<\/head>/i', $injected . '</head>', $html, 1 );
		}

		return $injected . $html;
	}

	/**
	 * Determine whether a core block stylesheet is already present.
	 *
	 * @param string $html       Rendered HTML.
	 * @param string $block_name Core block name without the core/ prefix.
	 * @return bool Whether the stylesheet is already linked or inlined.
	 */
	private function has_core_block_style_link( $html, $block_name ) {
		$style_ids = array(
			'wp-block-' . $block_name . '-css',
			'wp-block-' . $block_name . '-inline-css',
		);

		foreach ( $style_ids as $style_id ) {
			if ( preg_match( '/\sid=(["\'])' . preg_quote( $style_id, '/' ) . '\1/i', $html ) ) {
				return true;
			}
		}

		return false !== stripos( $html, '/wp-includes/blocks/' . $block_name . '/style' );
	}

	/**
	 * Return the best available core block stylesheet path.
	 *
	 * @param string $block_name Core block name without the core/ prefix.
	 * @return string|null Stylesheet path, or null when none exists.
	 */
	private function core_block_stylesheet_path( $block_name ) {
		$block_name = strtolower( $block_name );

		if ( ! preg_match( '/^[a-z0-9-]+$/', $block_name ) ) {
			return null;
		}

		$base = trailingslashit( ABSPATH ) . WPINC . '/blocks/' . $block_name . '/';

		foreach ( array( 'style.min.css', 'style.css' ) as $file ) {
			$path = $base . $file;

			if ( is_readable( $path ) && is_file( $path ) ) {
				return wp_normalize_path( $path );
			}
		}

		return null;
	}

	/**
	 * Fetch a public page.
	 *
	 * @param string $url URL.
	 * @return string|WP_Error HTML or error.
	 */
	private function fetch_url( $url, array $args ) {
		$request_url = add_query_arg( 'ssgwp_export', '1', $url );

		if ( 'internal' === $args['fetch_mode'] ) {
			return $this->render_url_in_process( $request_url );
		}

		$response    = wp_remote_get(
			$request_url,
			array(
				'timeout'     => 5,
				'redirection' => 5,
				'headers'     => array(
					'X-Static-Site-Generator' => '1',
				),
			)
		);

		if ( ! is_wp_error( $response ) ) {
			$status = (int) wp_remote_retrieve_response_code( $response );

			if ( $status >= 200 && $status < 400 ) {
				$content_type = wp_remote_retrieve_header( $response, 'content-type' );

				if ( ! $content_type || false !== stripos( $content_type, 'html' ) ) {
					return (string) wp_remote_retrieve_body( $response );
				}

				$response = new WP_Error( 'ssgwp_not_html', sprintf( 'Expected HTML, received %s', $content_type ) );
			} else {
				$response = new WP_Error( 'ssgwp_http_status', sprintf( 'HTTP %d', $status ) );
			}
		}

		$fallback = $this->render_url_in_process( $request_url );

		if ( ! is_wp_error( $fallback ) ) {
			return $fallback;
		}

		return $response;
	}

	/**
	 * Render a same-site URL inside the current PHP process.
	 *
	 * Playground CLI can deadlock or return empty loopback responses when a Blueprint
	 * runs with a small worker pool. Rendering internally keeps exports working there
	 * while retaining loopback HTTP as the first choice for regular WordPress sites.
	 *
	 * @param string $url URL to render.
	 * @return string|WP_Error Rendered HTML or error.
	 */
	private function render_url_in_process( $url ) {
		$parts      = wp_parse_url( $url );
		$home_parts = wp_parse_url( home_url( '/' ) );

		if ( empty( $parts['host'] ) || empty( $home_parts['host'] ) || strtolower( $parts['host'] ) !== strtolower( $home_parts['host'] ) ) {
			return new WP_Error( 'ssgwp_not_same_site', 'Only same-site URLs can be rendered internally.' );
		}

		$url_scheme  = isset( $parts['scheme'] ) ? strtolower( $parts['scheme'] ) : '';
		$home_scheme = isset( $home_parts['scheme'] ) ? strtolower( $home_parts['scheme'] ) : '';

		if ( $url_scheme !== $home_scheme ) {
			return new WP_Error(
				'ssgwp_not_same_site_scheme',
				'Only same-scheme URLs can be rendered internally.'
			);
		}

		if ( $this->effective_url_port( $home_parts ) !== $this->effective_url_port( $parts ) ) {
			return new WP_Error(
				'ssgwp_not_same_site_port',
				'Only same-port URLs can be rendered internally.'
			);
		}

		$path = isset( $parts['path'] ) ? $parts['path'] : '/';

		if ( ! SSGWP_Path_Utils::is_url_path_under_deployment_base( $path ) ) {
			return new WP_Error(
				'ssgwp_not_deployment_base',
				'Only URLs under the current deployment base can be rendered internally.'
			);
		}

		if ( ! class_exists( 'WP' ) || ! class_exists( 'WP_Query' ) ) {
			return new WP_Error( 'ssgwp_missing_wp', 'WordPress request classes are not available.' );
		}

		if ( ! defined( 'WP_USE_THEMES' ) ) {
			define( 'WP_USE_THEMES', true );
		}

		$query       = isset( $parts['query'] ) ? $parts['query'] : '';
		$request_uri = $path . ( '' !== $query ? '?' . $query : '' );

		$snapshot = $this->snapshot_request_state();

		try {
			$http_host = $parts['host'] . ( isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '' );

			$_SERVER['REQUEST_URI'] = $request_uri;
			$_SERVER['HTTP_HOST']   = $http_host;
			$_SERVER['SERVER_NAME'] = $parts['host'];
			$_GET                   = array();
			$_POST                  = array();

			if ( '' !== $query ) {
				parse_str( $query, $_GET );
			}

			$_REQUEST = $_GET;

			wp_set_current_user( 0 );

			$GLOBALS['wp']           = new WP();
			$GLOBALS['wp_query']     = new WP_Query();
			$GLOBALS['wp_the_query'] = $GLOBALS['wp_query'];

			$this->reset_frontend_asset_state();

			ob_start();
			wp();

			if ( is_404() ) {
				ob_end_clean();
				$this->restore_request_state( $snapshot );

				$single_post_fallback = $this->render_single_post_url_in_process( $url );

				if ( ! is_wp_error( $single_post_fallback ) ) {
					return $single_post_fallback;
				}

				return new WP_Error( 'ssgwp_internal_render_404', 'HTTP 404' );
			}

			require ABSPATH . WPINC . '/template-loader.php';
			$html = ob_get_clean();
		} catch ( Throwable $throwable ) {
			if ( ob_get_level() > $snapshot['ob_level'] ) {
				ob_end_clean();
			}

			$this->restore_request_state( $snapshot );

			return new WP_Error( 'ssgwp_internal_render_failed', $throwable->getMessage() );
		}

		$this->restore_request_state( $snapshot );

		if ( '' === trim( $html ) ) {
			return new WP_Error( 'ssgwp_internal_render_empty', 'The internal renderer returned an empty response.' );
		}

		return $html;
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
	 * Render a single post URL directly when request parsing cannot resolve it.
	 *
	 * @param string $url URL to render.
	 * @return string|WP_Error Rendered HTML or error.
	 */
	private function render_single_post_url_in_process( $url ) {
		$post_id = $this->post_id_from_url( $url );

		if ( ! $post_id ) {
			return new WP_Error( 'ssgwp_no_single_post_match', 'No single post matched the URL.' );
		}

		$post = get_post( $post_id );

		if ( ! $post || 'publish' !== $post->post_status ) {
			return new WP_Error( 'ssgwp_single_post_not_public', 'The matched post is not public.' );
		}

		$parts = wp_parse_url( $url );

		if ( empty( $parts['host'] ) ) {
			return new WP_Error( 'ssgwp_single_post_missing_host', 'The URL is missing a host.' );
		}

		$path        = isset( $parts['path'] ) ? $parts['path'] : '/';
		$query       = isset( $parts['query'] ) ? $parts['query'] : '';
		$request_uri = $path . ( '' !== $query ? '?' . $query : '' );
		$snapshot    = $this->snapshot_request_state();

		try {
			$http_host = $parts['host'] . ( isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '' );

			$_SERVER['REQUEST_URI'] = $request_uri;
			$_SERVER['HTTP_HOST']   = $http_host;
			$_SERVER['SERVER_NAME'] = $parts['host'];
			$_GET                   = array();
			$_POST                  = array();

			if ( '' !== $query ) {
				parse_str( $query, $_GET );
			}

			$_REQUEST = $_GET;

			wp_set_current_user( 0 );

			$query_args = array(
				'post_type' => get_post_type( $post ),
				'p'         => $post_id,
			);

			if ( 'page' === $post->post_type ) {
				$query_args = array( 'page_id' => $post_id );
			}

			$GLOBALS['wp']           = new WP();
			$GLOBALS['wp_query']     = new WP_Query( $query_args );
			$GLOBALS['wp_the_query'] = $GLOBALS['wp_query'];
			$GLOBALS['post']         = $post;

			$this->reset_frontend_asset_state();

			ob_start();
			require ABSPATH . WPINC . '/template-loader.php';
			$html = ob_get_clean();
		} catch ( Throwable $throwable ) {
			if ( ob_get_level() > $snapshot['ob_level'] ) {
				ob_end_clean();
			}

			$this->restore_request_state( $snapshot );

			return new WP_Error( 'ssgwp_single_post_render_failed', $throwable->getMessage() );
		}

		$this->restore_request_state( $snapshot );

		if ( '' === trim( $html ) ) {
			return new WP_Error( 'ssgwp_single_post_render_empty', 'The single post renderer returned an empty response.' );
		}

		return $html;
	}

	/**
	 * Reset frontend script and style registries for an internal render.
	 *
	 * Blueprint and CLI exports run inside an existing WordPress request. Reusing
	 * that request's registries can make wp_head() think frontend styles already
	 * printed, producing static HTML without loadable CSS.
	 */
	private function reset_frontend_asset_state() {
		if ( function_exists( 'wp_scripts' ) ) {
			$GLOBALS['wp_scripts'] = null;
			wp_scripts();
		}

		if ( function_exists( 'wp_styles' ) ) {
			$GLOBALS['wp_styles'] = null;
			wp_styles();
		}
	}

	/**
	 * Resolve a same-site URL to a public post ID.
	 *
	 * @param string $url URL.
	 * @return int Post ID, or 0.
	 */
	private function post_id_from_url( $url ) {
		$post_id = url_to_postid( $url );

		if ( $post_id ) {
			return (int) $post_id;
		}

		$path = (string) wp_parse_url( $url, PHP_URL_PATH );
		$path = SSGWP_Path_Utils::remove_deployment_base_path( $path );
		$path = trim( $path, '/' );

		if ( '' === $path || SSGWP_Path_Utils::has_parent_segment( $path ) ) {
			return 0;
		}

		$post_types = get_post_types( array( 'public' => true ), 'names' );
		$post       = get_page_by_path( $path, OBJECT, $post_types );

		return $post ? (int) $post->ID : 0;
	}

	/**
	 * Snapshot request globals before internal rendering.
	 *
	 * @return array
	 */
	private function snapshot_request_state() {
		$global_names = array(
			'wp',
			'wp_query',
			'wp_the_query',
			'post',
			'id',
			'authordata',
			'currentday',
			'currentmonth',
			'page',
			'pages',
			'multipage',
			'more',
			'numpages',
			'wp_scripts',
			'wp_styles',
		);

		$globals = array();

		foreach ( $global_names as $name ) {
			$globals[ $name ] = array_key_exists( $name, $GLOBALS ) ? $GLOBALS[ $name ] : null;
		}

		return array(
			'server'          => $_SERVER,
			'get'             => $_GET,
			'post'            => $_POST,
			'request'         => $_REQUEST,
			'globals'         => $globals,
			'current_user_id' => get_current_user_id(),
			'ob_level'        => ob_get_level(),
		);
	}

	/**
	 * Restore request globals after internal rendering.
	 *
	 * @param array $snapshot Snapshot from snapshot_request_state().
	 */
	private function restore_request_state( array $snapshot ) {
		$_SERVER  = $snapshot['server'];
		$_GET     = $snapshot['get'];
		$_POST    = $snapshot['post'];
		$_REQUEST = $snapshot['request'];

		foreach ( $snapshot['globals'] as $name => $value ) {
			if ( null === $value ) {
				unset( $GLOBALS[ $name ] );
			} else {
				$GLOBALS[ $name ] = $value;
			}
		}

		wp_set_current_user( (int) $snapshot['current_user_id'] );
	}

	/**
	 * Convert a URL to a static file path.
	 *
	 * @param string $url URL.
	 * @return string Relative file path.
	 */
	private function url_to_file_path( $url ) {
		$parts = wp_parse_url( $url );
		$path  = isset( $parts['path'] ) ? $parts['path'] : '/';
		$query = isset( $parts['query'] ) ? $parts['query'] : '';

		return SSGWP_Path_Utils::url_to_export_file_path( $path, $query );
	}

	/**
	 * Copy frontend assets into the export directory.
	 *
	 * @param string $output_dir Output directory.
	 * @param array  $args       Export args.
	 */
	private function copy_assets( $output_dir, array $args ) {
		if ( ! empty( $args['copy_uploads'] ) ) {
			$uploads = wp_get_upload_dir();
			if ( ! empty( $uploads['basedir'] ) && is_dir( $uploads['basedir'] ) ) {
				$this->copy_path( $uploads['basedir'], trailingslashit( $output_dir ) . 'wp-content/uploads' );
			}
		}

		if ( ! empty( $args['copy_theme'] ) ) {
			$this->copy_theme_assets( $output_dir );
		}

		if ( ! empty( $args['copy_plugins'] ) ) {
			$this->copy_active_plugin_assets( $output_dir );
		}

		if ( ! empty( $args['copy_core_assets'] ) ) {
			$this->copy_core_frontend_assets( $output_dir );
		}
	}

	/**
	 * Copy same-site assets discovered in exported HTML.
	 *
	 * @param string[] $urls       Asset URLs.
	 * @param string   $output_dir Output directory.
	 * @return int Number of copied assets.
	 */
	private function copy_linked_assets( array $urls, $output_dir ) {
		$copied = 0;

		foreach ( $urls as $url ) {
			if ( $this->copy_linked_asset( $url, $output_dir ) ) {
				++$copied;
			}
		}

		return $copied;
	}

	/**
	 * Copy a same-site asset into the static export.
	 *
	 * @param string $url        Asset URL.
	 * @param string $output_dir Output directory.
	 * @return bool Whether a file was copied.
	 */
	private function copy_linked_asset( $url, $output_dir ) {
		$target_path = $this->url_to_asset_path( $url );

		if ( null === $target_path ) {
			$this->warn_linked_asset_not_copied( $url, 'unsupported or unsafe target path' );
			return false;
		}

		if ( isset( $this->linked_assets_copied[ $target_path ] ) ) {
			return false;
		}

		$this->linked_assets_copied[ $target_path ] = true;
		$target = trailingslashit( $output_dir ) . $target_path;

		if ( file_exists( $target ) ) {
			return false;
		}

		$source = $this->map_url_to_local_file( $url );

		if ( null === $source ) {
			$this->warn_linked_asset_not_copied( $url, 'no matching local file was found' );
			return false;
		}

		if ( ! $this->is_exportable_asset_file( $source ) ) {
			$this->warn_linked_asset_not_copied( $url, 'the local file is not exportable' );
			return false;
		}

		$this->write_file( $target, file_get_contents( $source ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		return true;
	}

	/**
	 * Record a warning for a referenced same-site asset that could not be copied.
	 *
	 * @param string $url    Asset URL.
	 * @param string $reason Short failure reason.
	 */
	private function warn_linked_asset_not_copied( $url, $reason ) {
		$this->warnings[] = sprintf(
			'Could not copy linked asset %1$s: %2$s.',
			$url,
			$reason
		);
	}

	/**
	 * Convert an asset URL to a relative static path.
	 *
	 * @param string $url Asset URL.
	 * @return string|null
	 */
	private function url_to_asset_path( $url ) {
		$parts = wp_parse_url( $url );

		if ( empty( $parts['path'] ) ) {
			return null;
		}

		$path = SSGWP_Path_Utils::map_wordpress_asset_url_path( $parts['path'] );
		$path = SSGWP_Path_Utils::remove_deployment_base_path( $path );
		$path = trim( $path, '/' );

		if ( '' === $path || SSGWP_Path_Utils::has_parent_segment( $path ) ) {
			return null;
		}

		if ( preg_match( '/\.(php|phar|phtml|sql|sqlite|log)$/i', $path ) ) {
			return null;
		}

		return SSGWP_Path_Utils::sanitize_relative_path( $path );
	}

	/**
	 * Map a same-site asset URL to a readable local file.
	 *
	 * @param string $url Asset URL.
	 * @return string|null
	 */
	private function map_url_to_local_file( $url ) {
		$parts = wp_parse_url( $url );

		if ( empty( $parts['path'] ) ) {
			return null;
		}

		$url_path = '/' . ltrim( rawurldecode( $parts['path'] ), '/' );
		$mappings = array(
			array(
				'url' => content_url( '/' ),
				'dir' => WP_CONTENT_DIR,
			),
			array(
				'url' => includes_url( '/' ),
				'dir' => ABSPATH . WPINC,
			),
			array(
				'url' => site_url( '/' ),
				'dir' => ABSPATH,
			),
			array(
				'url' => home_url( '/' ),
				'dir' => ABSPATH,
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

			if ( '/' !== $base_path && 0 !== strpos( trailingslashit( $url_path ), $base_path ) ) {
				continue;
			}

			$relative = '/' === $base_path ? ltrim( $url_path, '/' ) : ltrim( substr( $url_path, strlen( $base_path ) ), '/' );
			$source   = SSGWP_Path_Utils::resolve_child_file_path( $mapping['dir'], $relative );

			if ( null !== $source ) {
				return $source;
			}
		}

		return null;
	}

	/**
	 * Determine whether a local file should be copied as a static asset.
	 *
	 * @param string $path File path.
	 * @return bool
	 */
	private function is_exportable_asset_file( $path ) {
		$name = basename( $path );

		if ( '' === $name || '.' === $name[0] ) {
			return false;
		}

		if ( preg_match( '/\.(map|pot|po|mo|php|phar|phtml|sqlite|sql|log)$/i', $name ) ) {
			return false;
		}

		return is_readable( $path ) && is_file( $path );
	}

	/**
	 * Copy active theme files.
	 *
	 * @param string $output_dir Output directory.
	 */
	private function copy_theme_assets( $output_dir ) {
		$theme_dirs = array_unique(
			array_filter(
				array(
					get_template_directory(),
					get_stylesheet_directory(),
				)
			)
		);

		foreach ( $theme_dirs as $theme_dir ) {
			if ( ! is_dir( $theme_dir ) ) {
				continue;
			}

			$relative = ltrim( str_replace( wp_normalize_path( WP_CONTENT_DIR ), '', wp_normalize_path( $theme_dir ) ), '/' );
			$this->copy_path( $theme_dir, trailingslashit( $output_dir ) . 'wp-content/' . $relative );
		}
	}

	/**
	 * Copy active plugin files, excluding this exporter plugin.
	 *
	 * @param string $output_dir Output directory.
	 */
	private function copy_active_plugin_assets( $output_dir ) {
		$active_plugins = (array) get_option( 'active_plugins', array() );

		if ( is_multisite() ) {
			$active_plugins = array_merge( $active_plugins, array_keys( (array) get_site_option( 'active_sitewide_plugins', array() ) ) );
		}

		foreach ( array_unique( $active_plugins ) as $plugin_basename ) {
			if ( SSGWP_PLUGIN_BASENAME === $plugin_basename ) {
				continue;
			}

			$plugin_path = trailingslashit( WP_PLUGIN_DIR ) . $plugin_basename;
			$source      = is_dir( dirname( $plugin_path ) ) && '.' !== dirname( $plugin_basename ) ? dirname( $plugin_path ) : $plugin_path;

			if ( ! file_exists( $source ) ) {
				continue;
			}

			$relative = ltrim( str_replace( wp_normalize_path( WP_PLUGIN_DIR ), '', wp_normalize_path( $source ) ), '/' );
			$this->copy_path( $source, trailingslashit( $output_dir ) . 'wp-content/plugins/' . $relative );
		}
	}

	/**
	 * Copy WordPress core asset directories needed by block themes and frontend scripts.
	 *
	 * @param string $output_dir Output directory.
	 */
	private function copy_core_frontend_assets( $output_dir ) {
		$paths = array(
			ABSPATH . WPINC . '/blocks',
			ABSPATH . WPINC . '/css',
			ABSPATH . WPINC . '/js',
			ABSPATH . WPINC . '/images',
			ABSPATH . WPINC . '/fonts',
		);

		foreach ( $paths as $path ) {
			if ( ! is_dir( $path ) ) {
				continue;
			}

			$relative = ltrim( str_replace( wp_normalize_path( ABSPATH ), '', wp_normalize_path( $path ) ), '/' );
			$this->copy_path( $path, trailingslashit( $output_dir ) . $relative );
		}
	}

	/**
	 * Copy a file or directory recursively.
	 *
	 * @param string $source Source path.
	 * @param string $target Target path.
	 */
	private function copy_path( $source, $target ) {
		$source = wp_normalize_path( $source );
		$target = wp_normalize_path( $target );

		if ( is_file( $source ) ) {
			if ( ! $this->filter_copied_path( new SplFileInfo( $source ) ) ) {
				return;
			}

			$this->write_file( $target, file_get_contents( $source ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			return;
		}

		$iterator = new RecursiveIteratorIterator(
			new RecursiveCallbackFilterIterator(
				new RecursiveDirectoryIterator( $source, FilesystemIterator::SKIP_DOTS ),
				array( $this, 'filter_copied_path' )
			),
			RecursiveIteratorIterator::SELF_FIRST
		);

		foreach ( $iterator as $item ) {
			$relative = ltrim( str_replace( $source, '', wp_normalize_path( $item->getPathname() ) ), '/' );
			$dest     = trailingslashit( $target ) . $relative;

			if ( $item->isDir() ) {
				wp_mkdir_p( $dest );
				continue;
			}

			$this->write_file( $dest, file_get_contents( $item->getPathname() ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		}
	}

	/**
	 * Filter paths that should not be copied into a static export.
	 *
	 * @param SplFileInfo $file File info.
	 * @return bool
	 */
	public function filter_copied_path( SplFileInfo $file ) {
		$name = $file->getFilename();

		if ( '' === $name || '.' === $name[0] ) {
			return false;
		}

		if ( $file->isFile() ) {
			return $this->is_exportable_asset_file( $file->getPathname() );
		}

		if ( in_array( $name, array( 'node_modules', 'vendor', 'tests', '__tests__' ), true ) ) {
			return false;
		}

		if ( preg_match( '/\.(map|pot|po|mo|phar|php|phtml|sqlite|sql|log)$/i', $name ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Rewrite copied text assets and copy assets they discover.
	 *
	 * @param string              $output_dir Output directory.
	 * @param SSGWP_URL_Rewriter $rewriter   URL rewriter.
	 */
	private function rewrite_copied_text_assets_and_copy_dependencies( $output_dir, SSGWP_URL_Rewriter $rewriter ) {
		$max_passes = 5;

		for ( $pass = 1; $pass <= $max_passes; $pass++ ) {
			$this->report_progress(
				'rewrite_assets',
				'Rewriting URLs in copied text assets.',
				array(
					'output_dir' => $output_dir,
					'pass'       => $pass,
				)
			);

			$asset_urls = $this->rewrite_copied_text_assets( $output_dir, $rewriter );

			if ( empty( $asset_urls ) ) {
				return;
			}

			$this->report_progress(
				'copy_text_asset_dependencies',
				'Copying assets discovered in copied text assets.',
				array(
					'asset_count' => count( $asset_urls ),
					'pass'        => $pass,
				)
			);

			if ( 0 === $this->copy_linked_assets( $asset_urls, $output_dir ) ) {
				return;
			}
		}

		$this->warnings[] = sprintf(
			'Stopped text asset dependency discovery after %d passes.',
			$max_passes
		);
	}

	/**
	 * Rewrite URLs inside copied text assets.
	 *
	 * @param string              $output_dir Output directory.
	 * @param SSGWP_URL_Rewriter $rewriter   URL rewriter.
	 * @return string[] Asset URLs discovered while rewriting.
	 */
	private function rewrite_copied_text_assets( $output_dir, SSGWP_URL_Rewriter $rewriter ) {
		$asset_urls = array();
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $output_dir, FilesystemIterator::SKIP_DOTS )
		);

		foreach ( $iterator as $file ) {
			if ( ! $file->isFile() ) {
				continue;
			}

			$extension = strtolower( pathinfo( $file->getFilename(), PATHINFO_EXTENSION ) );

			if (
				! in_array(
					$extension,
					array( 'css', 'js', 'json', 'svg', 'html', 'webmanifest', 'xml' ),
					true
				)
			) {
				continue;
			}

			if ( $file->getSize() > 2 * MB_IN_BYTES ) {
				continue;
			}

			$path     = wp_normalize_path( $file->getPathname() );
			$relative = ltrim( str_replace( wp_normalize_path( $output_dir ), '', $path ), '/' );
			$content  = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$rewritten = $rewriter->rewrite_text_asset_with_assets( $content, $relative );

			if ( isset( $this->linked_assets_copied[ $relative ] ) ) {
				foreach ( $rewritten['assets'] as $asset_url ) {
					$asset_urls[ $asset_url ] = $asset_url;
				}
			}

			$this->write_file( $path, $rewritten['content'], false );
		}

		return array_values( $asset_urls );
	}

	/**
	 * Write a file and increment count.
	 *
	 * @param string $path          Path.
	 * @param string $contents      Contents.
	 * @param bool   $increment     Whether to increment the export count.
	 * @throws Exception When writing fails.
	 */
	private function write_file( $path, $contents, $increment = true ) {
		$path = wp_normalize_path( $path );

		if ( SSGWP_Path_Utils::has_parent_segment( $path ) || ! $this->is_inside_export_root( $path ) ) {
			throw new Exception( 'Refusing to write outside of the export directory.' );
		}

		if ( ! wp_mkdir_p( dirname( $path ) ) ) {
			throw new Exception( 'Could not create a directory while writing the static export.' );
		}

		$directory = realpath( dirname( $path ) );

		if ( false === $directory || ! $this->is_inside_export_root( $directory ) ) {
			throw new Exception( 'Refusing to write outside of the export directory.' );
		}

		if ( false === file_put_contents( $path, $contents ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			throw new Exception( sprintf( 'Could not write %s.', $path ) );
		}

		if ( $increment ) {
			++$this->files_exported;
		}
	}

	/**
	 * Determine whether a path is inside the current export root.
	 *
	 * @param string $path Path.
	 * @return bool
	 */
	private function is_inside_export_root( $path ) {
		if ( '' === $this->current_output_dir ) {
			return true;
		}

		return SSGWP_Path_Utils::is_path_inside_directory( $path, $this->current_output_dir );
	}

	/**
	 * Create a temporary working directory.
	 *
	 * @return string
	 * @throws Exception When directory creation fails.
	 */
	private function make_temp_dir() {
		$base = trailingslashit( get_temp_dir() ) . 'static-site-generator-' . wp_generate_uuid4();

		if ( ! wp_mkdir_p( $base ) ) {
			throw new Exception( 'Could not create a temporary export directory.' );
		}

		return wp_normalize_path( $base );
	}

	/**
	 * Zip a directory.
	 *
	 * @param string $source_dir  Source directory.
	 * @param string $output_file Output ZIP path.
	 * @throws Exception When zipping fails.
	 */
	private function zip_directory( $source_dir, $output_file ) {
		$zip = new ZipArchive();

		if ( true !== $zip->open( $output_file, ZipArchive::CREATE | ZipArchive::OVERWRITE ) ) {
			throw new Exception( 'Could not open the export zip for writing.' );
		}

		$source_dir = trailingslashit( wp_normalize_path( $source_dir ) );
		$iterator   = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $source_dir, FilesystemIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::LEAVES_ONLY
		);

		foreach ( $iterator as $file ) {
			if ( ! $file->isFile() ) {
				continue;
			}

			$path     = wp_normalize_path( $file->getPathname() );
			$relative = ltrim( str_replace( $source_dir, '', $path ), '/' );
			$zip->addFile( $path, $relative );
		}

		$zip->close();
	}

	/**
	 * Delete a directory recursively.
	 *
	 * @param string $directory Directory path.
	 */
	private function delete_directory( $directory ) {
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
}
