<?php

/**
 * Add a notice to wp-login.php offering the username and password.
 */
add_filter(
	'login_message',
	function ( $message ) {
		return $message . <<<EOT
<div class="message info">
	<strong>username:</strong> <code>admin</code><br><strong>password</strong>: <code>password</code>
</div>
EOT;
	}
);

/**
 * Because the in-browser Playground doesn't have access to the internet,
 * network-dependent features like directories don't work. Normally, you'll
 * see a confusing message like "An unexpected error occurred." This mu-plugin
 * makes it more clear that the feature is not yet supported.
 *
 * https://github.com/WordPress/wordpress-playground/issues/498
 *
 * Added styling to hide the Popular tags section of the Plugins page
 * and the nonfunctional Try Again button (both Plugins and Themes) that's
 * appended when the message is displayed.
 *
 * https://github.com/WordPress/wordpress-playground/issues/927
 *
 */
add_action('admin_head', function () {
	echo '<style>
				:is(.plugins-popular-tags-wrapper:has(div.networking_err_msg),
				button.button.try-again) {
						display: none;
				}
		</style>';
});

add_action('init', 'networking_disabled');
function networking_disabled() {
	$networking_err_msg = '<div class="networking_err_msg">Network access is an <a href="https://github.com/WordPress/wordpress-playground/issues/85" target="_blank">experimental, opt-in feature</a>, which means you need to enable it to allow Playground to access the Plugins/Themes directories.
	<p>There are two alternative methods to enable global networking support:</p>
	<ol>
	<li>Using the <a href="https://wordpress.github.io/wordpress-playground/developers/apis/query-api/">Query API</a>: for example, https://playground.wordpress.net/<em>?networking=yes</em> <strong>or</strong>
	<li> Using the <a href="https://wordpress.github.io/wordpress-playground/blueprints/data-format/#features">Blueprint API</a>: add <code>"features": { "networking": true }</code> to the JSON file.
	</li></ol>
	<p>
	When browsing Playground as a standalone instance, you can enable networking via the settings panel: select the option "Network access (e.g. for browsing plugins)" and hit the "Apply changes" button.<p>
	<strong>Please note:</strong> This option is hidden when browsing Playground as an embedded iframe.</p></div>';
	return $networking_err_msg;
}

add_filter('plugins_api_result', function ($res) {
	if ($res instanceof WP_Error) {
		$res = new WP_Error(
			'plugins_api_failed',
			networking_disabled()
		);
	}
	return $res;
});

add_filter('gettext', function ($translation) {
	if( $GLOBALS['pagenow'] === 'theme-install.php') {
		if ($translation === 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.') {
			return networking_disabled();
		}
	}
	return $translation;
});

/**
 * Links with target="top" don't work in the playground iframe because of
 * the sandbox attribute. What they really should be targeting is the
 * playground iframe itself (name="playground"). This mu-plugin rewrites
 * all target="_top" links to target="playground" instead.
 *
 * https://github.com/WordPress/wordpress-playground/issues/266
 */
add_action('admin_print_scripts', function () {
	?>
	<script>
		document.addEventListener('click', function (event) {
			if (event.target.tagName === 'A' && ['_parent', '_top'].includes(event.target.target)) {
				event.target.target = 'wordpress-playground';
			}
		});
	</script>
	<?php
});

/**
 * The default WordPress requests transports have been disabled
 * at this point. However, the Requests class requires at least
 * one working transport or else it throws warnings and acts up.
 *
 * This mu-plugin provides that transport. It's one of the two:
 *
 * * WP_Http_Fetch – Sends requests using browser's fetch() function.
 * * WP_Http_Dummy – Does not send any requests and only exists to keep
 * 								the Requests class happy.
 */
$__requests_class = class_exists( '\WpOrg\Requests\Requests' ) ? '\WpOrg\Requests\Requests' : 'Requests';
if (defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
	require(__DIR__ . '/playground-includes/wp_http_fetch.php');
	/**
	 * Force the Fetch transport to be used in Requests.
	 */
	add_action( 'requests-requests.before_request', function( $url, $headers, $data, $type, &$options ) {
		$options['transport'] = 'Wp_Http_Fetch';
	}, 10, 5 );

	/**
	 * Force wp_http_supports() to work, which uses deprecated WP_HTTP methods.
	 * This filter is deprecated, and no longer actively used, but is needed for wp_http_supports().
	 * @see https://core.trac.wordpress.org/ticket/37708
	 */
	add_filter('http_api_transports', function() {
		return [ 'Fetch' ];
	});

	/**
	 * Disable signature verification as it doesn't seem to work with
	 * fetch requests:
	 *
	 * https://downloads.wordpress.org/plugin/classic-editor.zip returns no signature header.
	 * https://downloads.wordpress.org/plugin/classic-editor.zip.sig returns 404.
	 *
	 * @TODO Investigate why.
	 */
	add_filter('wp_signature_hosts', function ($hosts) {
		return [];
	});

	// add_filter('http_request_host_is_external', function ($arg) {
	// 	return true;
	// });
	add_filter('http_request_host_is_external', '__return_true');
} else {
	require(__DIR__ . '/playground-includes/wp_http_dummy.php');
	$__requests_class::add_transport('Wp_Http_Dummy');

	add_action( 'requests-requests.before_request', function( $url, $headers, $data, $type, &$options ) {
		$options['transport'] = 'Wp_Http_Dummy';
	}, 10, 5 );

	add_filter('http_api_transports', function() {
		return [ 'Dummy' ];
	});
}

// Autologin

add_action('wp', function () {
	if ( !defined('PLAYGROUND_AUTO_LOGIN') ) {
		return;
	}

	if (isset($_COOKIE['playground_auto_login'])) {
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
});
?>
