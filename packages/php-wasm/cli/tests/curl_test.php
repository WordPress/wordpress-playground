<?php
// Verifies that curl can verify HTTPS peers using the CA bundle that
// php-wasm-cli installs via the `curl.cainfo` ini entry.

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.wordpress.org/stats/php/1.0/');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
$result = curl_exec($ch);
$error = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($result === false || $code !== 200) {
    echo "curl test failed! HTTP code: $code, error: $error\n";
    exit(1);
}

$json = json_decode($result, true);
if (!is_array($json) || !array_key_exists('8.3', $json)) {
    echo "curl test failed! Unexpected response body: " . substr((string) $result, 0, 200) . "\n";
    exit(1);
}

echo "curl test passed!\n";
exit(0);
