<?php
/**
 * Handle the SQLite deactivation.
 *
 * @since 1.0.0
 * @package wp-sqlite-integration
 */

/**
 * Delete the db.php file in wp-content.
 *
 * When the plugin gets merged in wp-core, this is not to be ported.
 */
function sqlite_plugin_remove_db_file() {
	if ( ! defined( 'SQLITE_DB_DROPIN_VERSION' ) || ! file_exists( WP_CONTENT_DIR . '/db.php' ) ) {
		return;
	}

	global $wp_filesystem;

	require_once ABSPATH . '/wp-admin/includes/file.php';

	// Init the filesystem if needed, then delete custom drop-in.
	if ( $wp_filesystem || WP_Filesystem() ) {
		// Flush any persistent cache.
		wp_cache_flush();
		// Delete the drop-in.
		$wp_filesystem->delete( WP_CONTENT_DIR . '/db.php' );
		// Flush the cache again to mitigate a possible race condition.
		wp_cache_flush();
	}

	// Run an action on `shutdown`, to deactivate the option in the MySQL database.
	add_action(
		'shutdown',
		function() {
			global $table_prefix;

			// Get credentials for the MySQL database.
			$dbuser     = defined( 'DB_USER' ) ? DB_USER : '';
			$dbpassword = defined( 'DB_PASSWORD' ) ? DB_PASSWORD : '';
			$dbname     = defined( 'DB_NAME' ) ? DB_NAME : '';
			$dbhost     = defined( 'DB_HOST' ) ? DB_HOST : '';

			// Init a connection to the MySQL database.
			$wpdb_mysql = new wpdb( $dbuser, $dbpassword, $dbname, $dbhost );
			$wpdb_mysql->set_prefix( $table_prefix );

			// Get the perflab options, remove the database/sqlite module and update the option.
			$row = $wpdb_mysql->get_row( $wpdb_mysql->prepare( "SELECT option_value FROM $wpdb_mysql->options WHERE option_name = %s LIMIT 1", 'active_plugins' ) );
			if ( is_object( $row ) ) {
				$value = maybe_unserialize( $row->option_value );
				if ( is_array( $value ) ) {
					$value_flipped = array_flip( $value );
					$items         = array_reverse( explode( DIRECTORY_SEPARATOR, SQLITE_MAIN_FILE ) );
					$item          = $items[1] . DIRECTORY_SEPARATOR . $items[0];
					unset( $value_flipped[ $item ] );
					$value = array_flip( $value_flipped );
					$wpdb_mysql->update( $wpdb_mysql->options, array( 'option_value' => maybe_serialize( $value ) ), array( 'option_name' => 'active_plugins' ) );
				}
			}
		},
		PHP_INT_MAX
	);
	// Flush any persistent cache.
	wp_cache_flush();
}
register_deactivation_hook( SQLITE_MAIN_FILE, 'sqlite_plugin_remove_db_file' ); // Remove db.php file on plugin deactivation.
