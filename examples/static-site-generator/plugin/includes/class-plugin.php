<?php
/**
 * Admin, request, and WP-CLI integration.
 *
 * @package PlaygroundStaticSiteGenerator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the exporter into WordPress.
 */
final class SSGWP_Plugin {
	/**
	 * Register hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_admin_page' ) );
		add_action( 'admin_post_ssgwp_export', array( __CLASS__, 'handle_export_download' ) );
		add_action( 'wp_ajax_ssgwp_export_progress', array( __CLASS__, 'handle_progress_request' ) );
		add_filter( 'show_admin_bar', array( __CLASS__, 'hide_admin_bar_during_export' ), 999 );

		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			WP_CLI::add_command( 'static-site export', array( __CLASS__, 'wp_cli_export' ) );
		}
	}

	/**
	 * Add Tools page.
	 */
	public static function register_admin_page() {
		add_management_page(
			__( 'Static Site Generator', 'playground-static-site-generator' ),
			__( 'Static Site Generator', 'playground-static-site-generator' ),
			'manage_options',
			'playground-static-site-generator',
			array( __CLASS__, 'render_admin_page' )
		);
	}

	/**
	 * Hide the admin bar in pages requested by the exporter.
	 *
	 * @param bool $show Whether to show the admin bar.
	 * @return bool
	 */
	public static function hide_admin_bar_during_export( $show ) {
		if ( isset( $_GET['ssgwp_export'] ) || isset( $_SERVER['HTTP_X_STATIC_SITE_GENERATOR'] ) ) {
			return false;
		}

		return $show;
	}

