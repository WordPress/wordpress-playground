<?php
// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0);

define('MAX_REQUEST_SIZE', 1 * 1024 * 1024); // 1MB
define('MAX_RESPONSE_SIZE', 100 * 1024 * 1024); // 100MB
require_once __DIR__ . '/cors-proxy-functions.php';

$config_file = __DIR__ . '/cors-proxy-config.php';
if (file_exists($config_file)) {
    require_once $config_file;
}

$server_host = $_SERVER['HTTP_HOST'] ?? '';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (should_respond_with_cors_headers($server_host, $origin)) {
    // On the dev server, the browser doesn't send an Origin header
    // (same-origin request via Vite proxy), so fall back to wildcard.
    $allow_origin = (is_local_dev_server() && empty($origin)) ? '*' : $origin;
    header('Access-Control-Allow-Origin: ' . $allow_origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, Authorization, Content-Type, git-protocol, Range, wp_blog, wp_install, x-cors-proxy-allowed-request-headers, x-cors-proxy-content-type, x-cors-proxy-range');
    // Identify this response as coming from the legitimate CORS proxy.
    // Network firewalls may intercept requests and return error responses
    // without this header, allowing clients to detect interference.
    header('X-Playground-Cors-Proxy: true');
    // These are not CORS-safelisted response headers, so browsers hide them
    // from range request callers by default. ETag lets callers detect a
    // target that changed between two range reads.
    header('Access-Control-Expose-Headers: X-Playground-Cors-Proxy, Content-Range, Accept-Ranges, ETag');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Allow: GET, POST, OPTIONS");
    exit;
}

// Handle only GET and POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo "Method Not Allowed";
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['CONTENT_LENGTH'] >= MAX_REQUEST_SIZE) {
    http_response_code(413);
    echo "Request Entity Too Large";
    exit;
}

// @TODO: Consider redirecting to the target URL if presented with a non-browser user agent.

if (function_exists('playground_cors_proxy_maybe_rate_limit')) {
    playground_cors_proxy_maybe_rate_limit();
} else if (
    !getenv('PLAYGROUND_CORS_PROXY_DISABLE_RATE_LIMIT') && (
        !defined('PLAYGROUND_CORS_PROXY_DISABLE_RATE_LIMIT') ||
        !PLAYGROUND_CORS_PROXY_DISABLE_RATE_LIMIT
    )
) {
    http_response_code(503);
    echo "Server needs to configure rate-limiting.";
    exit;
}

// Get the full target URL from the request path
$targetUrl = get_target_url($_SERVER);
if(!$targetUrl) {
    http_response_code(400);
    echo "Bad Request\n\nNo URL provided";
    exit;
}

try {
    $resolved = url_validate_and_resolve($targetUrl);
} catch (CorsProxyException $e) {
    http_response_code(400);
    echo "Bad Request\n\n" . $e->getMessage();
    exit;
}

$host = $resolved['host'];
$resolvedIp = $resolved['ip'];

define(
    'CURRENT_SCRIPT_URI',
    get_current_script_uri($targetUrl, $_SERVER['REQUEST_URI'])
);

$ch = curl_init($targetUrl);

$is_chunked_response = false;
$http_code_sent = false;

$relay_http_code_and_initial_headers_if_not_already_sent = function () use ($ch, &$http_code_sent) {
    if (!$http_code_sent) {
        // Set the response code from the target server
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        http_response_code($http_code);

        // Avoid stale, cached responses. This also keeps the WP Cloud edge
        // cache from storing responses. Every range of a file shares one
        // proxy URL, so a cached slice could be served for another range.
        // The target's own Cache-Control is never relayed.
        header('Cache-Control: no-cache');

        $http_code_sent = true;
    }
};

function send_response_chunk($data) {
    if (should_send_as_chunked_response()) {
        // We need to manually chunk the response when running in the PHP
        // built-in server. It won't handle that for us.
        echo sprintf("%s\r\n%s\r\n", dechex(strlen($data)), $data);
    } else {
        // When running behing an Apache or Nginx or another webserver,
        // it will handle the chunking for us. Manually sending the chunk
        // header, \r\n separator, body, and \r\n trailer isn't just
        // unnecessary, but it would actually include those bytes in the
        // response body.
        echo $data;
    }
    @ob_flush();
    @flush();
}

/**
 * We need to manually chunk the response when running the PHP
 * dev server AND the transfer-encoding header is set to chunked.
 *
 * Apache, Nginx, etc. will handle the chunking for us.
 */
function should_send_as_chunked_response() {
    global $is_chunked_response;
    return $is_chunked_response && php_sapi_name() === 'cli-server';
}

// Pin the hostname resolution to an IP we've resolved earlier
curl_setopt($ch, CURLOPT_RESOLVE, [
    "$host:80:$resolvedIp",
    "$host:443:$resolvedIp"
]);

$allHeaders = getallheaders();

