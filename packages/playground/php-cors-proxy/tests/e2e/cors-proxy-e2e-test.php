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
    $cmd = "exec php -S 127.0.0.1:$port";
    if ($docroot) {
        $cmd .= " -t " . escapeshellarg($docroot);
    }
    if ($router) {
        $cmd .= " " . escapeshellarg($router);
    }

    $env = [
        'PLAYGROUND_CORS_PROXY_DISABLE_RATE_LIMIT' => '1',
    ];
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

function proxy_request($proxy_port, $upstream_url, $extra_headers = []) {
    $ch = curl_init("http://127.0.0.1:$proxy_port/cors-proxy.php?$upstream_url");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $extra_headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $raw = curl_exec($ch);
    if ($raw === false) {
        echo "  curl error: " . curl_error($ch) . "\n";
        curl_close($ch);
        return ['headers_raw' => '', 'body' => '', 'http_code' => 0];
    }

    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

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
        curl_close($ch);
        return ['headers_raw' => '', 'body' => '', 'http_code' => 0];
    }

    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'headers_raw' => substr($raw, 0, $header_size),
        'body' => substr($raw, $header_size),
        'http_code' => $http_code,
    ];
}
