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
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Static Site Generator', 'playground-static-site-generator' ); ?></h1>
			<p><?php esc_html_e( 'Export public WordPress pages and frontend assets as a static zip that can be hosted anywhere.', 'playground-static-site-generator' ); ?></p>

			<form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post">
				<input type="hidden" name="action" value="ssgwp_export" />
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

		$args        = self::request_to_export_args( wp_unslash( $_POST ) );
		$upload_dir  = wp_get_upload_dir();
		$temp_parent = trailingslashit( $upload_dir['basedir'] ) . 'static-site-generator';

		if ( ! wp_mkdir_p( $temp_parent ) ) {
			wp_die( esc_html__( 'Could not create a temporary export directory.', 'playground-static-site-generator' ) );
		}

		$output_file = trailingslashit( $temp_parent ) . 'static-site-' . gmdate( 'Ymd-His' ) . '.zip';

		try {
			ssgwp_export_static_site( $output_file, $args );
		} catch ( Exception $exception ) {
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
