<?php

// Allow adding filters/actions prior to loading WordPress.
// $function_to_add MUST be a string.
function playground_add_filter( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
    global $wp_filter;
    $wp_filter[$tag][$priority][$function_to_add] = array('function' => $function_to_add, 'accepted_args' => $accepted_args);
}
function playground_add_action( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
    playground_add_filter( $tag, $function_to_add, $priority, $accepted_args );
}

// Load our mu-plugins after customer mu-plugins
// NOTE: this means our mu-plugins can't use the muplugins_loaded action!
playground_add_action( 'muplugins_loaded', 'playground_load_mu_plugins', 0 );
function playground_load_mu_plugins() {
    // Load all PHP files from /internal/mu-plugins, sorted by filename
    $mu_plugins_dir = __DIR__ . '/internal/mu-plugins';
    if(!is_dir($mu_plugins_dir)){
        return;
    }
    $mu_plugins = glob( $mu_plugins_dir . '/*.php' );
    sort( $mu_plugins );
    foreach ( $mu_plugins as $mu_plugin ) {
        require_once $mu_plugin;
    }
}
