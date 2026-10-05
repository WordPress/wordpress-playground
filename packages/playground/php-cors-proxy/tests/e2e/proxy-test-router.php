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

// Simulate a header set by a deployment's config or auto_prepend_file.
// When the proxy replaces the target's response with its own error, it
// must keep headers like this one, which were set before the target was
// contacted. The e2e tests check that its 413 and 502 responses do.
header('X-Deployment-Header: kept');

require __DIR__ . '/../../cors-proxy.php';
