<?php
/**
 * This server disables the native gethostbynamel function so only PHP's
 * validation lookup receives the fixture addresses. cURL's independent resolver
 * cannot resolve the .invalid hostname and resolves localhost to a different
 * address. The real handler must use PHP's validated address in both cases.
 */
function gethostbynamel($host) {
    $answers = [
        'approved-target.invalid' => ['127.0.0.1'],
        'localhost' => ['255.255.255.255'],
    ];
    return $answers[$host] ?? false;
}

// Allow only the approved nonpublic stand-ins. Tests of production private and
// reserved address rejection run separately without this override.
function is_private_ip($ip) {
    return in_array($ip, ['127.0.0.1', '255.255.255.255'], true) ? false : IpUtils::isPrivateIp($ip);
}

require __DIR__ . '/../../cors-proxy.php';
