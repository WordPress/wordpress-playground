<?php
/**
 * Minimal raw HTTP server for CORS proxy e2e tests.
 *
 * The PHP built-in server can't send some responses the tests need, so this
 * script writes them by hand, chosen by request path:
 *
 * - /chunked: a chunked response that also sends Content-Length before
 *   Transfer-Encoding, which HTTP says to ignore, so tests can check that
 *   the proxy does not relay it.
 * - /early-hints: an interim 103 Early Hints response with a Link header,
 *   followed by the final 200 response.
 * - /switching-protocols: an unsolicited 101 Switching Protocols response
 *   followed by bytes of another protocol.
 *
 * Run: php raw-upstream-server.php <port>
 */

$responses = [
    '/chunked' =>
        "HTTP/1.1 200 OK\r\n" .
        "Content-Type: text/plain\r\n" .
        "Content-Length: 999\r\n" .
        "Transfer-Encoding: chunked\r\n" .
        "Connection: close\r\n" .
        "\r\n" .
        "5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n",
    '/early-hints' =>
        "HTTP/1.1 103 Early Hints\r\n" .
        "Link: </style.css>; rel=preload; as=style\r\n" .
        "\r\n" .
        "HTTP/1.1 200 OK\r\n" .
        "Content-Type: text/plain\r\n" .
        "Content-Length: 5\r\n" .
        "Connection: close\r\n" .
        "\r\n" .
        "hello",
    '/switching-protocols' =>
        "HTTP/1.1 101 Switching Protocols\r\n" .
        "Upgrade: example\r\n" .
        "Connection: Upgrade\r\n" .
        "X-Target-Header: switching-protocols\r\n" .
        "\r\n" .
        "rawdata",
];

$server = stream_socket_server('tcp://127.0.0.1:' . (int) $argv[1], $errno, $errstr);
if (!$server) {
    fwrite(STDERR, "$errstr\n");
    exit(1);
}

while ($conn = @stream_socket_accept($server, -1)) {
    // The request line picks the response. The headers don't matter.
    $request_line = fgets($conn);
    while (($line = fgets($conn)) !== false && rtrim($line) !== '') {
    }
    $path = explode(' ', (string) $request_line)[1] ?? '';
    fwrite(
        $conn,
        $responses[$path] ?? "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"
    );
    fclose($conn);
}
