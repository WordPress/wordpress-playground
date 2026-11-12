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

// Exercise the real header callback with repeated fields and either nomination order.
$blocked_headers = [
    'sEt-CoOkIe: secret=1', 'sEt-CoOkIe2: secret=2',
    'Authorization: secret', 'WWW-Authenticate: Basic realm="target"',
    'Cache-Control: public, max-age=3600', 'Strict-Transport-Security: max-age=3600',
    'Upgrade-Insecure-Requests: 1', 'Clear-Site-Data: "*"',
    'Content-Security-Policy: default-src \'none\'',
    'Content-Security-Policy-Report-Only: default-src \'none\'',
    'Cross-Origin-Opener-Policy: same-origin', 'Cross-Origin-Embedder-Policy: require-corp',
    'Cross-Origin-Resource-Policy: same-origin', 'Vary: X-Attacker',
    'X-Playground-Cors-Proxy: forged', 'X-Kandelo-Proxy-Session: secret',
    'x-SpAcEfAsT-Private: secret', 'x-StAtTiC-Private: secret',
    'Access-Control-Allow-Origin: https://attacker.test', 'Access-Control-Allow-Credentials: false',
    'Access-Control-Allow-Methods: DELETE', 'Access-Control-Allow-Headers: X-Attacker',
    'Access-Control-Expose-Headers: X-Attacker', 'Access-Control-Max-Age: 9999',
    'Access-Control-Future: secret', 'Keep-Alive: timeout=60',
    'Proxy-Authenticate: Basic realm="proxy"', 'Proxy-Authorization: secret',
    'TE: trailers', 'Trailer: X-Trailer', 'Upgrade: other',
    'X-Accel-Redirect: /secret', 'X-LiteSpeed-Location: /secret', 'X-Sendfile: /secret',
    'Surrogate-Control: max-age=3600', 'Cloudflare-CDN-Cache-Control: max-age=3600',
    'X-Deployment-Header: forged', 'X-Nominated-Early: secret', 'X-Nominated-Late: secret',
];
$connection = [
    'cOnNeCtIoN: X-NOMINATED-EARLY, x-playground-cors-proxy, Vary, Access-Control-Allow-Origin',
    'Connection: x-nominated-late, X-Deployment-Header, Cross-Origin-Resource-Policy, close',
];
foreach (['first', 'last'] as $order) {
    $headers = $order === 'first'
        ? array_merge($connection, $blocked_headers)
        : array_merge($blocked_headers, $connection);
    $responses["/filtered-connection-$order"] = "HTTP/1.1 200 OK\r\n" .
        implode("\r\n", $headers) . "\r\n" .
        "X-End-To-End: first\r\nX-End-To-End: second\r\n" .
        "Content-Type: text/plain\r\nContent-Length: 999\r\n" .
        "tRaNsFeR-EnCoDiNg: chunked\r\n\r\n" .
        "5\r\nhello\r\n6\r\n world\r\n0\r\nX-Trailer: secret\r\n\r\n";
}
$compressed_body = gzencode('compressed representation');
$responses['/gzip'] = "HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n" .
    'Content-Length: ' . strlen($compressed_body) . "\r\nConnection: close\r\n\r\n" .
    $compressed_body;
foreach (['first', 'last'] as $order) {
    $encoding_headers = $order === 'first'
        ? "Connection: Content-Encoding, close\r\nContent-Encoding: gzip\r\n"
        : "Content-Encoding: gzip\r\nConnection: Content-Encoding, close\r\n";
    $responses["/nominated-encoding-$order"] = "HTTP/1.1 200 OK\r\n" . $encoding_headers .
        'Content-Length: ' . strlen($compressed_body) . "\r\n\r\n" . $compressed_body;
}
$responses['/gzip-chunked'] = "HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n" .
    "Content-Length: 999\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n" .
    dechex(strlen($compressed_body)) . "\r\n$compressed_body\r\n0\r\n\r\n";
// Unsolicited compressed transfer codings are rejected by cURL. In the
// second case the error must also discard the representation Content-Encoding.
foreach ([false, true] as $content_encoded) {
    $body = $content_encoded ? gzencode($compressed_body) : $compressed_body;
    $path = $content_encoded ? '/transfer-and-content-gzip' : '/transfer-gzip';
    $responses[$path] = "HTTP/1.1 200 OK\r\n" .
        ($content_encoded ? "Content-Encoding: gzip\r\n" : '') .
        "Content-Length: 999\r\nTransfer-Encoding: gzip, chunked\r\n" .
        "Connection: close\r\n\r\n" .
        dechex(strlen($body)) . "\r\n$body\r\n0\r\n\r\n";
}
$responses['/chunked-length-last'] = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n" .
    "Content-Length: 999\r\nConnection: close\r\n\r\n5\r\nhello\r\n0\r\n\r\n";
$responses['/nominated-length'] = "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n" .
    "Connection: Content-Length, close\r\n\r\nhello";
$responses['/early-hints'] = str_replace(
    "Link: </style.css>; rel=preload; as=style\r\n",
    "Link: </style.css>; rel=preload; as=style\r\nConnection: Content-Length\r\n",
    $responses['/early-hints']
);

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
    if ($path === '/slow-chunked') {
        fwrite($conn, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n");
        fwrite($conn, "5\r\nfirst\r\n");
        usleep(800_000);
        fwrite($conn, "4\r\nlast\r\n0\r\n\r\n");
        fclose($conn);
        continue;
    }
    fwrite(
        $conn,
        $responses[$path] ?? "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"
    );
    fclose($conn);
}
