<?php
/**
 * Automatically logs the user in to aid the `login` Blueprint step and 
 * the Playground runtimes.
 *
 * There are two ways to trigger the auto-login:
 * 
 * ## The `PLAYGROUND_AUTO_LOGIN_AS_USER` constant
 *
 * Used by the `login` Blueprint step does.
 * 
 * When the `PLAYGROUND_AUTO_LOGIN_AS_USER` constant is defined, this mu-plugin
 * will automatically log the user in on their first visit. The username is
 * the value of the constant.
 * 
 * On subsequent visits, the `playground_auto_login_already_happened` cookie will be
 * detected and the user will not be logged in. This means the "logout" feature
 * will work as expected.
 * 
 * ## The `playground_force_auto_login_as_user` GET parameter
 * 
 * Used by the "login" button in various Playground runtimes.
 * 
 * Only works if the `PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED` constant is defined.
 * 
 * When the `playground_force_auto_login_as_user` GET parameter is present,
 * this mu-plugin will automatically log in any logged out visitor. This will
 * happen every time they visit, not just on their first visit.
 * 
 * 
 * ## Context
 * 
 * The `login` step used to make a HTTP request to the `/wp-login.php` endpoint,
 * but that approach had significant downsides:
 * 
 * * It only worked in web browsers
 * * It didn't support custom login mechanisms
 * * It required storing plaintext passwords in the Blueprint files
 */

/**
 * Logs the user in on their first visit if the Playground runtime told us to.
 */
function playground_auto_login() {
	if ( defined('PLAYGROUND_AUTO_LOGIN_AS_USER') && !isset($_COOKIE['playground_auto_login_already_happened']) ) {
		$user = get_user_by('login', PLAYGROUND_AUTO_LOGIN_AS_USER);
	} else if ( defined('PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED') && isset($_GET['playground_force_auto_login_as_user']) ) {
		$user = get_user_by('login', $_GET['playground_force_auto_login_as_user'] ?? 'admin');
	} else {
		return;
	}

	if ( is_user_logged_in() ) {
		return;
	}

	if (!$user) {
		return;
	}

	wp_set_current_user( $user->ID, $user->user_login );
	wp_set_auth_cookie( $user->ID );
	do_action( 'wp_login', $user->user_login, $user );
	setcookie('playground_auto_login_already_happened', '1');
}

/**
 * Autologin on load.
 */
add_action('wp', 'playground_auto_login', 1);

/**
 * Redirect to admin page after auto-login.
 *
 * When the user attempts to load /wp-admin/ the default wp action isn't
 * called, so we need to catch the request and redirect to the admin page.
 **/
add_action('init', function() {
	if (!str_ends_with($_SERVER['REQUEST_URI'], '/wp-login.php')) {
		return;
	}
	playground_auto_login();
	wp_redirect(
		isset($_GET['redirect_to']) ? $_GET['redirect_to'] : admin_url()
	);
	exit;
});

/**
 * Disable the Site Admin Email Verification Screen for any session started
 * via autologin.
 */
add_filter('admin_email_check_interval', function($interval) {
	if(isset($_COOKIE['playground_auto_login_already_happened'])) {
		return 0;
	}

	return $interval;
});