	/**
	 * Render the admin page.
	 */
	public static function render_admin_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to export this site.', 'playground-static-site-generator' ) );
		}

		$job_id         = self::create_export_job_id();
		$progress_nonce = wp_create_nonce( 'ssgwp_export_progress_' . $job_id );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Static Site Generator', 'playground-static-site-generator' ); ?></h1>
			<p><?php esc_html_e( 'Export public WordPress pages and frontend assets as a static zip that can be hosted anywhere.', 'playground-static-site-generator' ); ?></p>

			<form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post" id="ssgwp-export-form" target="ssgwp-export-download-frame">
				<input type="hidden" name="action" value="ssgwp_export" />
				<input type="hidden" name="export_job_id" id="ssgwp_export_job_id" value="<?php echo esc_attr( $job_id ); ?>" />
				<input type="hidden" name="progress_nonce" id="ssgwp_progress_nonce" value="<?php echo esc_attr( $progress_nonce ); ?>" />
				<?php wp_nonce_field( 'ssgwp_export' ); ?>

				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="ssgwp_url_mode"><?php esc_html_e( 'URL mode', 'playground-static-site-generator' ); ?></label></th>
						<td>
							<select name="url_mode" id="ssgwp_url_mode">
								<option value="relative" selected><?php esc_html_e( 'Relative URLs', 'playground-static-site-generator' ); ?></option>
								<option value="root"><?php esc_html_e( 'Root-relative URLs', 'playground-static-site-generator' ); ?></option>
								<option value="absolute"><?php esc_html_e( 'Absolute URLs', 'playground-static-site-generator' ); ?></option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="ssgwp_max_pages"><?php esc_html_e( 'Maximum pages', 'playground-static-site-generator' ); ?></label></th>
						<td><input type="number" min="1" max="5000" step="1" name="max_pages" id="ssgwp_max_pages" value="500" /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Assets', 'playground-static-site-generator' ); ?></th>
						<td>
							<label><input type="checkbox" name="copy_uploads" value="1" checked /> <?php esc_html_e( 'Uploads', 'playground-static-site-generator' ); ?></label><br />
							<label><input type="checkbox" name="copy_theme" value="1" checked /> <?php esc_html_e( 'Active theme', 'playground-static-site-generator' ); ?></label><br />
							<label><input type="checkbox" name="copy_plugins" value="1" checked /> <?php esc_html_e( 'Active plugin assets', 'playground-static-site-generator' ); ?></label><br />
							<label><input type="checkbox" name="copy_core_assets" value="1" checked /> <?php esc_html_e( 'WordPress frontend assets', 'playground-static-site-generator' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Discovery', 'playground-static-site-generator' ); ?></th>
						<td>
							<label><input type="checkbox" name="crawl_links" value="1" checked /> <?php esc_html_e( 'Follow same-site links found in exported pages', 'playground-static-site-generator' ); ?></label>
						</td>
					</tr>
				</table>

				<?php submit_button( __( 'Download Static Site ZIP', 'playground-static-site-generator' ) ); ?>
			</form>
			<iframe name="ssgwp-export-download-frame" title="<?php esc_attr_e( 'Static export download', 'playground-static-site-generator' ); ?>" hidden></iframe>
			<div
				id="ssgwp-export-progress"
				class="notice notice-info"
				aria-live="polite"
				hidden
				data-started="<?php esc_attr_e( 'Export started. Preparing pages for download...', 'playground-static-site-generator' ); ?>"
				data-waiting="<?php esc_attr_e( 'Waiting for export progress...', 'playground-static-site-generator' ); ?>"
				data-failed="<?php esc_attr_e( 'Could not read export progress. The download may still be running.', 'playground-static-site-generator' ); ?>"
			>
				<p id="ssgwp-export-progress-message"></p>
			</div>
			<script>
				(function() {
					var form = document.getElementById( 'ssgwp-export-form' );
					var panel = document.getElementById( 'ssgwp-export-progress' );
					var message = document.getElementById( 'ssgwp-export-progress-message' );
					var jobId = document.getElementById( 'ssgwp_export_job_id' );
					var nonce = document.getElementById( 'ssgwp_progress_nonce' );
					var timer = null;

					if ( ! form || ! panel || ! message || ! jobId || ! nonce ) {
						return;
					}

					function setMessage( text ) {
						message.textContent = text || panel.getAttribute( 'data-waiting' );
					}

					function stopPolling() {
						if ( timer ) {
							window.clearInterval( timer );
							timer = null;
						}
					}

					function pollProgress() {
						if ( ! window.fetch || ! window.ajaxurl ) {
							setMessage( panel.getAttribute( 'data-failed' ) );
							stopPolling();
							return;
						}

						var url = window.ajaxurl + '?action=ssgwp_export_progress'
							+ '&job_id=' + window.encodeURIComponent( jobId.value )
							+ '&nonce=' + window.encodeURIComponent( nonce.value )
							+ '&_=' + Date.now();

						window.fetch( url, { credentials: 'same-origin' } )
							.then( function( response ) {
								return response.json();
							} )
							.then( function( response ) {
								var data = response && response.success ? response.data : null;

								if ( ! data ) {
									setMessage( panel.getAttribute( 'data-failed' ) );
									return;
								}

								setMessage( data.message );

								if (
									'failed' === data.stage ||
									'zip_complete' === data.stage
								) {
									stopPolling();
								}
							} )
							.catch( function() {
								setMessage( panel.getAttribute( 'data-failed' ) );
							} );
					}

					form.addEventListener( 'submit', function() {
						panel.hidden = false;
						setMessage( panel.getAttribute( 'data-started' ) );
						stopPolling();
						pollProgress();
						timer = window.setInterval( pollProgress, 1000 );
					} );
				}());
			</script>
		</div>
		<?php
	}

	/**
	 * Handle admin export download.
	 */
	public static function handle_export_download() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to export this site.', 'playground-static-site-generator' ) );
		}

		check_admin_referer( 'ssgwp_export' );

		$request     = wp_unslash( $_POST );
		$args        = self::request_to_export_args( $request );
		$job_id      = isset( $request['export_job_id'] ) ? self::sanitize_export_job_id( $request['export_job_id'] ) : '';
		$upload_dir  = wp_get_upload_dir();
		$temp_parent = trailingslashit( $upload_dir['basedir'] ) . 'static-site-generator';

		if ( ! wp_mkdir_p( $temp_parent ) ) {
			wp_die( esc_html__( 'Could not create a temporary export directory.', 'playground-static-site-generator' ) );
		}

		$output_file = trailingslashit( $temp_parent ) . 'static-site-' . gmdate( 'Ymd-His' ) . '.zip';

		try {
			if ( '' !== $job_id ) {
				self::store_progress_event(
					$job_id,
					array(
						'stage'   => 'started',
						'message' => __( 'Export started. Preparing pages for download...', 'playground-static-site-generator' ),
					)
				);
				$args['progress_callback'] = self::create_progress_callback( $job_id );
			}

			ssgwp_export_static_site( $output_file, $args );
		} catch ( Exception $exception ) {
			if ( '' !== $job_id ) {
				self::store_progress_event(
					$job_id,
					array(
						'stage'   => 'failed',
						'message' => $exception->getMessage(),
					)
				);
			}

			wp_die( esc_html( $exception->getMessage() ) );
		}

		if ( ! is_readable( $output_file ) ) {
			wp_die( esc_html__( 'The export zip was not created.', 'playground-static-site-generator' ) );
		}

		while ( ob_get_level() ) {
			ob_end_clean();
		}

		header( 'Content-Type: application/zip' );
		header( 'Content-Disposition: attachment; filename="static-site.zip"' );
		header( 'Content-Length: ' . filesize( $output_file ) );
		header( 'Pragma: public' );
		header( 'Cache-Control: must-revalidate, post-check=0, pre-check=0' );

		readfile( $output_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		unlink( $output_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
		exit;
	}

	/**
	 * Return export progress for the current admin user.
	 */
	public static function handle_progress_request() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'You do not have permission to export this site.', 'playground-static-site-generator' ) ),
				403
			);
		}

		$job_id = isset( $_GET['job_id'] ) ? self::sanitize_export_job_id( wp_unslash( $_GET['job_id'] ) ) : '';

		if ( '' === $job_id || ! check_ajax_referer( 'ssgwp_export_progress_' . $job_id, 'nonce', false ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Invalid export progress request.', 'playground-static-site-generator' ) ),
				403
			);
		}

		$event = get_transient( self::progress_transient_key( $job_id ) );

		if ( ! is_array( $event ) ) {
			$event = self::normalize_progress_event(
				array(
					'stage'   => 'waiting',
					'message' => __( 'Waiting for export progress...', 'playground-static-site-generator' ),
				)
			);
		}

		wp_send_json_success( $event );
	}

	/**
	 * Convert an admin request to exporter args.
	 *
	 * @param array $request Request data.
	 * @return array
	 */
	private static function request_to_export_args( array $request ) {
		return array(
			'url_mode'         => isset( $request['url_mode'] ) ? sanitize_key( $request['url_mode'] ) : 'relative',
			'max_pages'        => isset( $request['max_pages'] ) ? max( 1, min( 5000, absint( $request['max_pages'] ) ) ) : 500,
			'copy_uploads'     => ! empty( $request['copy_uploads'] ),
			'copy_theme'       => ! empty( $request['copy_theme'] ),
			'copy_plugins'     => ! empty( $request['copy_plugins'] ),
			'copy_core_assets' => ! empty( $request['copy_core_assets'] ),
			'crawl_links'      => ! empty( $request['crawl_links'] ),
			'fetch_mode'       => 'internal',
		);
	}

	/**
	 * Create an opaque progress job id for an admin export request.
	 *
	 * @return string Job id.
	 */
	private static function create_export_job_id() {
		if ( function_exists( 'wp_generate_uuid4' ) ) {
			return wp_generate_uuid4();
		}

		return str_replace( '.', '-', uniqid( 'ssgwp-', true ) );
	}

	/**
	 * Create a progress callback that stores the latest export event.
	 *
	 * @param string $job_id Export job id.
	 * @return callable Progress callback.
	 */
	private static function create_progress_callback( $job_id ) {
		return static function ( array $event ) use ( $job_id ) {
			self::store_progress_event( $job_id, $event );
		};
	}

	/**
	 * Store the latest export progress event for admin polling.
	 *
	 * @param string $job_id Export job id.
	 * @param array  $event  Progress event.
	 */
	private static function store_progress_event( $job_id, array $event ) {
		$job_id = self::sanitize_export_job_id( $job_id );

		if ( '' === $job_id ) {
			return;
		}

		$event = self::normalize_progress_event( $event );
		set_transient( self::progress_transient_key( $job_id ), $event, HOUR_IN_SECONDS );
	}

	/**
	 * Normalize progress event data before sending it to the browser.
	 *
	 * @param array $event Progress event.
	 * @return array Normalized event.
	 */
	private static function normalize_progress_event( array $event ) {
		return array(
			'stage'          => isset( $event['stage'] ) ? sanitize_key( $event['stage'] ) : '',
			'message'        => isset( $event['message'] ) ? sanitize_text_field( $event['message'] ) : '',
			'pages_exported' => isset( $event['pages_exported'] ) ? (int) $event['pages_exported'] : 0,
			'files_exported' => isset( $event['files_exported'] ) ? (int) $event['files_exported'] : 0,
			'context'        => isset( $event['context'] ) && is_array( $event['context'] ) ? $event['context'] : array(),
		);
	}

	/**
	 * Build the transient key used to store export progress.
	 *
	 * @param string $job_id Export job id.
	 * @return string Transient key.
	 */
	private static function progress_transient_key( $job_id ) {
		return 'ssgwp_export_' . get_current_user_id() . '_' . md5( $job_id );
	}

	/**
	 * Sanitize an export job id.
	 *
	 * @param string $job_id Export job id.
	 * @return string Sanitized job id.
	 */
	private static function sanitize_export_job_id( $job_id ) {
		$job_id = strtolower( sanitize_text_field( (string) $job_id ) );
		$job_id = preg_replace( '/[^a-z0-9_-]/', '', $job_id );

		if ( ! is_string( $job_id ) ) {
			return '';
		}

		return substr( $job_id, 0, 64 );
	}

	/**
	 * WP-CLI command: wp static-site export --output=dist/site.zip.
	 *
	 * @param array $args Positional args.
	 * @param array $assoc_args Associative args.
	 */
	public static function wp_cli_export( $args, $assoc_args ) {
		$output = isset( $assoc_args['output'] ) ? $assoc_args['output'] : 'static-site.zip';
		$output = wp_normalize_path( $output );

		if ( ! path_is_absolute( $output ) ) {
			$output = trailingslashit( getcwd() ) . $output;
		}

		$export_args = array(
			'url_mode'         => isset( $assoc_args['url-mode'] ) ? sanitize_key( $assoc_args['url-mode'] ) : 'relative',
			'max_pages'        => isset( $assoc_args['max-pages'] ) ? max( 1, absint( $assoc_args['max-pages'] ) ) : 500,
			'copy_uploads'     => ! isset( $assoc_args['skip-uploads'] ),
			'copy_theme'       => ! isset( $assoc_args['skip-theme'] ),
			'copy_plugins'     => ! isset( $assoc_args['skip-plugins'] ),
			'copy_core_assets' => ! isset( $assoc_args['skip-core-assets'] ),
			'crawl_links'      => ! isset( $assoc_args['no-crawl'] ),
			'fetch_mode'       => isset( $assoc_args['fetch-mode'] ) ? sanitize_key( $assoc_args['fetch-mode'] ) : 'auto',
			'progress_callback' => array( __CLASS__, 'wp_cli_report_progress' ),
		);

		$exporter = new SSGWP_Static_Exporter();
		$result   = $exporter->export_to_zip( $output, $export_args );

		WP_CLI::success(
			sprintf(
				'Exported %1$d pages and %2$d files to %3$s.',
				(int) $result['pages_exported'],
				(int) $result['files_exported'],
				$output
			)
		);

		if ( ! empty( $result['warnings'] ) ) {
			foreach ( $result['warnings'] as $warning ) {
				WP_CLI::warning( $warning );
			}
		}
	}

	/**
	 * Report export progress in WP-CLI.
	 *
	 * @param array $event Progress event.
	 */
	public static function wp_cli_report_progress( array $event ) {
		$stage = isset( $event['stage'] ) ? (string) $event['stage'] : '';

		if ( 'render_page' === $stage ) {
			$context = isset( $event['context'] ) && is_array( $event['context'] ) ? $event['context'] : array();
			$current = isset( $context['queue_position'] ) ? (int) $context['queue_position'] : (int) $event['pages_exported'];
			$total = isset( $context['queue_total'] ) ? (int) $context['queue_total'] : 0;
			$url = isset( $context['url'] ) ? (string) $context['url'] : '';

			if ( $total > 0 && '' !== $url ) {
				WP_CLI::log( sprintf( '[%1$d/%2$d] %3$s', $current, $total, $url ) );
				return;
			}
		}

		if ( isset( $event['message'] ) && '' !== $event['message'] ) {
			WP_CLI::log( (string) $event['message'] );
		}
	}
}
