<?php
/**
 * Add a notice to wp-login.php offering the username and password.
 */
add_action(
	'login_message',
	function () {
		return <<<EOT
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
 */

 // I tried to use a more semantic markup on the message below, but it messes up the display of the error message in the Plugins' Popular tags section.

add_filter('plugins_api_result', function ($res) {
	if ($res instanceof WP_Error) {
		$res = new WP_Error(
			'plugins_api_failed',
			'Network access is an <a href="https://github.com/WordPress/wordpress-playground/issues/85">experimental, opt-in feature</a>, which means you need to enable it to allow Playground to access the Plugins/Themes directories.<br><br>
			There are two alternative methods to enable global networking support:<br>
			- Using the <a href="https://wordpress.github.io/wordpress-playground/query-api">Query API</a>: for example, https://playground.wordpress.net/?networking=yes or<br>
			- Using the <a href="https://wordpress.github.io/wordpress-playground/blueprints-api/data-format/#features">Blueprint API</a>: add "features": { "networking": true } to the JSON file.'
		);
	}
	return $res;
});

add_filter('gettext', function ($translation) {
	if ($translation === 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.') {
		return 'Network access is an <a href="https://github.com/WordPress/wordpress-playground/issues/85">experimental, opt-in feature</a>, which means you need to enable it to allow Playground to access the Plugins/Themes directories.<br><br>
		There are two alternative methods to enable global networking support:<br>
		- Using the <a href="https://wordpress.github.io/wordpress-playground/query-api">Query API</a>: for example, https://playground.wordpress.net/?networking=yes or<br>
		- Using the <a href="https://wordpress.github.io/wordpress-playground/blueprints-api/data-format/#features">Blueprint API</a>: add "features": { "networking": true } to the JSON file.';
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
 * Supports URL rewriting to remove `index.php` from permalinks.
 */
add_filter('got_url_rewrite', '__return_true');

/**
 * The default WordPress requests transports have been disabled
 * at this point. However, the Requests class requires at least
 * one working transport or else it throws warnings and acts up.
 * 
 * This mu-plugin provides that transport. It's one of the two:
 * 
 * * WP_Http_Fetch – Sends requests using browser's fetch() function.
 *                   Only enabled when PHP was compiled with the VRZNO
 * 					 extension.
 * * Requests_Transport_Dummy – Does not send any requests and only exists to keep
 * 								the Requests class happy.
 */
$__requests_class = class_exists( '\WpOrg\Requests\Requests' ) ? '\WpOrg\Requests\Requests' : 'Requests';
if (defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
	require(__DIR__ . '/playground-includes/wp_http_fetch.php');
	$__requests_class::add_transport('WP_Http_Fetch');

	/**
	 * Add Fetch transport to the list of transports that WordPress
	 * will test for in the _get_first_available_transport() function.
	 */
	add_filter('http_api_transports', function ($transports) {
		$transports[] = 'Fetch';
		return $transports;
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

	add_filter('http_request_host_is_external', function ($arg) {
		return true;
	});
} else {
	require(__DIR__ . '/playground-includes/requests_transport_dummy.php');
	$__requests_class::add_transport('Requests_Transport_Dummy');
}