// If the browser wrapped Content-Type to prevent PHP from consuming
// multipart/form-data bodies, extract the original value to restore
// it for the outgoing request. PHP automatically parses
// multipart/form-data into $_POST/$_FILES, emptying php://input and
// making it impossible for the proxy to forward the raw body.
$originalContentType = null;
foreach ($allHeaders as $name => $value) {
    if (strcasecmp($name, 'X-Cors-Proxy-Content-Type') === 0) {
        // Reject values containing CR/LF to prevent header injection.
        if (!preg_match('/[\r\n]/', $value)) {
            $originalContentType = $value;
        }
        break;
    }
}

// WORKAROUND: As of 2026-09-26, the WP Cloud front end of the production
// deployment strips the Range header before the request reaches PHP, so
// clients may send the same value as X-Cors-Proxy-Range instead. Remove
// this, the matching Access-Control-Allow-Headers entry, and the README
// note once Range reaches this script on WP Cloud.
$tunneledRange = null;
foreach ($allHeaders as $name => $value) {
    if (strcasecmp($name, 'X-Cors-Proxy-Range') === 0) {
        // Ignore empty values, which curl would treat as removing Range.
        // Reject values containing CR/LF to prevent header injection.
        $value = trim($value);
        if ($value !== '' && !preg_match('/[\r\n]/', $value)) {
            $tunneledRange = $value;
        }
        break;
    }
}
// Range takes priority. When both headers arrive, they must match:
// forwarding either one would silently ignore the other.
$clientRange = trim(array_change_key_case($allHeaders, CASE_LOWER)['range'] ?? '');
if ($tunneledRange !== null && $clientRange !== '') {
    if ($clientRange !== $tunneledRange) {
        http_response_code(400);
        echo "Bad Request\n\nRange and X-Cors-Proxy-Range disagree";
        exit;
    }
    $tunneledRange = null;
}

$strictly_disallowed_headers = [
    // Cookies represent a relationship between the proxy server
    // and the client, so it is inappropriate to forward them.
    'Cookie',
    // Drop the incoming Host header because it identifies the
    // proxy server, not the target server.
    'Host',
    // Internal header for Content-Type wrapping. Must not be
    // forwarded to the target server.
    'X-Cors-Proxy-Content-Type',
    // Internal header for the Range workaround. Must not be
    // forwarded to the target server.
    'X-Cors-Proxy-Range',
];
$headers_requiring_opt_in = [
    // Allow Authorization header to be forwarded only if the client
    // explicitly opts in to avoid undesirable situations such as:
    // - a browser auto-sending basic auth with every proxy request
    // - the proxy forwarding the basic auth values to all target servers
    'Authorization'
];
$curlHeaders = kv_headers_to_curl_format(
    filter_headers_by_name(
        $allHeaders,
        $strictly_disallowed_headers,
        $headers_requiring_opt_in,
    )
);

// If Content-Type was wrapped, replace the placeholder
// application/octet-stream with the original value so the target
// server receives the correct Content-Type.
if ($originalContentType !== null) {
    $curlHeaders = array_values(array_filter(
        $curlHeaders,
        fn($h) => stripos($h, 'Content-Type:') !== 0
    ));
    $curlHeaders[] = 'Content-Type: ' . $originalContentType;
}

if ($tunneledRange !== null) {
    $curlHeaders = array_values(array_filter(
        $curlHeaders,
        fn($h) => stripos($h, 'Range:') !== 0
    ));
    $curlHeaders[] = 'Range: ' . $tunneledRange;
}

// A range addresses bytes of the encoded representation, so ask the
// target for an unencoded one. Browsers already send identity with
// Range requests, but a server in front of this script may rewrite
// Accept-Encoding before the request gets here.
$has_range = !empty(array_filter(
    $curlHeaders,
    fn($h) => stripos($h, 'Range:') === 0
));
if ($has_range) {
    $curlHeaders = array_values(array_filter(
        $curlHeaders,
        fn($h) => stripos($h, 'Accept-Encoding:') !== 0
    ));
    $curlHeaders[] = 'Accept-Encoding: identity';
}

curl_setopt(
    $ch,
    CURLOPT_HTTPHEADER,
    array_merge(
        $curlHeaders,
        [
            "Host: $host",
            // @TODO: Consider relaying client IP with the following reasoning:
            // Let's not take full credit for the proxied request.
            // This is a CORS proxy, not an IP anonymizer.
            // NOTE: We cannot do this reliably based on X-Forwarded-For unless
            // we trust the reverse proxy, so it cannot be done unconditionally
            // in this script because we do not control where others deploy it.
        ],
    )
);

