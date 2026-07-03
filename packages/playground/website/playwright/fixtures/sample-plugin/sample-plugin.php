<?php
/*
Plugin Name: Sample Git Plugin
*/

add_action('admin_notices', function () {
	echo '<div class="notice notice-success"><p>Sample Git Plugin is active.</p></div>';
});
