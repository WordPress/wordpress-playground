<?php
/**
 * The test starts PHP with -d disable_functions=gethostbynamel, allowing this
 * replacement for the proxy's validation lookup. cURL handles localhost
 * internally as loopback, without a DNS lookup; that behavior is unchanged.
 *
 * 22a: A hostname cURL cannot resolve is assigned to our reachable listener.
 * 22b: localhost is assigned an address that cannot accept TCP connections.
 *      If the proxy falls back to cURL's built-in mapping, it reaches the wrong
 *      listener. This checks connection fallback, not DNS query counts.
 */
function gethostbynamel($host) {
    $answers = [
        'approved-target.invalid' => ['127.0.0.1'],
        'localhost' => ['255.255.255.255'],
    ];
    return $answers[$host] ?? false;
}

// These addresses would be rejected in production. Permit the fixture answers
// so 22a/22b reach the connection code. Test 21 uses the real address filter.
function is_private_ip($ip) {
    return in_array($ip, ['127.0.0.1', '255.255.255.255'], true) ? false : IpUtils::isPrivateIp($ip);
}

require __DIR__ . '/../../cors-proxy.php';
