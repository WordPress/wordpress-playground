<?php
/**
 * Plugin Name: Simple Admin Message
 * Description: Displays a simple message in the WordPress admin
 * Version: 1.0
 * Author: Playground Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
	exit;
}

// Display admin notice
function sam_display_admin_message() {
	?>
	<div class="notice notice-info is-dismissible">
		<p><?php esc_html_e( 'Hello! This is a simple admin message.', 'simple-admin-message' ); ?></p>
	</div>
	<?php
}

add_action('admin_notices', 'sam_display_admin_message');
