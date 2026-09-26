<?php
/**
 * End-to-end tests for the CORS proxy Origin handling.
 *
 * Starts a mock upstream server and the CORS proxy, then sends real HTTP
 * requests through the proxy and asserts on CORS headers.
 *
 * Run: php tests/e2e/cors-proxy-e2e-test.php
 */

$failures = [];
$passes = 0;

function assert_true($condition, $message) {
    global $failures, $passes;
    if (!$condition) {
        $failures[] = $message;
        echo "  FAIL: $message\n";
    } else {
        $passes++;
    }
}

function assert_contains($needle, $haystack, $message) {
    assert_true(
        strpos($haystack, $needle) !== false,
        "$message (looking for '$needle')"
    );
}

function assert_not_contains($needle, $haystack, $message) {
    assert_true(
        strpos($haystack, $needle) === false,
        "$message (should not contain '$needle')"
    );
}

// ──────────────────────────────────────────────
// Start the mock upstream server
// ──────────────────────────────────────────────
$upstream_port = find_free_port();
$upstream_router = __DIR__ . '/upstream-mock-router.php';
$upstream_proc = start_php_server($upstream_port, $upstream_router);

// ──────────────────────────────────────────────
// Start the CORS proxy
// ──────────────────────────────────────────────
$proxy_port = find_free_port();
$proxy_dir = dirname(__DIR__, 2);
$proxy_router = __DIR__ . '/proxy-test-router.php';
$proxy_proc = start_php_server($proxy_port, $proxy_router, $proxy_dir);

$upstream_url = "http://127.0.0.1:$upstream_port/plain-text";
$range_url = "http://127.0.0.1:$upstream_port/range";
$headers_url = "http://127.0.0.1:$upstream_port/headers";

// These e2e tests run against the PHP built-in dev server (cli-server),
// which accepts every origin. This mirrors the real dev environment where
// the CORS proxy is accessed via a same-origin Vite proxy and the browser
// may not send an Origin header at all.

// ──────────────────────────────────────────────
// Test 1: Request with Origin echoes it back
// ──────────────────────────────────────────────
echo "\nTest 1: Request with Origin echoes it back\n";
$response = proxy_request($proxy_port, $upstream_url, [
    'Origin: http://localhost:5400',
]);
assert_contains(
    'access-control-allow-origin: http://localhost:5400',
    strtolower($response['headers_raw']),
    'Response should echo back the provided Origin'
);
assert_contains(
    'x-playground-cors-proxy: true',
    strtolower($response['headers_raw']),
    'Response should include X-Playground-Cors-Proxy header'
);

// ──────────────────────────────────────────────
// Test 2: Preflight (OPTIONS) works
// ──────────────────────────────────────────────
echo "\nTest 2: Preflight (OPTIONS)\n";
$response = proxy_options($proxy_port, $upstream_url, [
    'Origin: http://localhost:5400',
]);
assert_contains(
    'access-control-allow-origin: http://localhost:5400',
    strtolower($response['headers_raw']),
    'OPTIONS response should include Access-Control-Allow-Origin'
);
assert_contains(
    'access-control-allow-methods:',
    strtolower($response['headers_raw']),
    'OPTIONS response should include Access-Control-Allow-Methods'
);

// ──────────────────────────────────────────────
// Test 3: Missing Origin uses wildcard
// ──────────────────────────────────────────────
echo "\nTest 3: Missing Origin uses wildcard on dev server\n";
$response = proxy_request($proxy_port, $upstream_url, []);
assert_contains(
    'access-control-allow-origin: *',
    strtolower($response['headers_raw']),
    'Dev server should respond with Access-Control-Allow-Origin: * when no Origin sent'
);
assert_contains(
    'x-playground-cors-proxy: true',
    strtolower($response['headers_raw']),
    'Dev server should always include X-Playground-Cors-Proxy header'
);

// ──────────────────────────────────────────────
// Test 4: Any origin is accepted on dev server
// ──────────────────────────────────────────────
echo "\nTest 4: Any origin is accepted on dev server\n";
$response = proxy_request($proxy_port, $upstream_url, [
    'Origin: https://any-origin.example.com',
]);
assert_contains(
    'access-control-allow-origin: https://any-origin.example.com',
    strtolower($response['headers_raw']),
    'Dev server should accept any origin'
);
assert_contains(
    'x-playground-cors-proxy: true',
    strtolower($response['headers_raw']),
    'Dev server should include X-Playground-Cors-Proxy for any origin'
);

