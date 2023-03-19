<?php
/**
 * Handle the SQLite activation.
 *
 * @since 1.0.0
 * @package wp-sqlite-integration
 */

/**
 * Redirect to the plugin's admin screen on activation.
 *
 * @since 1.0.0
 *
 * @param string $plugin The plugin basename.
 */
function sqlite_plugin_activation_redirect( $plugin ) {
	if ( plugin_basename( SQLITE_MAIN_FILE ) === $plugin ) {
		wp_redirect( admin_url( 'options-general.php?page=sqlite-integration' ) );
		exit;
	}
}
add_action( 'activated_plugin', 'sqlite_plugin_activation_redirect' );

/**
 * Check the URL to ensure we're on the plugin page,
 * the user has clicked the button to install SQLite,
 * and the nonce is valid.
 * If the above conditions are met, run the sqlite_plugin_copy_db_file() function,
 * and redirect to the install screen.
 *
 * @since 1.0.0
 */
function sqlite_activation() {
	global $current_screen;
	if ( isset( $current_screen->base ) && 'settings_page_sqlite-integration' === $current_screen->base ) {
		return;
	}
	if ( isset( $_GET['confirm-install'] ) && wp_verify_nonce( $_GET['_wpnonce'], 'sqlite-install' ) ) {
		sqlite_plugin_copy_db_file();
		// WordPress will automatically redirect to the install screen here.
		wp_redirect( admin_url() );
		exit;
	}
}
add_action( 'admin_init', 'sqlite_activation' );

// Flush the cache at the last moment before the redirect.
add_filter(
	'x_redirect_by',
	function ( $result ) {
		wp_cache_flush();
		return $result;
	},
	PHP_INT_MAX,
	1
);

/**
 * Add the db.php file in wp-content.
 *
 * When the plugin gets merged in wp-core, this is not to be ported.
 */
function sqlite_plugin_copy_db_file() {
	// Bail early if the SQLite3 class does not exist.
	if ( ! class_exists( 'SQLite3' ) ) {
		return;
	}

	$destination = WP_CONTENT_DIR . '/db.php';

	// Place database drop-in if not present yet, except in case there is
	// another database drop-in present already.
	if ( ! defined( 'SQLITE_DB_DROPIN_VERSION' ) && ! file_exists( $destination ) ) {
		// Init the filesystem to allow copying the file.
		global $wp_filesystem;

		require_once ABSPATH . '/wp-admin/includes/file.php';

		// Init the filesystem if needed, then copy the file, replacing contents as needed.
		if ( ( $wp_filesystem || WP_Filesystem() ) && $wp_filesystem->touch( $destination ) ) {

			// Get the db.copy.php file contents, replace placeholders and write it to the destination.
			$file_contents = str_replace(
				array(
					'{SQLITE_IMPLEMENTATION_FOLDER_PATH}',
					'{SQLITE_PLUGIN}',
				),
				array(
					__DIR__,
					str_replace( WP_PLUGIN_DIR . '/', '', SQLITE_MAIN_FILE ),
				),
				file_get_contents( __DIR__ . '/db.copy' )
			);

			$wp_filesystem->put_contents( $destination, $file_contents );
		}
	}
}
