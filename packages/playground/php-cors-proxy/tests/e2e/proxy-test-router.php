<?php
/**
 * PHP built-in server router for the proxy under test. The same prepend
 * fixture also runs under FastCGI for production transport coverage.
 */
require __DIR__ . '/proxy-test-prepend.php';
require __DIR__ . '/../../cors-proxy.php';
