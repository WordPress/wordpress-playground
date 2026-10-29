<?php

/**
 * Runs through the normal PHP handler, cURL callbacks, and real HTTP transports.
 * Header filtering helpers alone cannot detect premature emission or corrupt framing.
 */
function test_header_transport($proxy_port, $upstream_port, $raw_port, $builtin = true) {
    $headers_url = "http://localhost:$upstream_port/headers";
    $raw_url = "http://localhost:$raw_port";
    $origin = 'Origin: http://localhost:5400';

    echo "\nHeader transport: client secrets and hop-by-hop fields\n";
    $blocked = [
        'cOoKiE', 'cOoKiE2', 'x-KaNdElO-pRoXy-SeSsIoN', 'kEeP-aLiVe',
        'pRoXy-AuThEnTiCaTe', 'pRoXy-AuThOrIzAtIoN', 'tE', 'tRaIlEr', 'uPgRaDe',
        'x-FoRwArDeD-fOr', 'x-Ip-PrOxY-tYpE', 'x-NoMiNaTeD-eArLy', 'x-NoMiNaTeD-lAtE',
    ];
    $incoming = array_map(fn($name) => "$name: private", $blocked);
    $incoming[] = 'Content-Length: 0';
    $incoming[] = 'Authorization: Bearer opted-in';
    $incoming[] = 'x-CoRs-PrOxY-aLlOwEd-ReQuEsT-hEaDeRs: AUTHORIZATION, Cookie2';
    $incoming[] = 'cOnNeCtIoN: X-NOMINATED-EARLY, x-nominated-late';
    $incoming[] = 'X-End-To-End: kept';
    foreach ([$incoming, array_reverse($incoming)] as $ordered_headers) {
        $response = proxy_request($proxy_port, $headers_url, $ordered_headers);
        $received = json_decode($response['body'], true) ?? [];
        assert_true($response['http_code'] === 200, 'Filtered request should reach the upstream');
        foreach (array_merge($blocked, ['Connection', 'Content-Length', 'X-Cors-Proxy-Allowed-Request-Headers']) as $name) {
            assert_true(!isset($received[strtolower($name)]), "Request should remove $name");
        }
        assert_true(($received['authorization'] ?? '') === 'Bearer opted-in', 'Authorization opt-in survives');
        assert_true(($received['x-end-to-end'] ?? '') === 'kept', 'Ordinary request headers survive');
    }
    $response = proxy_request($proxy_port, $headers_url, ['Authorization: Bearer not-opted-in']);
    assert_true(!isset(json_decode($response['body'], true)['authorization']), 'Implicit Authorization is removed');
    $response = proxy_request($proxy_port, $headers_url, [
        'Authorization: Bearer nominated', 'X-Cors-Proxy-Allowed-Request-Headers: Authorization',
        'Connection: Authorization, Range', 'X-Cors-Proxy-Range: bytes=0-1',
    ]);
    $received = json_decode($response['body'], true) ?? [];
    assert_true(!isset($received['authorization']), 'Connection overrides Authorization opt-in');
    assert_true(!isset($received['range']), 'Range tunnel cannot resurrect a nominated Range');

    echo "\nHeader transport: upstream fields and proxy-owned headers\n";
    $blocked = [
        'Set-Cookie', 'Set-Cookie2', 'Authorization', 'WWW-Authenticate', 'Strict-Transport-Security',
        'Upgrade-Insecure-Requests', 'Clear-Site-Data', 'Content-Security-Policy',
        'Content-Security-Policy-Report-Only', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy',
        'X-Kandelo-Proxy-Session', 'X-Spacefast-Private', 'X-Stattic-Private',
        'Access-Control-Max-Age', 'Access-Control-Future', 'Keep-Alive', 'Proxy-Authenticate',
        'Proxy-Authorization', 'TE', 'Trailer', 'Upgrade', 'X-Accel-Redirect', 'X-LiteSpeed-Location',
        'X-Sendfile', 'Surrogate-Control', 'Cloudflare-CDN-Cache-Control',
        'X-Nominated-Early', 'X-Nominated-Late', 'X-Trailer', 'Content-Length',
    ];
    foreach (['first', 'last'] as $order) {
        $response = proxy_request($proxy_port, "$raw_url/filtered-connection-$order", [$origin]);
        assert_true($response['curl_errno'] === 0, 'Filtered chunked response has valid framing');
        assert_true($response['body'] === 'hello world', 'Header filtering preserves chunked body bytes');
        foreach ($blocked as $name) {
            assert_true(get_header_list($response['headers_raw'], $name) === [], "Response should remove $name");
        }
        foreach ([
            'x-playground-cors-proxy' => ['true'],
            'access-control-allow-origin' => ['http://localhost:5400'],
            'access-control-allow-credentials' => ['true'],
            'access-control-allow-methods' => ['get', 'head', 'post', 'options'],
            'access-control-expose-headers' => ['x-playground-cors-proxy', 'content-range', 'accept-ranges', 'etag'],
            'cross-origin-resource-policy' => ['cross-origin'],
            'vary' => ['origin'], 'cache-control' => ['no-cache'],
            'x-deployment-header' => ['kept'], 'x-end-to-end' => ['first', 'second'],
        ] as $name => $expected) {
            assert_true(get_header_list($response['headers_raw'], $name) === $expected, "Proxy owns $name");
        }
        assert_true(
            !in_array('x-attacker', get_header_list($response['headers_raw'], 'access-control-allow-headers')),
            'Upstream cannot extend the proxy preflight policy'
        );
        assert_true(
            get_header_list($response['headers_raw'], 'transfer-encoding') === ['chunked'],
            'Downstream gets fresh chunked framing'
        );
        // Connection: close may be generated by the downstream server itself.
        assert_true(
            !in_array('x-nominated-early', get_header_list($response['headers_raw'], 'connection')),
            'Upstream Connection nominations are never forwarded'
        );
    }

    echo "\nHeader transport: representation and transfer framing\n";
    foreach (['gzip', 'gzip-chunked'] as $path) {
        $response = proxy_request($proxy_port, "$raw_url/$path", [$origin, 'Accept-Encoding: gzip']);
        assert_true($response['curl_errno'] === 0, "$path should complete without transport errors");
        assert_true(
            @gzdecode($response['body']) === 'compressed representation',
            "$path should preserve compressed representation bytes"
        );
        assert_true(get_header_list($response['headers_raw'], 'content-encoding') === ['gzip'], "$path retains encoding");
        assert_true(
            get_header_list($response['headers_raw'], 'content-length') ===
                ($path === 'gzip' ? [(string) strlen($response['body'])] : []),
            "$path length must match actual representation bytes"
        );
    }
    foreach (['first', 'last'] as $order) {
        $response = proxy_request($proxy_port, "$raw_url/nominated-encoding-$order", [$origin]);
        assert_true($response['http_code'] === 502, 'Cannot relay compressed bytes without encoding metadata');
        assert_true(get_header_list($response['headers_raw'], 'content-encoding') === [], 'Error discards encoding');
        assert_true(get_header_list($response['headers_raw'], 'content-length') === [], 'Error discards encoded length');
        assert_only_proxy_headers($response, 'nominated encoding');
    }
    // The proxy does not advertise compressed transfer codings. cURL rejects
    // unsolicited ones; that error must not retain representation metadata.
    foreach (['transfer-gzip', 'transfer-and-content-gzip'] as $path) {
        $response = proxy_request($proxy_port, "$raw_url/$path", [$origin]);
        assert_true($response['http_code'] === 502, "$path rejects unsolicited transfer coding");
        assert_true(get_header_list($response['headers_raw'], 'content-length') === [], "$path removes stale length");
        assert_true(get_header_list($response['headers_raw'], 'content-encoding') === [], "$path removes stale encoding");
        assert_only_proxy_headers($response, $path);
    }
    $response = proxy_request($proxy_port, "$raw_url/chunked-length-last", [$origin]);
    assert_true($response['body'] === 'hello' && $response['curl_errno'] === 0, 'TE before CL also completes');
    assert_true(get_header_list($response['headers_raw'], 'content-length') === [], 'TE overrides a later CL');
    $response = proxy_request($proxy_port, "$raw_url/nominated-length", [$origin]);
    assert_true($response['body'] === 'hello', 'A nominated Content-Length does not lose body bytes');
    assert_true(get_header_list($response['headers_raw'], 'content-length') === [], 'Connection can remove Content-Length');
    $response = proxy_request($proxy_port, "$raw_url/early-hints", [$origin]);
    assert_true(get_header_list($response['headers_raw'], 'content-length') === ['5'], 'Interim nominations do not affect final headers');

    $response = proxy_request($proxy_port, "$raw_url/gzip", [$origin], 'HEAD');
    assert_true($response['body'] === '', 'Compressed HEAD has no body');
    assert_true(get_header_list($response['headers_raw'], 'content-encoding') === ['gzip'], 'HEAD preserves unchanged encoding metadata');
    $response = proxy_request($proxy_port, "$raw_url/chunked", [$origin], 'HEAD');
    assert_true($response['body'] === '', 'Chunked HEAD has no body');
    assert_true(get_header_list($response['headers_raw'], 'transfer-encoding') === [], 'HEAD does not generate chunk framing');
    $response = proxy_request($proxy_port, "http://localhost:$upstream_port/range", [$origin, 'Range: bytes=2-5']);
    assert_true($response['http_code'] === 206 && $response['body'] === 'cdef', 'Range bytes are preserved');
    assert_true(get_header_list($response['headers_raw'], 'content-length') === ['4'], 'Range retains its correct length');

    echo "\nHeader transport: response is delivered before the upstream finishes\n";
    $first_byte = null;
    $started = microtime(true);
    $body = '';
    $ch = curl_init("http://127.0.0.1:$proxy_port/cors-proxy.php?$raw_url/slow-chunked");
    curl_setopt_array($ch, [
        CURLOPT_TIMEOUT => 5,
        CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$first_byte, &$body, $started) {
            $first_byte ??= microtime(true) - $started;
            $body .= $data;
            return strlen($data);
        },
    ]);
    $ok = curl_exec($ch);
    $finished = microtime(true) - $started;
    assert_true($ok && $body === 'firstlast', 'Delayed chunked response is valid');
    assert_true($first_byte !== null && $finished - $first_byte > 0.5, 'First bytes arrive before final upstream chunk');

    echo "\nHeader transport: raw, chunked, wrapped, and reconstructed uploads\n";
    $upload_url = "http://localhost:$upstream_port/upload";
    $payload = "raw upload\0with binary bytes";
    $response = proxy_request($proxy_port, $upload_url, ['Content-Type: application/octet-stream'], 'POST', [
        CURLOPT_POSTFIELDS => $payload,
    ]);
    $received = json_decode($response['body'], true) ?? [];
    assert_true(($received['body'] ?? '') === $payload, 'Raw upload bytes survive');
    assert_true(($received['headers']['content-length'] ?? '') === (string) strlen($payload), 'cURL generates raw upload length');

    $position = 0;
    $response = proxy_request($proxy_port, $upload_url, ['Content-Type: application/octet-stream'], 'POST', [
        CURLOPT_UPLOAD => true,
        CURLOPT_READFUNCTION => function ($ch, $stream, $length) use ($payload, &$position) {
            $data = substr($payload, $position, $length);
            $position += strlen($data);
            return $data;
        },
    ]);
    $received = json_decode($response['body'], true) ?? [];
    assert_true($response['curl_errno'] === 0 && ($received['body'] ?? '') === $payload, 'Unknown-length chunked upload survives');
    // A production web server may compute the dechunked size before handing it to PHP.
    assert_true(
        !isset($received['headers']['content-length']) ||
            $received['headers']['content-length'] === (string) strlen($payload),
        'Chunked upload has either no length or the actual dechunked size'
    );

    $boundary = str_repeat('original-boundary-', 8);
    $multipart = "--$boundary\r\nContent-Disposition: form-data; name=\"field\"\r\n\r\nvalue\r\n" .
        "--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"upload.txt\"\r\n" .
        "Content-Type: text/plain\r\n\r\nuploaded contents\r\n--$boundary--\r\n";
    foreach ([false, true] as $wrapped) {
        $headers = $wrapped ? [
            'Content-Type: application/octet-stream',
            "X-Cors-Proxy-Content-Type: multipart/form-data; boundary=$boundary",
        ] : ["Content-Type: multipart/form-data; boundary=$boundary"];
        $response = proxy_request($proxy_port, $upload_url, $headers, 'POST', [CURLOPT_POSTFIELDS => $multipart]);
        $received = json_decode($response['body'], true) ?? [];
        assert_true($response['curl_errno'] === 0 && $response['http_code'] === 200, 'Multipart upload completes');
        assert_true(($received['fields']['field'] ?? '') === 'value', 'Multipart form field survives');
        assert_true(($received['files']['file']['contents'] ?? '') === 'uploaded contents', 'Multipart file survives');
        assert_true(($received['files']['file']['name'] ?? '') === 'upload.txt', 'Multipart filename survives');
        assert_true(!isset($received['headers']['x-cors-proxy-content-type']), 'Upload wrapper stays private');
        assert_true(
            ($received['headers']['content-length'] ?? '') !== '' &&
                (($received['headers']['content-length'] === (string) strlen($multipart)) === $wrapped),
            'Rebuilt multipart gets a fresh length; wrapped multipart retains the original bytes'
        );
    }

    $response = proxy_request($proxy_port, $upload_url, ['Content-Type: application/octet-stream'], 'POST', [
        CURLOPT_POSTFIELDS => str_repeat('x', 1024 * 1024),
    ]);
    assert_true($response['http_code'] === 413, 'Request size cap still rejects oversized uploads');

    $response = proxy_options($proxy_port, $headers_url, [$origin]);
    assert_true(get_header_list($response['headers_raw'], 'vary') === ['origin'], 'Preflight varies by Origin');
    assert_true(get_header_list($response['headers_raw'], 'cross-origin-resource-policy') === ['cross-origin'], 'Preflight owns CORP');
    if (!$builtin) {
        $response = proxy_request($proxy_port, "$raw_url/filtered-connection-last", ['Origin: https://untrusted.test']);
        assert_true(get_header_list($response['headers_raw'], 'access-control-allow-origin') === [], 'Upstream cannot grant CORS to a denied origin');
        assert_true(get_header_list($response['headers_raw'], 'x-playground-cors-proxy') === [], 'Upstream cannot forge a missing proxy marker');
        assert_true(get_header_list($response['headers_raw'], 'vary') === ['origin'], 'Denied origins also vary');
    }
}
