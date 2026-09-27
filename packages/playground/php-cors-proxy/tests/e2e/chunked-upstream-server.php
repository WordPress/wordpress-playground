<?php
/**
 * Minimal raw HTTP server for CORS proxy e2e tests.
 *
 * The PHP built-in server cannot send a chunked response, so this script
 * writes one by hand. It also sends a Content-Length header before
 * Transfer-Encoding, which HTTP says to ignore, so tests can check that the
 * proxy does not relay it.
 *
 * Run: php chunked-upstream-server.php <port>
 */

$server = stream_socket_server('tcp://127.0.0.1:' . (int) $argv[1], $errno, $errstr);
if (!$server) {
    fwrite(STDERR, "$errstr\n");
    exit(1);
}

while ($conn = @stream_socket_accept($server, -1)) {
    // Read the request headers. The response doesn't depend on them.
    while (($line = fgets($conn)) !== false && rtrim($line) !== '') {
    }
    fwrite(
        $conn,
        "HTTP/1.1 200 OK\r\n" .
        "Content-Type: text/plain\r\n" .
        "Content-Length: 999\r\n" .
        "Transfer-Encoding: chunked\r\n" .
        "Connection: close\r\n" .
        "\r\n" .
        "5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n"
    );
    fclose($conn);
}