// ──────────────────────────────────────────────
// Test 5: Preflight allows the Range request header
// ──────────────────────────────────────────────
echo "\nTest 5: Preflight allows the Range request header\n";
// Browsers only treat simple `bytes=N-M` ranges as CORS-safelisted, so
// suffix and multi-part ranges need the proxy to allow Range explicitly.
$response = proxy_options($proxy_port, $range_url, [
    'Origin: http://localhost:5400',
    'Access-Control-Request-Method: GET',
    'Access-Control-Request-Headers: range',
]);
$allowed_headers = get_header_list($response['headers_raw'], 'access-control-allow-headers');
assert_true(
    in_array('range', $allowed_headers),
    'Preflight should list Range in Access-Control-Allow-Headers'
);
assert_true(
    in_array('x-cors-proxy-range', $allowed_headers),
    'Preflight should list X-Cors-Proxy-Range in Access-Control-Allow-Headers'
);

// ──────────────────────────────────────────────
// Test 6: Range request relays the partial response
// ──────────────────────────────────────────────
echo "\nTest 6: Range request relays the partial response\n";
$response = proxy_request($proxy_port, $range_url, [
    'Origin: http://localhost:5400',
    'Range: bytes=-3',
]);
assert_true(
    $response['http_code'] === 206,
    "Range response should have status 206 (got {$response['http_code']})"
);
assert_true(
    $response['body'] === 'xyz',
    "Range response body should be 'xyz' (got '{$response['body']}')"
);
assert_contains(
    'content-range: bytes 23-25/26',
    strtolower($response['headers_raw']),
    'Range response should relay Content-Range'
);
// The WP Cloud edge cache stores responses unless they opt out. Every
// range of a file shares one proxy URL, so a cached slice could be served
// for another range.
assert_contains(
    'cache-control: no-cache',
    strtolower($response['headers_raw']),
    'Range response should opt out of edge caching'
);
$exposed_headers = get_header_list($response['headers_raw'], 'access-control-expose-headers');
assert_true(
    in_array('content-range', $exposed_headers),
    'Content-Range should be exposed to the browser'
);
assert_true(
    in_array('accept-ranges', $exposed_headers),
    'Accept-Ranges should be exposed to the browser'
);
// Lets clients detect a target that changed between two range reads.
assert_true(
    in_array('etag', $exposed_headers),
    'ETag should be exposed to the browser'
);

// ──────────────────────────────────────────────
// Test 7: Unsatisfiable range relays 416 with the total size
// ──────────────────────────────────────────────
echo "\nTest 7: Unsatisfiable range relays 416 with the total size\n";
$response = proxy_request($proxy_port, $range_url, [
    'Range: bytes=100-',
]);
assert_true(
    $response['http_code'] === 416,
    "Unsatisfiable range should have status 416 (got {$response['http_code']})"
);
assert_contains(
    'content-range: bytes */26',
    strtolower($response['headers_raw']),
    'Unsatisfiable range should relay Content-Range with the total size'
);
assert_contains(
    'cache-control: no-cache',
    strtolower($response['headers_raw']),
    'Unsatisfiable range response should opt out of edge caching'
);

// ──────────────────────────────────────────────
// Test 8: Response size cap applies to the slice, not the whole file
// ──────────────────────────────────────────────
echo "\nTest 8: Response size cap applies to the slice, not the whole file\n";
$response = proxy_request($proxy_port, "$range_url?size=4294967296", [
    'Range: bytes=-3',
]);
assert_true(
    $response['http_code'] === 206,
    "Small range of a 4 GiB file should have status 206 (got {$response['http_code']})"
);
assert_true(
    $response['body'] === 'tuv',
    "Small range of a 4 GiB file should return 'tuv' (got '{$response['body']}')"
);

// ──────────────────────────────────────────────
// Test 9: Range requests ask the target for an unencoded body
// ──────────────────────────────────────────────
echo "\nTest 9: Range requests ask the target for an unencoded body\n";
// Byte offsets would address the compressed representation otherwise.
$response = proxy_request($proxy_port, $headers_url, [
    'Range: bytes=0-15',
    'Accept-Encoding: gzip, br',
]);
$upstream_headers = json_decode($response['body'], true) ?? [];
assert_true(
    ($upstream_headers['range'] ?? null) === 'bytes=0-15',
    'Target should receive the Range header'
);
assert_true(
    ($upstream_headers['accept-encoding'] ?? null) === 'identity',
    'Target should receive Accept-Encoding: identity (got ' .
        var_export($upstream_headers['accept-encoding'] ?? null, true) . ')'
);

