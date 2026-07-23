<?php

if (
	parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
	!== '/__test-default-response-headers'
) {
	return false;
}

ob_start();
register_shutdown_function(function () {
	ob_clean();
	header_remove();
	http_response_code(200);
	sendBufferedResponseHeaders(
		[['content-type', "Content-Type: application/octet-stream\r\n"]],
		['content-length'],
		['Content-Type: application/zip']
	);
	echo 'body';
});

require __DIR__ . '/../../public/plugin-proxy.php';
