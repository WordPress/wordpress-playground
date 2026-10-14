<?php
/**
 * Fixed validation answer for the custom-port connection test.
 * Starting PHP with -d disable_functions=gethostbynamel lets us replace that
 * function here. cURL still uses its native resolver and connection code.
 */
function gethostbynamel($host) {
    return $host === 'validated-target.invalid' ? ['127.0.0.1'] : false;
}

// Allow the local upstream for this fixture; test 20 uses the real address filter.
function is_private_ip($ip) {
    return $ip === '127.0.0.1' ? false : IpUtils::isPrivateIp($ip);
}

require __DIR__ . '/../../cors-proxy.php';
