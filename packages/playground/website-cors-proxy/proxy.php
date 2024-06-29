<?php
// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/proxy-functions.php';

// Set CORS headers
function set_cors_headers() {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
}

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    set_cors_headers();
    exit;
}

// Get the full target URL from the request path
$targetUrl = get_target_url($_SERVER);
$resolved = url_validate_and_resolve($targetUrl);
$host = $resolved['host'];
$resolvedIp = $resolved['ip'];

define(
    'CURRENT_SCRIPT_URI',
    get_current_script_uri($targetUrl, $_SERVER['REQUEST_URI'])
);

$ch = curl_init($targetUrl);

// Pin the hostname resolution to an IP we've resolved earlier
curl_setopt($ch, CURLOPT_RESOLVE, [
    "$host:80:$resolvedIp",
    "$host:443:$resolvedIp"
]);

// Pass all incoming headers except cookies and authorization
$curlHeaders = filter_headers_strings(
    kv_headers_to_curl_format(getallheaders()),
    [
        'Cookie',
        'Authorization',
        'Host'
    ]
);
curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge($curlHeaders, ["Host: $host"]));

// Set options to stream data
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $header) use($targetUrl) {
    $len = strlen($header);
    if (stripos($header, 'Location:') === 0) {
        // Adjust the redirection URL to go back to the proxy script
        $locationUrl = trim(substr($header, 9));
        $newLocation = rewrite_relative_redirect(
            $targetUrl, 
            $locationUrl, 
            CURRENT_SCRIPT_URI
        );
        header('Location: ' . $newLocation, true);
    } else if (
        stripos($header, 'Set-Cookie:') !== 0 && 
        stripos($header, 'Authorization:') !== 0
    ) {
        header($header, false);
    }
    return $len;
});
curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($curl, $data) {
    echo $data;
    ob_flush();
    flush();
    return strlen($data);
});

// Handle request method and data
$requestMethod = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $requestMethod);

if ($requestMethod !== 'GET' && $requestMethod !== 'HEAD') {
    $input = fopen('php://input', 'r');
    curl_setopt($ch, CURLOPT_UPLOAD, true);
    curl_setopt($ch, CURLOPT_INFILE, $input);
    curl_setopt($ch, CURLOPT_INFILESIZE, $_SERVER['CONTENT_LENGTH']);
}

// Execute cURL session
set_cors_headers();
if (!curl_exec($ch)) {
    http_response_code(502);
    echo "Bad Gateway – curl_exec error: " . curl_error($ch);
} else {
    // Set the response code from the target server
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    http_response_code($httpCode);
}

// Close cURL session
curl_close($ch);
