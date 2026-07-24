<?php

// This test needs a PHP request router because it verifies the HTTP headers
// emitted by PHP's header() function, not just the helper's array bookkeeping.
// The test-only route invokes sendBufferedResponseHeaders() with controlled
// upstream, allowlist, and default-header inputs. Returning false for every
// other URL lets the built-in server handle ordinary proxy requests.
if (
	parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
	!== '/__test-default-response-headers'
) {
	return false;
}

// plugin-proxy.php has no import-only entry point. Requiring it also dispatches
// this test-only request, which dies with a 400 invalid-query response. Buffer
// that response and replace it from a shutdown callback after the helper has
// been defined.
$allow_content_type = isset($_GET['allow-content-type']);
ob_start();
register_shutdown_function(function () use ($allow_content_type) {
	ob_clean();
	header_remove();
	http_response_code(200);
	sendBufferedResponseHeaders(
		[['content-type', "Content-Type: application/octet-stream\r\n"]],
		$allow_content_type ? ['content-type'] : ['content-length'],
		['Content-Type: application/zip']
	);
	echo 'body';
});

require __DIR__ . '/../../public/plugin-proxy.php';
