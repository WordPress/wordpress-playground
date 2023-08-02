<?php
/**
 * Plugin Name: SQLite integration (Drop-in)
 * Version: 1.0.0
 * Author: WordPress Performance Team
 * Author URI: https://make.wordpress.org/performance/
 *
 * This file is auto-generated and copied from the sqlite plugin.
 * Please don't edit this file directly.
 *
 * @package wp-sqlite-integration
 */

define( 'SQLITE_DB_DROPIN_VERSION', '1.8.0' );

// Tweak to allow copy-pasting the file without having to run string-replacements.
$sqlite_plugin_implementation_folder_path = '{SQLITE_IMPLEMENTATION_FOLDER_PATH}';
if ( ! file_exists( $sqlite_plugin_implementation_folder_path ) ) { // Check that the folder exists.
	$sqlite_plugin_implementation_folder_path = realpath( __DIR__ . '/plugins/sqlite-database-integration' );
}

// Bail early if the SQLite implementation was not located in the plugin.
if ( ! $sqlite_plugin_implementation_folder_path || ! file_exists( $sqlite_plugin_implementation_folder_path . '/wp-includes/sqlite/db.php' ) ) {
	return;
}

// Constant for backward compatibility.
if ( ! defined( 'DATABASE_TYPE' ) ) {
	define( 'DATABASE_TYPE', 'sqlite' );
}
// Define SQLite constant.
if ( ! defined( 'DB_ENGINE' ) ) {
	define( 'DB_ENGINE', 'sqlite' );
}

// Require the implementation from the plugin.
require_once $sqlite_plugin_implementation_folder_path . '/wp-includes/sqlite/db.php';

// Activate the performance-lab plugin if it is not already activated.
add_action(
	'admin_footer',
	function() {
		if ( defined( 'SQLITE_MAIN_FILE' ) ) {
			return;
		}
		if ( ! function_exists( 'activate_plugin' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( is_plugin_inactive( '{SQLITE_PLUGIN}' ) ) {
			// If `activate_plugin()` returns a value other than null (like WP_Error),
			// the plugin could not be found. Try with a hardcoded string,
			// because that probably means the file was directly copy-pasted.
			if ( null !== activate_plugin( '{SQLITE_PLUGIN}', '', false, true ) ) {
				activate_plugin( 'sqlite-database-integration/load.php', '', false, true );
			}
		}
	}
);
