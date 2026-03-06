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
        if (function_exists('brotli_compress')) {
            $compressed = brotli_compress($body);
        } else {
            // Fallback: use raw brotli bytes generated offline.
            // This is the brotli encoding of the string above, produced via:
            //   echo -n "Hello from brotli-compressed endpoint" | brotli | xxd -i
            $compressed = generate_brotli_bytes($body);
        }
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
 * Generate brotli-compressed bytes using the brotli CLI tool as a fallback
 * when the PHP brotli extension is not available.
 */
function generate_brotli_bytes($input) {
    // Try the brotli CLI tool
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

    // Last resort: just send the raw bytes with the header. The test will
    // detect a mismatch if the proxy doesn't handle it.
    fwrite(STDERR, "WARNING: brotli CLI not available, sending raw bytes with Content-Encoding: br\n");
    return $input;
}
