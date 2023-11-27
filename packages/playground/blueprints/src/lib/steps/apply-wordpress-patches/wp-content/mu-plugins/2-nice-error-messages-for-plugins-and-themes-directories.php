<?php
/**
 * Because the in-browser Playground doesn't have access to the internet, 
 * network-dependent features like directories don't work. Normally, you'll 
 * see a confusing message like "An unexpected error occurred." This mu-plugin
 * makes it more clear that the feature is not yet supported.
 * 
 * https://github.com/WordPress/wordpress-playground/issues/498
 */

add_filter( 'plugins_api_result', function( $res ) {
    if($res instanceof WP_Error) {
        $res = new WP_Error(
            'plugins_api_failed',
            'Enable networking support in Playground settings to access the Plugins directory. Network access is an <a href="https://github.com/WordPress/wordpress-playground/issues/85">experimental, opt-in feature</a>. If you don\'t want to use it, you can still upload plugins or install them using the <a href="https://wordpress.github.io/wordpress-playground/query-api">Query API</a> (e.g. ?plugin=coblocks).'
        );
    }
    return $res;
} );

add_filter( 'gettext', function( $translation ) {
    // There is no better hook for swapping the error message
    // on the themes page, unfortunately.
    global $pagenow;

    // Only change the message on /wp-admin/theme-install.php
    if( 'theme-install.php' !== $pagenow ) {
        return $translation;
    }

    if($translation === 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.') {
        return 'Enable networking support in Playground settings to access the Themes directory. Network access is an <a href="https://github.com/WordPress/wordpress-playground/issues/85">experimental, opt-in feature</a>. If you don\'t want to use it, you can still upload themes or install them using the <a href="https://wordpress.github.io/wordpress-playground/query-api">Query API</a> (e.g. ?theme=pendant).';
    }
    return $translation;
} );
