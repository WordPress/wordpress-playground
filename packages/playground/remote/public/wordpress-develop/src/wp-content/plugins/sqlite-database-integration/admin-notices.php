<?php
/**
 * Functions to add admin notices if necessary.
 *
 * @since 1.0.0
 * @package wp-sqlite-integration
 */

/**
 * Add admin notices.
 *
 * When the plugin gets merged in wp-core, this is not to be ported.
 */
function sqlite_plugin_admin_notice() {

	// Don't print notices in the plugin's admin screen.
	global $current_screen;
	if ( isset( $current_screen->base ) && 'settings_page_sqlite-integration' === $current_screen->base ) {
		return;
	}

	// If SQLite is not detected, bail early.
	if ( ! class_exists( 'SQLite3' ) ) {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			esc_html__( 'The SQLite Integration plugin is active, but the SQLite3 class is missing from your server. Please make sure that SQLite is enabled in your PHP installation.', 'sqlite-database-integration' )
		);
		return;
	}
	/*
	 * If the SQLITE_DB_DROPIN_VERSION constant is not defined
	 * but there's a db.php file in the wp-content directory, then the module can't be activated.
	 * The module should not have been activated in the first place
	 * (there's a check in the can-load.php file), but this is a fallback check.
	 */
	if ( file_exists( WP_CONTENT_DIR . '/db.php' ) && ! defined( 'SQLITE_DB_DROPIN_VERSION' ) ) {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			sprintf(
				/* translators: 1: SQLITE_DB_DROPIN_VERSION constant, 2: db.php drop-in path */
				__( 'The SQLite Integration module is active, but the %1$s constant is missing. It appears you already have another %2$s file present on your site. ', 'sqlite-database-integration' ),
				'<code>SQLITE_DB_DROPIN_VERSION</code>',
				'<code>' . esc_html( basename( WP_CONTENT_DIR ) ) . '/db.php</code>'
			)
		);

		return;
	}

	if ( file_exists( WP_CONTENT_DIR . '/db.php' ) ) {
		return;
	}

	if ( ! wp_is_writable( WP_CONTENT_DIR ) ) {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			esc_html__( 'The SQLite Integration plugin is active, but the wp-content/db.php file is missing and the wp-content directory is not writable. Please ensure the wp-content folder is writable, then deactivate the plugin and try again.', 'sqlite-database-integration' )
		);
		return;
	}
	// The dropin db.php is missing.
	printf(
		'<div class="notice notice-error"><p>%s</p></div>',
		sprintf(
			/* translators: 1: db.php drop-in path, 2: Admin URL to deactivate the module */
			__( 'The SQLite Integration plugin is active, but the %1$s file is missing. Please <a href="%2$s">deactivate the plugin</a> and re-activate it to try again.', 'sqlite-database-integration' ),
			'<code>' . esc_html( basename( WP_CONTENT_DIR ) ) . '/db.php</code>',
			esc_url( admin_url( 'plugins.php' ) )
		)
	);
}
add_action( 'admin_notices', 'sqlite_plugin_admin_notice' ); // Add the admin notices.
