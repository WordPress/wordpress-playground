<?php

/**
 * This file is used to enable passwordless login for the Playground.
 */

function auto_login() {
    if (!defined('PLAYGROUND_AUTOLOGIN_USERNAME')) {
        return;
    }

    if (!PLAYGROUND_AUTOLOGIN_USERNAME) {
        return;
    }

    // Check if autologin_performed cookie is set
    if (isset($_COOKIE['autologin_performed'])) {
        return;
    }

    // Don't attempt to auto-login if it's an AJAX request
    if (wp_doing_ajax() || wp_is_json_request()) {
        return;
    }

    if ( !is_user_logged_in() ) {
        $user = get_user_by('login', PLAYGROUND_AUTOLOGIN_USERNAME);
        if (!$user) {
            return;
        }

        wp_set_current_user( $user->ID, $user->user_login );
        wp_set_auth_cookie( $user->ID );
        do_action( 'wp_login', $user->user_login, $user );
    }
    setcookie('autologin_performed', 'true', time() + 3600, '/');
}
