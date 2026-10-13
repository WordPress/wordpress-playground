<?php
/**
 * This server disables the native gethostbynamel function so only PHP's
 * validation lookup receives the fixture address. cURL's independent resolver
 * cannot resolve the .invalid hostname. The real handler must pin its result
 * to reach the approved listener on the target's custom port.
 */
function gethostbynamel($host) {
    return $host === 'approved-target.invalid' ? ['127.0.0.1'] : false;
}

// Allow only the approved loopback stand-in. Tests of production private and
// reserved address rejection run separately without this override.
function is_private_ip($ip) {
    return $ip === '127.0.0.1' ? false : IpUtils::isPrivateIp($ip);
}

require __DIR__ . '/../../cors-proxy.php';
