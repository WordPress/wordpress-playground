<?php
/**
 * Router script for the CORS proxy under test.
 *
 * The PHP built-in server uses this as a router. It overrides
 * is_private_ip() to allow the proxy to reach our localhost mock
 * upstream server, then hands off to cors-proxy.php.
 */

// Override is_private_ip so the proxy can reach our localhost mock server.
// cors-proxy-functions.php wraps its definition in function_exists(), so
// defining it here first takes precedence.
function is_private_ip($ip) {
    return false;
}

require __DIR__ . '/../../cors-proxy.php';
