<?php

if (
	!extension_loaded('ctype') ||
	!extension_loaded('session') ||
	!extension_loaded('zlib') ||
	!function_exists('gzinflate') ||
	gzinflate(gzdeflate('zlib-round-trip')) !== 'zlib-round-trip' ||
	umask() !== 0
) {
	http_response_code(500);
	echo 'missing-runtime-capability';
	return;
}

$zlib_path = __DIR__ . '/zlib-' . bin2hex(random_bytes(8)) . '.gz';
$zlib_writer = gzopen($zlib_path, 'wb');
gzwrite($zlib_writer, 'zlib-file-round-trip');
gzclose($zlib_writer);
$zlib_reader = gzopen($zlib_path, 'rb');
$zlib_file_round_trip = gzread($zlib_reader, 1024);
gzclose($zlib_reader);
unlink($zlib_path);
if ($zlib_file_round_trip !== 'zlib-file-round-trip') {
	http_response_code(500);
	echo 'broken-zlib-file-wrapper';
	return;
}

ini_set('session.save_path', '/tmp');
session_start();
$_SESSION['count'] = ($_SESSION['count'] ?? 0) + 1;
$count = $_SESSION['count'];
session_write_close();

echo 'ctype:session:' . $count;
