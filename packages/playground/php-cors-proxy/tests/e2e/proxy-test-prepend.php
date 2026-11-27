<?php

// Only the network-safety check is replaced; the handler and cURL path stay real.
function is_private_ip($ip) {
    return false;
}

// Simulate a header owned by deployment configuration.
header('X-Deployment-Header: kept');
