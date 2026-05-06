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

chdir($docRoot);

include $docRoot . '/index.php';
