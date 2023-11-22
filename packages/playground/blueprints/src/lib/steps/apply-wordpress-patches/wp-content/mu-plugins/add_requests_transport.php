<?php
/**
 * The default WordPress requests transports have been disabled
 * at this point. However, the Requests class requires at least
 * one working transport or else it throws warnings and acts up.
 * 
 * This mu-plugin provides that transport. It's one of the two:
 * 
 * * Requests_Transport_Fetch – Sends requests using browser's fetch() function.
 *                              Only enabled when PHP was compiled with the VRZNO
 * 								extension.
 * * Requests_Transport_Dummy – Does not send any requests and only exists to keep
 * 								the Requests class happy.
 */
if (defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
	require(__DIR__ . '/includes/requests_transport_fetch.php');
	Requests::add_transport('Requests_Transport_Fetch');
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
	require(__DIR__ . '/includes/requests_transport_dummy.php');
	Requests::add_transport('Requests_Transport_Dummy');
}
