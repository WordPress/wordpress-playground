<?php
/**
 * Auto-login support for Playground CLI's --experimental-posix-kernel.
 * Mirrors the @wp-playground/wordpress 1-auto-login.php mu-plugin.
 */
function playground_get_username_for_auto_login() {
    if ( defined('PLAYGROUND_AUTO_LOGIN_AS_USER') && !isset($_COOKIE['playground_auto_login_already_happened']) ) {
        return PLAYGROUND_AUTO_LOGIN_AS_USER;
    }
    if ( defined('PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED') && isset($_GET['playground_force_auto_login_as_user']) ) {
        return $_GET['playground_force_auto_login_as_user'];
    }
    return false;
}

function playground_auto_login() {
    if (empty($_SERVER['REQUEST_URI'])) {
        return;
    }
    $user_name = playground_get_username_for_auto_login();
    if ( false === $user_name ) {
        return;
    }
    if (function_exists('wp_doing_ajax') && wp_doing_ajax()) {
        return;
    }
    if (defined('REST_REQUEST')) {
        return;
    }
    if (function_exists('is_user_logged_in') && is_user_logged_in()) {
        return;
    }
    $user = get_user_by('login', $user_name);
    if (!$user) {
        return;
    }
    if (headers_sent()) {
        return;
    }
    wp_set_current_user( $user->ID, $user->user_login );
    wp_set_auth_cookie( $user->ID );
    do_action( 'wp_login', $user->user_login, $user );
    setcookie('playground_auto_login_already_happened', '1');
    if (headers_sent()) {
        return;
    }
    $redirect_url = $_SERVER['REQUEST_URI'];
    header( "Location: $redirect_url", true, 302 );
    exit;
}
add_action('init', 'playground_auto_login', 1);
