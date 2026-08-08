<?php

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$docRoot = $_SERVER['DOCUMENT_ROOT'];
$file = $docRoot . $uri;

if (isset($_GET['__playground_probe'])) {
    header('Content-Type: text/plain');
    exit($_SERVER['PLAYGROUND_BOOT_ID'] ?? '');
}

$firstRequestMarker = $_SERVER['PLAYGROUND_FIRST_REQUEST_MARKER'] ?? '';
if ($firstRequestMarker !== '' && @unlink($firstRequestMarker)) {
    $cookieHeader = $_SERVER['HTTP_COOKIE'] ?? '';
    if (strpos($cookieHeader, 'playground_auto_login_already_happened') !== false) {
        header('Content-Type: text/plain');
        header('Content-Length: 0');
        header('Location: ' . $_SERVER['REQUEST_URI'], true, 302);
        header('Set-Cookie: playground_auto_login_already_happened=1; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/');
        exit;
    }
}

$definesScript = $docRoot . '/wp-content/mu-plugins/0-playground-defines.php';

if (is_file($definesScript)) {
	require_once $definesScript;
}

$staticTypes = [
	'css'   => 'text/css',
	'js'    => 'text/javascript',
	'json'  => 'application/json',
	'png'   => 'image/png',
	'jpg'   => 'image/jpeg',
	'jpeg'  => 'image/jpeg',
	'gif'   => 'image/gif',
	'svg'   => 'image/svg+xml',
	'ico'   => 'image/x-icon',
	'woff'  => 'font/woff',
	'woff2' => 'font/woff2',
	'ttf'   => 'font/ttf',
	'eot'   => 'application/vnd.ms-fontobject',
	'map'   => 'application/json',
	'xml'   => 'application/xml',
	'txt'   => 'text/plain',
];

if ($uri !== '/' && is_file($file)) {
	$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
	if (isset($staticTypes[$ext])) {
		header('Content-Type: ' . $staticTypes[$ext]);
		header('Content-Length: ' . filesize($file));
		readfile($file);
		exit;
	}

	if ($ext === 'php') {
		chdir(dirname($file));
		include $file;
		exit;
	}
}

if (is_dir($file)) {
	$dirIndex = rtrim($file, '/') . '/index.php';
	if (is_file($dirIndex)) {
		chdir(dirname($dirIndex));
		include $dirIndex;
		exit;
	}
}

chdir($docRoot);

include $docRoot . '/index.php';
