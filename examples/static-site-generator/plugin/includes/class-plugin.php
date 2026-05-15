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
		add_action( 'admin_post_ssgwp_download_export', array( __CLASS__, 'handle_existing_export_download' ) );
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

		$job_id            = self::create_export_job_id();
		$progress_nonce    = wp_create_nonce( 'ssgwp_export_progress_' . $job_id );
		$latest_export     = self::get_latest_export_progress();
		$active_job_id     = isset( $latest_export['job_id'] ) ? $latest_export['job_id'] : '';
		$active_run_id     = isset( $latest_export['run_id'] ) ? $latest_export['run_id'] : '';
		$active_nonce      = '' !== $active_job_id ? wp_create_nonce( 'ssgwp_export_progress_' . $active_job_id ) : '';
		$initial_progress  = isset( $latest_export['state'] )
			? self::prepare_progress_response( $latest_export['state'], $active_job_id, $active_run_id )
			: null;
		$initial_is_active = is_array( $initial_progress ) && empty( $initial_progress['is_terminal'] );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Static Site Generator', 'playground-static-site-generator' ); ?></h1>
			<p><?php esc_html_e( 'Export public WordPress pages and frontend assets as a static zip that can be hosted anywhere.', 'playground-static-site-generator' ); ?></p>

			<form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post" id="ssgwp-export-form" target="ssgwp-export-download-frame">
				<input type="hidden" name="action" value="ssgwp_export" />
				<input type="hidden" name="export_job_id" id="ssgwp_export_job_id" value="<?php echo esc_attr( $job_id ); ?>" />
				<input type="hidden" name="export_run_id" id="ssgwp_export_run_id" value="" />
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

				<?php
				submit_button(
					__( 'Download Static Site ZIP', 'playground-static-site-generator' ),
					'primary',
					'submit',
					true,
					array( 'id' => 'ssgwp-export-submit' )
				);
				?>
			</form>
			<iframe name="ssgwp-export-download-frame" title="<?php esc_attr_e( 'Static export download', 'playground-static-site-generator' ); ?>" hidden></iframe>
			<style>
				#ssgwp-export-progress-meter {
					background: #dcdcde;
					border-radius: 999px;
					height: 12px;
					margin: 8px 0;
					overflow: hidden;
					width: 100%;
				}
				#ssgwp-export-progress-bar {
					background: #2271b1;
					height: 100%;
					transition: width 160ms linear;
					width: 0;
				}
				#ssgwp-export-progress-log {
					margin-left: 1.5em;
					max-height: 14em;
					overflow: auto;
				}
				#ssgwp-export-progress-log li {
					margin-bottom: 4px;
				}
			</style>
			<div
				id="ssgwp-export-progress"
				class="notice notice-info"
				aria-live="polite"
				<?php echo is_array( $initial_progress ) ? '' : 'hidden'; ?>
				data-active-job-id="<?php echo esc_attr( $active_job_id ); ?>"
				data-active-run-id="<?php echo esc_attr( $active_run_id ); ?>"
				data-active-nonce="<?php echo esc_attr( $active_nonce ); ?>"
				data-active="<?php echo $initial_is_active ? '1' : '0'; ?>"
				data-started="<?php esc_attr_e( 'Export started. Preparing pages for download...', 'playground-static-site-generator' ); ?>"
				data-waiting="<?php esc_attr_e( 'Waiting for export progress...', 'playground-static-site-generator' ); ?>"
				data-failed="<?php esc_attr_e( 'Could not read export progress. The download may still be running.', 'playground-static-site-generator' ); ?>"
			>
				<p><strong id="ssgwp-export-progress-message"></strong> <span id="ssgwp-export-progress-percent">0%</span></p>
				<div
					id="ssgwp-export-progress-meter"
					role="progressbar"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow="0"
				>
					<div id="ssgwp-export-progress-bar"></div>
				</div>
				<p>
					<a id="ssgwp-export-download-link" href="#" hidden>
						<?php esc_html_e( 'Download the completed static ZIP', 'playground-static-site-generator' ); ?>
					</a>
				</p>
				<details>
					<summary><?php esc_html_e( 'Export log', 'playground-static-site-generator' ); ?></summary>
					<ol id="ssgwp-export-progress-log"></ol>
				</details>
			</div>
			<script>
				(function() {
					var form = document.getElementById( 'ssgwp-export-form' );
					var panel = document.getElementById( 'ssgwp-export-progress' );
					var message = document.getElementById( 'ssgwp-export-progress-message' );
					var percent = document.getElementById( 'ssgwp-export-progress-percent' );
					var meter = document.getElementById( 'ssgwp-export-progress-meter' );
					var bar = document.getElementById( 'ssgwp-export-progress-bar' );
					var log = document.getElementById( 'ssgwp-export-progress-log' );
					var downloadLink = document.getElementById( 'ssgwp-export-download-link' );
					var jobId = document.getElementById( 'ssgwp_export_job_id' );
					var runId = document.getElementById( 'ssgwp_export_run_id' );
					var nonce = document.getElementById( 'ssgwp_progress_nonce' );
					var submitButton = document.getElementById( 'ssgwp-export-submit' );
					var timer = null;
					var activeJobId = panel ? panel.getAttribute( 'data-active-job-id' ) : '';
					var activeRunId = panel ? panel.getAttribute( 'data-active-run-id' ) : '';
					var activeNonce = panel ? panel.getAttribute( 'data-active-nonce' ) : '';
					var initialProgress = <?php echo wp_json_encode(
						$initial_progress,
						JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
					); ?>;

					if (
						! form ||
						! panel ||
						! message ||
						! percent ||
						! meter ||
						! bar ||
						! log ||
						! downloadLink ||
						! jobId ||
						! runId ||
						! nonce
					) {
						return;
					}

					function setMessage( text ) {
						message.textContent = text || panel.getAttribute( 'data-waiting' );
					}

					function setPercent( value ) {
						var next = Math.max( 0, Math.min( 100, parseInt( value, 10 ) || 0 ) );

						percent.textContent = next + '%';
						meter.setAttribute( 'aria-valuenow', String( next ) );
						bar.style.width = next + '%';
					}

					function setRunning( running ) {
						if ( submitButton ) {
							submitButton.disabled = !! running;
						}
					}

					function stopPolling() {
						if ( timer ) {
							window.clearInterval( timer );
							timer = null;
						}
					}

					function isTerminal( data ) {
						return !! (
							data &&
							(
								data.is_terminal ||
								'failed' === data.stage ||
								'zip_complete' === data.stage ||
								'download_ready' === data.stage
							)
						);
					}

					function renderLog( entries ) {
						log.textContent = '';

						if ( ! entries || ! entries.length ) {
							return;
						}

						entries.forEach( function( entry ) {
							var item = document.createElement( 'li' );
							var itemPercent = parseInt( entry.percent, 10 );
							var text = entry.message || '';

							if ( ! isNaN( itemPercent ) ) {
								text = itemPercent + '% - ' + text;
							}

							item.textContent = text;
							log.appendChild( item );
						} );
					}

					function renderProgress( data ) {
						if ( ! data ) {
							return;
						}

						panel.hidden = false;
						panel.classList.toggle( 'notice-error', 'failed' === data.stage );
						panel.classList.toggle(
							'notice-success',
							'zip_complete' === data.stage || 'download_ready' === data.stage
						);
						panel.classList.toggle(
							'notice-info',
							'failed' !== data.stage &&
								'zip_complete' !== data.stage &&
								'download_ready' !== data.stage
						);
						setMessage( data.message );
						setPercent( data.percent );
						renderLog( data.log );

						if ( data.download_url ) {
							downloadLink.href = data.download_url;
							downloadLink.hidden = false;
						} else {
							downloadLink.hidden = true;
						}

						if ( isTerminal( data ) ) {
							stopPolling();
							setRunning( false );
						} else {
							setRunning( true );
						}
					}

					function createRunId() {
						var randomPart = Math.random().toString( 36 ).slice( 2 );

						if ( window.crypto && window.crypto.getRandomValues ) {
							var values = new Uint32Array( 2 );
							window.crypto.getRandomValues( values );
							randomPart = values[0].toString( 36 ) + values[1].toString( 36 );
						}

						return 'run-' + Date.now().toString( 36 ) + '-' + randomPart;
					}

					function pollProgress() {
						if ( ! window.fetch || ! window.ajaxurl || ! activeJobId || ! activeNonce ) {
							setMessage( panel.getAttribute( 'data-failed' ) );
							stopPolling();
							return;
						}

						var url = window.ajaxurl + '?action=ssgwp_export_progress'
							+ '&job_id=' + window.encodeURIComponent( activeJobId )
							+ '&run_id=' + window.encodeURIComponent( activeRunId )
							+ '&nonce=' + window.encodeURIComponent( activeNonce )
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

								renderProgress( data );
							} )
							.catch( function() {
								setMessage( panel.getAttribute( 'data-failed' ) );
							} );
					}

					form.addEventListener( 'submit', function() {
						runId.value = createRunId();
						activeJobId = jobId.value;
						activeRunId = runId.value;
						activeNonce = nonce.value;
						panel.hidden = false;
						downloadLink.hidden = true;
						renderProgress( {
							stage: 'started',
							message: panel.getAttribute( 'data-started' ),
							percent: 1,
							log: [],
							is_terminal: false
						} );
						stopPolling();
						pollProgress();
						timer = window.setInterval( pollProgress, 1000 );
					} );

					if ( initialProgress ) {
						renderProgress( initialProgress );
					}

					if ( '1' === panel.getAttribute( 'data-active' ) ) {
						pollProgress();
						timer = window.setInterval( pollProgress, 1000 );
					}
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

		ignore_user_abort( true );
		check_admin_referer( 'ssgwp_export' );

		$request     = wp_unslash( $_POST );
		$args        = self::request_to_export_args( $request );
		$job_id      = isset( $request['export_job_id'] ) ? self::sanitize_export_job_id( $request['export_job_id'] ) : '';
		$run_id      = isset( $request['export_run_id'] ) ? self::sanitize_export_run_id( $request['export_run_id'] ) : '';
		$temp_parent = self::get_export_temp_directory();

		if ( ! wp_mkdir_p( $temp_parent ) ) {
			wp_die( esc_html__( 'Could not create a temporary export directory.', 'playground-static-site-generator' ) );
		}

		self::cleanup_old_exports( $temp_parent );
		$output_file = trailingslashit( $temp_parent ) . 'static-site-' . gmdate( 'Ymd-His' ) . '.zip';

		try {
			if ( '' !== $job_id ) {
				self::store_progress_event(
					$job_id,
					array(
						'stage'   => 'started',
						'message' => __( 'Export started. Preparing pages for download...', 'playground-static-site-generator' ),
					),
					$run_id
				);
				$args['progress_callback'] = self::create_progress_callback( $job_id, $run_id );
			}

			ssgwp_export_static_site( $output_file, $args );

			if ( '' !== $job_id ) {
				self::store_progress_event(
					$job_id,
					array(
						'stage'   => 'download_ready',
						'message' => __( 'Static export ZIP is ready to download.', 'playground-static-site-generator' ),
						'context' => array( 'output_file' => $output_file ),
					),
					$run_id
				);
			}
		} catch ( Exception $exception ) {
			if ( '' !== $job_id ) {
				self::store_progress_event(
					$job_id,
					array(
						'stage'   => 'failed',
						'message' => $exception->getMessage(),
					),
					$run_id
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

		if ( '' === $job_id ) {
			unlink( $output_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
		}
		exit;
	}

	/**
	 * Download the latest completed export for a user after an admin reload.
	 */
	public static function handle_existing_export_download() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to export this site.', 'playground-static-site-generator' ) );
		}

		$job_id = isset( $_GET['job_id'] ) ? self::sanitize_export_job_id( wp_unslash( $_GET['job_id'] ) ) : '';
		$run_id = isset( $_GET['run_id'] ) ? self::sanitize_export_run_id( wp_unslash( $_GET['run_id'] ) ) : '';

		if ( '' === $job_id || ! check_admin_referer( 'ssgwp_download_export_' . $job_id . '_' . $run_id, 'nonce' ) ) {
			wp_die( esc_html__( 'Invalid export download request.', 'playground-static-site-generator' ) );
		}

		$state = self::get_progress_state( $job_id, $run_id );
		$output_file = self::get_download_file_from_progress_state( $state );

		if ( '' === $output_file || ! is_readable( $output_file ) ) {
			wp_die( esc_html__( 'The completed static export is no longer available.', 'playground-static-site-generator' ) );
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
		$run_id = isset( $_GET['run_id'] ) ? self::sanitize_export_run_id( wp_unslash( $_GET['run_id'] ) ) : '';

		if ( '' === $job_id || ! check_ajax_referer( 'ssgwp_export_progress_' . $job_id, 'nonce', false ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Invalid export progress request.', 'playground-static-site-generator' ) ),
				403
			);
		}

		$event = self::get_progress_state( $job_id, $run_id );

		if ( ! is_array( $event ) ) {
			$event = self::normalize_progress_event(
				array(
					'stage'   => 'waiting',
					'message' => __( 'Waiting for export progress...', 'playground-static-site-generator' ),
				)
			);
		}

		wp_send_json_success( self::prepare_progress_response( $event, $job_id, $run_id ) );
	}

	/**
	 * Return the latest export progress state remembered for this user.
	 *
	 * @return array<string,mixed>|null Export metadata and progress state.
	 */
	private static function get_latest_export_progress() {
		$latest = get_user_meta( get_current_user_id(), self::latest_export_meta_key(), true );

		if ( ! is_array( $latest ) ) {
			return null;
		}

		$job_id = isset( $latest['job_id'] ) ? self::sanitize_export_job_id( $latest['job_id'] ) : '';
		$run_id = isset( $latest['run_id'] ) ? self::sanitize_export_run_id( $latest['run_id'] ) : '';

		if ( '' === $job_id ) {
			return null;
		}

		$state = self::get_progress_state( $job_id, $run_id );

		if ( ! is_array( $state ) ) {
			return null;
		}

		return array(
			'job_id' => $job_id,
			'run_id' => $run_id,
			'state'  => $state,
		);
	}

	/**
	 * Prepare progress state for JSON responses and initial page hydration.
	 *
	 * @param array  $state  Progress state.
	 * @param string $job_id Export job id.
	 * @param string $run_id Export run id.
	 * @return array Progress response.
	 */
	private static function prepare_progress_response( array $state, $job_id, $run_id ) {
		$state = self::normalize_progress_state( $state );
		$download_file = self::get_download_file_from_progress_state( $state );

		if ( '' !== $download_file && is_readable( $download_file ) ) {
			$state['download_url'] = self::build_export_download_url( $job_id, $run_id );
		}

		return $state;
	}

	/**
	 * Get a stored progress state.
	 *
	 * @param string $job_id Export job id.
	 * @param string $run_id Export run id.
	 * @return array<string,mixed>|false Stored state, or false when missing.
	 */
	private static function get_progress_state( $job_id, $run_id = '' ) {
		return get_transient( self::progress_transient_key( $job_id, $run_id ) );
	}

	/**
	 * Build a nonce-protected URL for downloading a completed export.
	 *
	 * @param string $job_id Export job id.
	 * @param string $run_id Export run id.
	 * @return string Download URL.
	 */
	private static function build_export_download_url( $job_id, $run_id ) {
		$url = add_query_arg(
			array(
				'action' => 'ssgwp_download_export',
				'job_id' => $job_id,
				'run_id' => $run_id,
			),
			admin_url( 'admin-post.php' )
		);

		return wp_nonce_url( $url, 'ssgwp_download_export_' . $job_id . '_' . $run_id, 'nonce' );
	}

	/**
	 * Return a safe completed export file path from progress state.
	 *
	 * @param array|false $state Progress state.
	 * @return string Export file path, or empty string when unavailable.
	 */
	private static function get_download_file_from_progress_state( $state ) {
		if ( ! is_array( $state ) || empty( $state['context']['output_file'] ) ) {
			return '';
		}

		$output_file = wp_normalize_path( $state['context']['output_file'] );
		$temp_parent = wp_normalize_path( self::get_export_temp_directory() );
		$real_output = realpath( $output_file );
		$real_parent = realpath( $temp_parent );

		if ( false === $real_output || false === $real_parent ) {
			return '';
		}

		$real_output = wp_normalize_path( $real_output );
		$temp_parent = trailingslashit( wp_normalize_path( $real_parent ) );

		if ( 0 !== strpos( $real_output, $temp_parent ) ) {
			return '';
		}

		if ( 'zip' !== strtolower( pathinfo( $real_output, PATHINFO_EXTENSION ) ) ) {
			return '';
		}

		return $real_output;
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
	 * Return the admin ZIP scratch directory.
	 *
	 * Keeping transient ZIPs outside uploads prevents old failed downloads from
	 * being copied into later static exports when upload assets are included.
	 *
	 * @return string Directory path.
	 */
	private static function get_export_temp_directory() {
		return trailingslashit( get_temp_dir() ) . 'static-site-generator';
	}

	/**
	 * Remove old retained ZIP downloads from previous admin exports.
	 *
	 * @param string $temp_parent Export temp directory.
	 */
	private static function cleanup_old_exports( $temp_parent ) {
		$files = glob( trailingslashit( $temp_parent ) . 'static-site-*.zip' );

		if ( ! is_array( $files ) ) {
			return;
		}

		foreach ( $files as $file ) {
			if ( ! is_file( $file ) ) {
				continue;
			}

			$mtime = filemtime( $file );

			if ( false !== $mtime && $mtime < time() - HOUR_IN_SECONDS ) {
				unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
			}
		}
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
	 * @param string $run_id Export run id.
	 * @return callable Progress callback.
	 */
	private static function create_progress_callback( $job_id, $run_id = '' ) {
		return static function ( array $event ) use ( $job_id, $run_id ) {
			self::store_progress_event( $job_id, $event, $run_id );
		};
	}

	/**
	 * Store the latest export progress event for admin polling.
	 *
	 * @param string $job_id Export job id.
	 * @param array  $event  Progress event.
	 * @param string $run_id Export run id.
	 */
	private static function store_progress_event( $job_id, array $event, $run_id = '' ) {
		$job_id = self::sanitize_export_job_id( $job_id );
		$run_id = self::sanitize_export_run_id( $run_id );

		if ( '' === $job_id ) {
			return;
		}

		$event = self::normalize_progress_event( $event );
		$state = self::normalize_progress_state( get_transient( self::progress_transient_key( $job_id, $run_id ) ) );
		$state = self::apply_progress_event_to_state( $state, $event );

		set_transient( self::progress_transient_key( $job_id, $run_id ), $state, HOUR_IN_SECONDS );
		update_user_meta(
			get_current_user_id(),
			self::latest_export_meta_key(),
			array(
				'job_id' => $job_id,
				'run_id' => $run_id,
			)
		);
	}

	/**
	 * Normalize progress event data before sending it to the browser.
	 *
	 * @param array $event Progress event.
	 * @return array Normalized event.
	 */
	private static function normalize_progress_event( array $event ) {
		return array(
			'time'           => isset( $event['time'] ) ? sanitize_text_field( $event['time'] ) : gmdate( 'c' ),
			'stage'          => isset( $event['stage'] ) ? sanitize_key( $event['stage'] ) : '',
			'message'        => isset( $event['message'] ) ? sanitize_text_field( $event['message'] ) : '',
			'pages_exported' => isset( $event['pages_exported'] ) ? (int) $event['pages_exported'] : 0,
			'files_exported' => isset( $event['files_exported'] ) ? (int) $event['files_exported'] : 0,
			'context'        => isset( $event['context'] ) && is_array( $event['context'] )
				? self::sanitize_progress_context( $event['context'] )
				: array(),
		);
	}

	/**
	 * Normalize the stored progress state shape.
	 *
	 * @param mixed $state Stored state.
	 * @return array Normalized state.
	 */
	private static function normalize_progress_state( $state ) {
		if ( ! is_array( $state ) ) {
			$state = array();
		}

		$context = isset( $state['context'] ) && is_array( $state['context'] )
			? self::sanitize_progress_context( $state['context'] )
			: array();
		$log     = isset( $state['log'] ) && is_array( $state['log'] ) ? $state['log'] : array();

		return array(
			'time'           => isset( $state['time'] ) ? sanitize_text_field( $state['time'] ) : gmdate( 'c' ),
			'stage'          => isset( $state['stage'] ) ? sanitize_key( $state['stage'] ) : 'waiting',
			'message'        => isset( $state['message'] ) ? sanitize_text_field( $state['message'] ) : '',
			'pages_exported' => isset( $state['pages_exported'] ) ? (int) $state['pages_exported'] : 0,
			'files_exported' => isset( $state['files_exported'] ) ? (int) $state['files_exported'] : 0,
			'context'        => $context,
			'percent'        => isset( $state['percent'] ) ? max( 0, min( 100, (int) $state['percent'] ) ) : 0,
			'log'            => self::normalize_progress_log( $log ),
			'is_terminal'    => ! empty( $state['is_terminal'] ),
		);
	}

	/**
	 * Apply one exporter event to the browser-facing progress state.
	 *
	 * @param array $state Previous state.
	 * @param array $event New event.
	 * @return array Updated state.
	 */
	private static function apply_progress_event_to_state( array $state, array $event ) {
		$percent = self::calculate_progress_percent( $event, $state );
		$state   = array_merge(
			$state,
			array(
				'time'           => $event['time'],
				'stage'          => $event['stage'],
				'message'        => $event['message'],
				'pages_exported' => $event['pages_exported'],
				'files_exported' => $event['files_exported'],
				'context'        => $event['context'],
				'percent'        => $percent,
				'is_terminal'    => self::is_terminal_progress_stage( $event['stage'] ),
			)
		);

		if ( self::should_log_progress_event( $event ) ) {
			$state['log'][] = array(
				'time'    => $event['time'],
				'stage'   => $event['stage'],
				'message' => $event['message'],
				'percent' => $percent,
			);
			$state['log'] = array_slice( $state['log'], -100 );
		}

		return self::normalize_progress_state( $state );
	}

	/**
	 * Estimate a monotonic export completion percentage from exporter events.
	 *
	 * @param array $event Current event.
	 * @param array $state Previous state.
	 * @return int Completion percentage.
	 */
	private static function calculate_progress_percent( array $event, array $state ) {
		$stage    = isset( $event['stage'] ) ? $event['stage'] : '';
		$context  = isset( $event['context'] ) && is_array( $event['context'] ) ? $event['context'] : array();
		$previous = isset( $state['percent'] ) ? (int) $state['percent'] : 0;
		$percent  = $previous;

		if ( in_array( $stage, array( 'render_page', 'page_exported', 'page_failed' ), true ) ) {
			$total = isset( $context['queue_total'] ) ? max( 1, (int) $context['queue_total'] ) : 1;

			if ( 'render_page' === $stage ) {
				$done = isset( $context['queue_position'] )
					? max( 0, (int) $context['queue_position'] - 1 )
					: (int) $event['pages_exported'];
			} else {
				$done = (int) $event['pages_exported'];
			}

			$percent = 5 + (int) floor( min( 1, $done / $total ) * 70 );
		} else {
			switch ( $stage ) {
				case 'waiting':
					$percent = 0;
					break;
				case 'started':
					$percent = 1;
					break;
				case 'discovered':
					$percent = 5;
					break;
				case 'copy_assets':
					$percent = 78;
					break;
				case 'copy_linked_assets':
					$percent = 82;
					break;
				case 'rewrite_assets':
					$pass    = isset( $context['pass'] ) ? max( 1, (int) $context['pass'] ) : 1;
					$percent = min( 94, 86 + $pass );
					break;
				case 'copy_text_asset_dependencies':
					$pass    = isset( $context['pass'] ) ? max( 1, (int) $context['pass'] ) : 1;
					$percent = min( 95, 89 + $pass );
					break;
				case 'complete':
					$percent = 96;
					break;
				case 'zip':
					$percent = 98;
					break;
				case 'zip_complete':
				case 'download_ready':
					$percent = 100;
					break;
				case 'failed':
					$percent = $previous;
					break;
			}
		}

		return max( $previous, max( 0, min( 100, (int) $percent ) ) );
	}

	/**
	 * Determine whether a progress event should appear in the completed log.
	 *
	 * @param array $event Progress event.
	 * @return bool Whether to log the event.
	 */
	private static function should_log_progress_event( array $event ) {
		return in_array(
			$event['stage'],
			array(
				'started',
				'discovered',
				'page_exported',
				'page_failed',
				'copy_assets',
				'copy_linked_assets',
				'rewrite_assets',
				'copy_text_asset_dependencies',
				'complete',
				'zip',
				'zip_complete',
				'download_ready',
				'failed',
			),
			true
		);
	}

	/**
	 * Determine whether a progress stage means polling can stop.
	 *
	 * @param string $stage Progress stage.
	 * @return bool Whether the stage is terminal.
	 */
	private static function is_terminal_progress_stage( $stage ) {
		return in_array( $stage, array( 'failed', 'zip_complete', 'download_ready' ), true );
	}

	/**
	 * Sanitize structured progress context recursively.
	 *
	 * @param array $context Progress context.
	 * @return array Sanitized context.
	 */
	private static function sanitize_progress_context( array $context ) {
		$sanitized = array();

		foreach ( $context as $key => $value ) {
			$key = sanitize_key( $key );

			if ( '' === $key ) {
				continue;
			}

			if ( is_array( $value ) ) {
				$sanitized[ $key ] = self::sanitize_progress_context( $value );
			} elseif ( is_bool( $value ) ) {
				$sanitized[ $key ] = $value;
			} elseif ( is_int( $value ) || is_float( $value ) ) {
				$sanitized[ $key ] = $value;
			} else {
				$sanitized[ $key ] = sanitize_text_field( (string) $value );
			}
		}

		return $sanitized;
	}

	/**
	 * Sanitize stored progress log entries.
	 *
	 * @param array $log Progress log.
	 * @return array Sanitized log.
	 */
	private static function normalize_progress_log( array $log ) {
		$normalized = array();

		foreach ( $log as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}

			$normalized[] = array(
				'time'    => isset( $entry['time'] ) ? sanitize_text_field( $entry['time'] ) : '',
				'stage'   => isset( $entry['stage'] ) ? sanitize_key( $entry['stage'] ) : '',
				'message' => isset( $entry['message'] ) ? sanitize_text_field( $entry['message'] ) : '',
				'percent' => isset( $entry['percent'] ) ? max( 0, min( 100, (int) $entry['percent'] ) ) : 0,
			);
		}

		return array_slice( $normalized, -100 );
	}

	/**
	 * Build the user meta key for the latest export pointer.
	 *
	 * @return string User meta key.
	 */
	private static function latest_export_meta_key() {
		return 'ssgwp_latest_export';
	}

	/**
	 * Build the transient key used to store export progress.
	 *
	 * @param string $job_id Export job id.
	 * @param string $run_id Export run id.
	 * @return string Transient key.
	 */
	private static function progress_transient_key( $job_id, $run_id = '' ) {
		return 'ssgwp_export_' . get_current_user_id() . '_' . md5( $job_id . ':' . $run_id );
	}

	/**
	 * Sanitize an export run id.
	 *
	 * @param string $run_id Run id.
	 * @return string Sanitized run id.
	 */
	private static function sanitize_export_run_id( $run_id ) {
		return self::sanitize_export_job_id( $run_id );
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
