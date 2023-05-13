<?php

/**
 * Plugin Name:       Hello 
 * Version:           0.1.1
 * Requires at least: 6.0
 * Requires PHP:      5.6
 * Description:       Plugin that demoes the usage of the Interactivity API.
 * Author:            WordPress Team
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       hello
 * 
 * @package hello
 */

add_action( 'init', 'register_hello_block' );

function register_hello_block() {
	if ( file_exists( __DIR__ . '/blocks/hello' ) ) {
		register_block_type( __DIR__ . '/blocks/hello');
	};
}


add_action( 'wp_enqueue_scripts', 'hello_auto_inject_interactivity_dependency' );

function add_hello_script_dependency( $handle, $dep, $in_footer ) {
	global $wp_scripts;

	$script = $wp_scripts->query( $handle, 'registered' );
	if ( ! $script ) {
		return false;
	}

	if ( ! in_array( $dep, $script->deps, true ) ) {
		$script->deps[] = $dep;

		if ( $in_footer ) {
			// move script to the footer
			$wp_scripts->add_data( $handle, 'group', 1 );
		}
	}

	return true;
}

function hello_auto_inject_interactivity_dependency() {
	$registered_blocks = \WP_Block_Type_Registry::get_instance()->get_all_registered();

	foreach ( $registered_blocks as $name => $block ) {
		$has_interactivity_support = $block->supports['interactivity'] ?? false;

		if ( ! $has_interactivity_support ) {
			continue;
		}
		foreach ( $block->view_script_handles as $handle ) {
			add_hello_script_dependency( $handle, 'wp-directive-runtime', true );
		}
	}
}