// ──────────────────────────────────────────────
// Test 10: X-Cors-Proxy-Range is forwarded as Range
// ──────────────────────────────────────────────
echo "\nTest 10: X-Cors-Proxy-Range is forwarded as Range\n";
// Workaround for hosts whose front end strips Range before PHP sees it.
$response = proxy_request($proxy_port, $range_url, [
    'X-Cors-Proxy-Range: bytes=-3',
]);
assert_true(
    $response['http_code'] === 206 && $response['body'] === 'xyz',
    "X-Cors-Proxy-Range should produce a 206 with 'xyz' " .
        "(got {$response['http_code']} '{$response['body']}')"
);
$response = proxy_request($proxy_port, $headers_url, [
    'X-Cors-Proxy-Range: bytes=0-15',
    'Accept-Encoding: gzip, br',
]);
$upstream_headers = json_decode($response['body'], true) ?? [];
assert_true(
    ($upstream_headers['range'] ?? null) === 'bytes=0-15',
    'Target should receive X-Cors-Proxy-Range as Range'
);
assert_true(
    ($upstream_headers['accept-encoding'] ?? null) === 'identity',
    'Target should receive Accept-Encoding: identity for X-Cors-Proxy-Range'
);
assert_true(
    !array_key_exists('x-cors-proxy-range', $upstream_headers),
    'Target should not receive the X-Cors-Proxy-Range header'
);

// ──────────────────────────────────────────────
// Clean up
// ──────────────────────────────────────────────
proc_terminate($upstream_proc);
proc_close($upstream_proc);
proc_terminate($proxy_proc);
proc_close($proxy_proc);

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
echo "\n" . str_repeat('─', 50) . "\n";
if (empty($failures)) {
    echo "All $passes assertions passed.\n";
    exit(0);
} else {
    echo count($failures) . " assertion(s) FAILED, $passes passed.\n";
    foreach ($failures as $i => $f) {
        echo "  " . ($i + 1) . ") $f\n";
    }
    exit(1);
}

// ══════════════════════════════════════════════
// Helper functions
// ══════════════════════════════════════════════

function find_free_port() {
    $sock = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
    socket_bind($sock, '127.0.0.1', 0);
    socket_getsockname($sock, $addr, $port);
    socket_close($sock);
    return $port;
}

function start_php_server($port, $router = null, $docroot = null) {
    $cmd = "exec " . escapeshellarg(PHP_BINARY) . " -S 127.0.0.1:$port";
    if ($docroot) {
        $cmd .= " -t " . escapeshellarg($docroot);
    }
    if ($router) {
        $cmd .= " " . escapeshellarg($router);
    }

    // Inherit the parent environment so the child process keeps PATH and
    // other settings the PHP binary may need.
    $env = array_merge(getenv(), [
        'PLAYGROUND_CORS_PROXY_DISABLE_RATE_LIMIT' => '1',
    ]);
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $proc = proc_open($cmd, $descriptors, $pipes, null, $env);
    if (!is_resource($proc)) {
        echo "Failed to start PHP server on port $port\n";
        exit(1);
    }
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $start = microtime(true);
    while (microtime(true) - $start < 5) {
        $conn = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
        if ($conn) {
            fclose($conn);
            return $proc;
        }
        usleep(50_000);
    }

    echo "Server on port $port failed to start within 5s\n";
    proc_terminate($proc);
    proc_close($proc);
    exit(1);
}

/**
 * Returns the lowercased, comma-separated values of a response header.
 */
function get_header_list($headers_raw, $name) {
    $values = [];
    foreach (explode("\r\n", $headers_raw) as $line) {
        $colon_pos = strpos($line, ':');
        if ($colon_pos === false) {
            continue;
        }
        if (strcasecmp(trim(substr($line, 0, $colon_pos)), $name) !== 0) {
            continue;
        }
        foreach (explode(',', substr($line, $colon_pos + 1)) as $value) {
            $values[] = strtolower(trim($value));
        }
    }
    return $values;
}

function proxy_request($proxy_port, $upstream_url, $extra_headers = []) {
    $ch = curl_init("http://127.0.0.1:$proxy_port/cors-proxy.php?$upstream_url");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $extra_headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $raw = curl_exec($ch);
    if ($raw === false) {
        echo "  curl error: " . curl_error($ch) . "\n";
        return ['headers_raw' => '', 'body' => '', 'http_code' => 0];
    }

    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    return [
        'headers_raw' => substr($raw, 0, $header_size),
        'body' => substr($raw, $header_size),
        'http_code' => $http_code,
    ];
}

function proxy_options($proxy_port, $upstream_url, $extra_headers = []) {
    $ch = curl_init("http://127.0.0.1:$proxy_port/cors-proxy.php?$upstream_url");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'OPTIONS');
    curl_setopt($ch, CURLOPT_HTTPHEADER, $extra_headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $raw = curl_exec($ch);
    if ($raw === false) {
        echo "  curl error: " . curl_error($ch) . "\n";
        return ['headers_raw' => '', 'body' => '', 'http_code' => 0];
    }

    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    return [
        'headers_raw' => substr($raw, 0, $header_size),
        'body' => substr($raw, $header_size),
        'http_code' => $http_code,
    ];
}
