<?php
/**
 * A dynamic manifest.json that allows turning Blueprints into PWAs.
 * 
 * Accepted query parameters:
 * - app_name: The name of the app.
 * 
 * @link https://developer.mozilla.org/en-US/docs/Web/Manifest
 */

function isHttps() {
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on') {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    return false;
}

$base_url = (isHttps() ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
$start_url = $base_url . ($_GET ? '/?' . http_build_query($_GET) : '');

$app_name = $_GET['app_name'] ?? 'WordPress Playground';

$manifest = [
	"theme_color" => "#ffffff",
	"background_color" => "#ffffff",
	"display" => "standalone",
	"scope" => $base_url,
	"start_url" => $start_url,
	"short_name" => $app_name,
	"description" => $app_name,
	"name" => $app_name,
	"icons" => [
		[
			"src" => $base_url . "/logo-192.png",
			"sizes" => "192x192",
			"type" => "image/png"
		],
		[
			"src" => $base_url . "/logo-256.png",
			"sizes" => "256x256",
			"type" => "image/png"
		],
		[
			"src" => $base_url . "/logo-384.png",
			"sizes" => "384x384",
            "type" => "image/png"
		],
		[
			"src" => $base_url . "/logo-512.png",
			"sizes" => "512x512",
			"type" => "image/png"
        ]
	]
];

header('Content-Type: application/json');
echo json_encode($manifest);
