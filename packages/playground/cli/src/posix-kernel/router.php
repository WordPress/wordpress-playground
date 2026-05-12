<?php
/**
 * Single FastCGI entry point. The kernel-built nginx has no PCRE, so
 * it can't dispatch by extension; every request lands here, and this
 * script does the three-way split:
 *   1. Static files (CSS, JS, images, fonts) — served with their MIME.
 *   2. PHP files that exist on disk — included directly.
 *   3. Everything else — routed through WordPress's index.php.
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$docRoot = $_SERVER['DOCUMENT_ROOT'];
$file = $docRoot . $uri;

// First-request middleware: mirrors run-cli.ts's classic-mode handler
// that clears a stale `playground_auto_login_already_happened` cookie
// on the first real request after boot. The marker file is created by
// posix-kernel-handler.ts after ensureWordPressInstalled completes, so
// the install probe never trips this branch. @unlink is atomic across
// FPM workers — only the first request consumes the marker. We only
// emit the 302 when the cookie is actually present, otherwise the
// marker is consumed silently and the request falls through normally.
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

// Apply Playground-defined constants (set via --define / --define-bool
// / --define-number and persisted by KernelLimitedPHPApi.defineConstant)
// before any user PHP runs. The same file is loaded as a WordPress
// mu-plugin too; this branch covers bare PHP files that bypass WP.
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

// DirectoryIndex: a request like /wp-admin/ maps to a directory on
// disk, not a file. Without this branch the request falls through to
// the WP front-end index.php and the user sees the homepage instead
// of the admin dashboard.
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