// Set options to stream data
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt(
    $ch,
    CURLOPT_HEADERFUNCTION,
    function(
        $curl,
        $header
    ) use (
        $targetUrl,
        $relay_http_code_and_initial_headers_if_not_already_sent,
        &$is_chunked_response
    ) {
        @$relay_http_code_and_initial_headers_if_not_already_sent();

        $len = strlen($header);
        $colonPos = strpos($header, ':');

        if ($colonPos === false) {
            return $len;
        }

        $name = strtolower(substr($header, 0, $colonPos));
        $value = trim(substr($header, $colonPos + 1));

        if($name === 'content-length') {
            $content_length = intval($value);
            if ($content_length >= MAX_RESPONSE_SIZE) {
                // Drop relayed headers that describe the rejected body.
                foreach ([
                    'Content-Type',
                    'Content-Encoding',
                    'Content-Range',
                    'Accept-Ranges',
                    'ETag',
                    'Last-Modified',
                ] as $body_header) {
                    header_remove($body_header);
                }
                http_response_code(413);
                send_response_chunk("Response Too Large");
                exit;
            }
            return $len;
        }

        if ($name === 'transfer-encoding' && stripos($value, 'chunked') !== false) {
            $is_chunked_response = true;
            header($header, false);
            return $len;
        }

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
            // Safari fails with "Cannot connect to the server" if we let
            // the HTTP/2 line be relayed. This proxy doesn't support HTTP/2,
            // so let's not allow the HTTP line to explicitly pass through.
            // PHP already provides the HTTP version in the response code anyway.
            stripos($header, 'HTTP/') !== 0 &&
            // The proxy server does not support relaying auth challenges.
            // Specifically, we want to avoid browsers prompting for basic auth
            // credentials which they will send to the proxy server for the
            // remainder of the session.
            stripos($header, 'Set-Cookie:') !== 0 &&
            stripos($header, 'Authorization:') !== 0 &&
            stripos($header, 'WWW-Authenticate:') !== 0 &&
            stripos($header, 'Cache-Control:') !== 0 &&
            // The browser won't accept multiple values for these headers.
            stripos($header, 'Access-Control-Allow-Origin:') !== 0 &&
            stripos($header, 'Access-Control-Allow-Credentials:') !== 0 &&
            stripos($header, 'Access-Control-Allow-Methods:') !== 0 &&
            stripos($header, 'Access-Control-Allow-Headers:') !== 0 &&
            // HSTS headers have consequences for the entire domain. Let's not
            // allow any remote site to decide on the CORS proxy HSTS policy.
            // Besides, they won't work with the http-only local dev server.
            stripos($header, 'Strict-Transport-Security:') !== 0 &&
            stripos($header, 'Upgrade-Insecure-Requests:') !== 0
        ) {
            header($header, false);
        }
        return $len;
    }
);

curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($curl, $data) use (&$is_chunked_response) {
    send_response_chunk($data, $is_chunked_response);
    return strlen($data);
});

// Handle request method and data
$requestMethod = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $requestMethod);

if ($requestMethod !== 'GET' && $requestMethod !== 'HEAD' && $requestMethod !== 'OPTIONS') {
    // php://input is not available for multipart/form-data requests
    // because PHP parses the body into $_POST and $_FILES, consuming
    // the input stream. For such requests, we reconstruct the body
    // using CURLOPT_POSTFIELDS with CURLFile objects for any uploaded
    // files.
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'multipart/form-data') !== false && (!empty($_POST) || !empty($_FILES))) {
        $postFields = $_POST;
        foreach ($_FILES as $name => $fileInfo) {
            $postFields[$name] = new CURLFile(
                $fileInfo['tmp_name'],
                $fileInfo['type'] ?: 'application/octet-stream',
                $fileInfo['name']
            );
        }
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        // Strip the incoming Content-Type and Content-Length headers.
        // CURLOPT_POSTFIELDS with an array generates a new multipart
        // boundary, and we must let PHP curl set its own Content-Type
        // to match. The original Content-Type from the browser has a
        // different boundary that doesn't match the reconstructed body.
        $filteredHeaders = array_values(array_filter(
            $curlHeaders,
            fn($h) => stripos($h, 'Content-Type:') !== 0
                   && stripos($h, 'Content-Length:') !== 0
        ));
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge(
            $filteredHeaders,
            ["Host: $host"],
        ));
    } else {
        $input = fopen('php://input', 'r');
        curl_setopt($ch, CURLOPT_UPLOAD, true);
        curl_setopt($ch, CURLOPT_INFILE, $input);
        curl_setopt($ch, CURLOPT_INFILESIZE, $_SERVER['CONTENT_LENGTH']);
    }
}

// Execute cURL session
$target_failed_mid_response = false;
if (!curl_exec($ch)) {
    if ($http_code_sent) {
        // The target's status and headers were already relayed. An error
        // message appended now would look like part of the target's body,
        // so end the response instead.
        $target_failed_mid_response = true;
    } else {
        http_response_code(502);
        send_response_chunk("Bad Gateway – curl_exec error: " . curl_error($ch));
    }
} else {
    @$relay_http_code_and_initial_headers_if_not_already_sent();
}
// Close cURL session
if (version_compare(PHP_VERSION, '8.5', '<')) {
    // curl_close is deprecated in PHP 8.5 and later.
    // See https://www.php.net/manual/en/migration85.deprecated.php#migration85.deprecated.curl
    curl_close($ch);
}

// Only send chunked transfer encoding footer if we're using chunked encoding.
// We need to manually send the footer when running in the PHP built-in server
// because, unlike apache or nginx, it won't handle that for us.
// Leave it off after a target failure so the client sees an incomplete
// response.
if (should_send_as_chunked_response() && !$target_failed_mid_response) {
    echo "0\r\n\r\n";
}
