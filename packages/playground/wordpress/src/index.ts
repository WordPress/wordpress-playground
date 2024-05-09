export * from './rewrite-rules';

export const RecommendedPHPVersion = '8.0';

export const envPHP_to_loadMuPlugins = `<?php

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
    $mu_plugins_dir = '/internal/mu-plugins';
    if(!is_dir($mu_plugins_dir)){
        return;
    }
    $mu_plugins = glob( $mu_plugins_dir . '/*.php' );
    sort( $mu_plugins );
    foreach ( $mu_plugins as $mu_plugin ) {
        require_once $mu_plugin;
    }
}
`;

// Entries must not render whitespaces as they'll be loaded
// as mu-plugins and we don't want to trigger the "headers
// already sent" PHP error.
export const specificMuPlugins = {
	addTrailingSlashToWpAdmin: `<?php
    // Redirect /wp-admin to /wp-admin/
    add_filter( 'redirect_canonical', function( $redirect_url ) {
        if ( '/wp-admin' === $redirect_url ) {
            return $redirect_url . '/';
        }
        return $redirect_url;
    } );
    ?>`,
	allowRedirectHosts: `<?php
    // Needed because gethostbyname( 'wordpress.org' ) returns
    // a private network IP address for some reason.
    add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
        return array(
            'wordpress.org',
            'api.wordpress.org',
            'downloads.wordpress.org',
        );
    } );
    ?>`,
	supportPermalinksWithoutIndexPhp: `<?php
    add_filter( 'got_url_rewrite', '__return_true' );
    ?>`,
	createFontsDirectory: `<?php
    // Create the fonts directory if missing
    if(!file_exists(WP_CONTENT_DIR . '/fonts')) {
        mkdir(WP_CONTENT_DIR . '/fonts');
    }
    ?>`,
	silenceUnfixableErrors: `<?php
    set_error_handler(function($severity, $message, $file, $line) {
        /**
         * This is a temporary workaround to hide the 32bit integer warnings that
         * appear when using various time related function, such as strtotime and mktime.
         * Examples of the warnings that are displayed:
         * Warning: mktime(): Epoch doesn't fit in a PHP integer in <file>
         * Warning: strtotime(): Epoch doesn't fit in a PHP integer in <file>
         */
        if (strpos($message, "fit in a PHP integer") !== false) {
            return;
        }
        /**
         * Don't complain about network errors when not connected to the network.
         */
        if (
            (
                ! defined('USE_FETCH_FOR_REQUESTS') ||
                ! USE_FETCH_FOR_REQUESTS
            ) &&
            strpos($message, "WordPress could not establish a secure connection to WordPress.org") !== false)
        {
            return;
        }
        return false;
    });
    ?>`,
	configureErrorLogging: `<?php
    $log_file = WP_CONTENT_DIR . '/debug.log';
    error_reporting(E_ALL);
    define('ERROR_LOG_FILE', $log_file);
    ini_set('error_log', $log_file);
    ini_set('ignore_repeated_errors', true);
    ini_set('display_errors', false);
    ini_set('log_errors', true);
    ?>`,
};

export const playgroundMuPlugin = Object.values(specificMuPlugins)
	.map((p) => p.trim())
	.join('\n');
