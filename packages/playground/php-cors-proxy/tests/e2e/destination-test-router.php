<?php
/**
 * The test starts PHP with -d disable_functions=gethostbynamel, allowing this
 * replacement for the proxy's validation lookup. The ordinary .invalid hostname
 * has no localhost shortcut. The native observer separately counts cURL's
 * resolver starts, so tests 22a/22b can check both routing and extra resolution.
 *
 * /resolver-control bypasses validation and makes an unpinned cURL request.
 * It must trigger the observer, which aborts before any external DNS traffic.
 */
function gethostbynamel($host) {
    if (file_put_contents(
        getenv('PLAYGROUND_CORS_PROXY_TEST_RESOLVER_LOG'),
        "php-lookup\n",
        FILE_APPEND
    ) === false) {
        throw new RuntimeException('Could not record the validation lookup');
    }
    return $host === 'approved-target.invalid' ? ['127.0.0.1'] : false;
}

// Permit only the approved loopback stand-in. Test 21 uses the real address filter.
function is_private_ip($ip) {
    return $ip === '127.0.0.1' ? false : IpUtils::isPrivateIp($ip);
}

if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) === '/resolver-control') {
    $ch = curl_init('http://resolver-control.invalid/');
    curl_setopt_array($ch, [
        CURLOPT_PROXY => '',
        CURLOPT_TIMEOUT => 5,
    ]);
    $result = curl_exec($ch);
    header('Content-Type: application/json');
    echo json_encode(['lookup_failed' => $result === false && curl_errno($ch) !== 0]);
    exit;
}

require __DIR__ . '/../../cors-proxy.php';
