<?php
/**
 * Mock upstream server for CORS proxy e2e tests.
 *
 * Serves various response types (plain, brotli-compressed, gzip-compressed)
 * so the CORS proxy can be tested against realistic upstream behavior.
 */

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($path) {
    case '/plain-text':
        header('Content-Type: text/plain');
        echo 'Hello from plain-text endpoint';
        break;

    case '/brotli-compressed':
        $body = 'Hello from brotli-compressed endpoint';
        $compressed = brotli_compress_with_fallback($body);
        header('Content-Type: text/plain');
        header('Content-Encoding: br');
        header('Content-Length: ' . strlen($compressed));
        echo $compressed;
        break;

    case '/gzip-compressed':
        $body = 'Hello from gzip-compressed endpoint';
        $compressed = gzencode($body);
        header('Content-Type: text/plain');
        header('Content-Encoding: gzip');
        header('Content-Length: ' . strlen($compressed));
        echo $compressed;
        break;

    default:
        http_response_code(404);
        echo 'Not Found';
        break;
}

/**
 * Compress a string with brotli, using the PHP extension if available
 * or falling back to the brotli CLI tool.
 */
function brotli_compress_with_fallback($input) {
    if (function_exists('brotli_compress')) {
        return brotli_compress($input);
    }

    // Fall back to the brotli CLI tool.
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $proc = proc_open('brotli --stdout', $descriptors, $pipes);
    if (is_resource($proc)) {
        fwrite($pipes[0], $input);
        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($proc);
        if ($exit === 0 && strlen($output) > 0) {
            return $output;
        }
    }

    fwrite(STDERR, "WARNING: neither brotli PHP extension nor CLI available\n");
    return $input;
}
