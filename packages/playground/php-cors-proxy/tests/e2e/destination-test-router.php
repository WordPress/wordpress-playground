<?php
/**
 * The test starts PHP with -d disable_functions=gethostbynamel, allowing this
 * replacement for the proxy's validation lookup. It does not change cURL's
 * resolver: cURL still resolves localhost to 127.0.0.1 through the OS.
 *
 * 22a: A hostname cURL cannot resolve is assigned to our reachable listener.
 * 22b: localhost is assigned an address that cannot accept TCP connections.
 *      If the proxy uses cURL's own answer, it reaches the wrong listener.
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
