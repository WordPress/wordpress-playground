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

function getManifestId($start_url) {
    $url_parts = parse_url($start_url);
    $path = $url_parts['path'] ?? '/';
    $query = [];

    if (!empty($url_parts['query'])) {
        parse_str($url_parts['query'], $query);
        unset($query['random']);
        ksort($query);
    }

    return $path . ($query ? '?' . http_build_query($query) : '');
}

function getShortcutUrl($base_url, $wordpress_url) {
	$query = $_GET;
	$query['url'] = $wordpress_url;
	return $base_url . '/?' . http_build_query($query);
}

$base_url = (isHttps() ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
$start_url = $base_url . ($_GET ? '/?' . http_build_query($_GET) : '');

$app_name = $_GET['app_name'] ?? 'WordPress Playground';

$manifest = [
	"id" => getManifestId($start_url),
	"theme_color" => "#ffffff",
	"background_color" => "#ffffff",
	"display" => "standalone",
	"display_override" => [ "standalone" ],
	"scope" => $base_url . "/",
	"start_url" => $start_url,
	"short_name" => $app_name,
	"description" => $app_name,
	"name" => $app_name,
	"categories" => [ "development", "education", "utilities" ],
	"screenshots" => [
		[
			"src" => $base_url . "/ogimage.png",
			"sizes" => "1200x600",
			"type" => "image/png",
			"form_factor" => "wide"
		]
	],
	"shortcuts" => [
		[
			"name" => "Homepage",
			"short_name" => "Home",
			"description" => "Open the WordPress homepage inside Playground.",
			"url" => getShortcutUrl($base_url, "/")
		],
		[
			"name" => "Dashboard",
			"short_name" => "Dashboard",
			"description" => "Open the WordPress dashboard inside Playground.",
			"url" => getShortcutUrl($base_url, "/wp-admin/")
		],
		[
			"name" => "Site Editor",
			"short_name" => "Editor",
			"description" => "Open the WordPress Site Editor inside Playground.",
			"url" => getShortcutUrl($base_url, "/wp-admin/site-editor.php")
		],
		[
			"name" => "New Post",
			"short_name" => "Post",
			"description" => "Open the new post screen inside Playground.",
			"url" => getShortcutUrl($base_url, "/wp-admin/post-new.php")
		],
		[
			"name" => "Plugins",
			"short_name" => "Plugins",
			"description" => "Open the WordPress plugins screen inside Playground.",
			"url" => getShortcutUrl($base_url, "/wp-admin/plugins.php")
		],
		[
			"name" => "Themes",
			"short_name" => "Themes",
			"description" => "Open the WordPress themes screen inside Playground.",
			"url" => getShortcutUrl($base_url, "/wp-admin/themes.php")
		]
	],
	"icons" => [
		[
			"src" => $base_url . "/logo-192.png",
			"sizes" => "192x192",
			"type" => "image/png",
			"purpose" => "any"
		],
		[
			"src" => $base_url . "/logo-256.png",
			"sizes" => "256x256",
			"type" => "image/png",
			"purpose" => "any"
		],
		[
			"src" => $base_url . "/logo-384.png",
			"sizes" => "384x384",
			"type" => "image/png",
			"purpose" => "any"
		],
		[
			"src" => $base_url . "/logo-512.png",
			"sizes" => "512x512",
			"type" => "image/png",
			"purpose" => "any"
		],
		[
			"src" => $base_url . "/maskable-icon-512.png",
			"sizes" => "512x512",
			"type" => "image/png",
			"purpose" => "maskable"
		]
	]
];

header('Content-Type: application/json');
echo json_encode($manifest);
