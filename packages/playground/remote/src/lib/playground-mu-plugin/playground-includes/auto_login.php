<?php

/**
 * Check if auto-login should be performed.
 */
function should_auto_login() {
	if ( !defined('PLAYGROUND_AUTO_LOGIN') ) {
		return false;
	}

	if (isset($_COOKIE['playground_auto_login'])) {
		return false;
	}

	return true;
}

/**
 * Autologin a user.
 */
function auto_login() {
	if ( !should_auto_login() ) {
		return;
	}

	if ( is_user_logged_in() ) {
		return;
	}

	$user = get_user_by('login', PLAYGROUND_AUTO_LOGIN);
	if (!$user) {
		return;
	}
	wp_set_current_user( $user->ID, $user->user_login );
	wp_set_auth_cookie( $user->ID );
	do_action( 'wp_login', $user->user_login, $user );
	setcookie('playground_auto_login', '1');
}

/**
 * Autologin on load.
 */
add_action('wp', 'auto_login', 1);

/**
 * Redirect to admin page after auto-login.
 *
 * When the user attempts to load /wp-admin/ the default wp action isn't
 * called, so we need to catch the request and redirect to the admin page.
 **/
add_action('init', function() {
	if (strpos($_SERVER['REQUEST_URI'], 'wp-login.php') === false) {
		return;
    }
	auto_login();
	wp_redirect(
		isset($_GET['redirect_to']) ? $_GET['redirect_to'] : admin_url()
	);
	exit;
});

/**
 * Disable the Site Admin Email Verification Screen for autologin.
 */
add_filter('admin_email_check_interval', function($interval) {
	if (should_auto_login()) {
		return 0;
    }

	return $interval;
});
