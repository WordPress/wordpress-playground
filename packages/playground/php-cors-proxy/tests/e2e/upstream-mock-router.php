<?php
/**
 * Mock upstream server for CORS proxy e2e tests.
 *
 * Serves various response types so the CORS proxy can be tested
 * against realistic upstream behavior.
 */

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($path) {
    case '/plain-text':
        header('Content-Type: text/plain');
        echo 'Hello from plain-text endpoint';
        break;

    case '/range':
        // Serves single byte ranges of a virtual file whose size is given
        // by ?size=. Byte i is the letter at i % 26, so size=26 is a-z.
        $size = (int) ($_GET['size'] ?? 26);
        header('Content-Type: text/plain');
        header('Accept-Ranges: bytes');
        header('ETag: "range-mock"');
        $range = $_SERVER['HTTP_RANGE'] ?? '';
        if (!preg_match('/^bytes=(\d*)-(\d*)$/', $range, $matches)) {
            $start = 0;
            $end = $size - 1;
        } elseif ($matches[1] === '') {
            $start = max(0, $size - (int) $matches[2]);
            $end = $size - 1;
        } else {
            $start = (int) $matches[1];
            $end = $matches[2] === '' ? $size - 1 : min((int) $matches[2], $size - 1);
        }
        if ($start >= $size) {
            http_response_code(416);
            header("Content-Range: bytes */$size");
            break;
        }
        if ($range !== '') {
            http_response_code(206);
            header("Content-Range: bytes $start-$end/$size");
        }
        header('Content-Length: ' . ($end - $start + 1));
        for ($i = $start; $i <= $end; $i++) {
            echo chr(ord('a') + $i % 26);
        }
        break;

    case '/oversized-range':
        // Declares a slice larger than the proxy's response size cap.
        http_response_code(206);
        header('Content-Type: application/zip');
        header('Accept-Ranges: bytes');
        header('ETag: "oversized"');
        header('Content-Range: bytes 0-104857599/4294967296');
        header('Content-Length: 104857600');
        echo 'x';
        break;

    case '/truncated-range':
        // Promises 100 bytes, then drops the connection after 10.
        http_response_code(206);
        header('Content-Range: bytes 0-99/1000');
        header('Content-Length: 100');
        echo str_repeat('a', 10);
        break;

    case '/headers':
        header('Content-Type: application/json');
        echo json_encode(array_change_key_case(getallheaders(), CASE_LOWER));
        break;

    default:
        http_response_code(404);
        echo 'Not Found';
        break;
}
