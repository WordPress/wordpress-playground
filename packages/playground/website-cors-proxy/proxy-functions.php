<?php

class CorsProxyException extends Exception
{
}

function get_target_url($server_data=null) {
    if ($server_data === null) {
        $server_data = $_SERVER;
    }
    $requestUri = $server_data['REQUEST_URI'];
    $targetUrl = $requestUri;

    // Remove the current script name from the beginning of $targetUrl
    if (strpos($targetUrl, $server_data['SCRIPT_NAME']) === 0) {
        $targetUrl = substr($targetUrl, strlen($server_data['SCRIPT_NAME']));
    }

    // Remove the leading slash
    if ($targetUrl[0] === '/') {
        $targetUrl = substr($targetUrl, 1);
    }

    return $targetUrl;
}

function get_current_script_uri($targetUrl, $request_uri)
{
    return substr($request_uri, 0, -strlen($targetUrl));
}

function url_validate_and_resolve($url, $resolve_function='gethostbynamel') {
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        throw new CorsProxyException("Invalid URL: " . $url);
    }
    
    // Parse the URL to get its components
    $parsedUrl = parse_url($url);

    // Allow only http and https protocols
    if (!in_array($parsedUrl['scheme'], ['http', 'https'])) {
        throw new CorsProxyException("Invalid protocol: " . $parsedUrl['scheme']);
    }

    // Reject URLs containing username or password before the hostname
    if (isset($parsedUrl['user']) || isset($parsedUrl['pass'])) {
        throw new CorsProxyException("URL containing forbidden user or password information");
    }

    $host = $parsedUrl['host'];

    // Ensure the hostname does not resolve to a private IP
    $resolved_ips = $resolve_function($host);
    if ($resolved_ips === false) {
        throw new CorsProxyException("Hostname could not be resolved");
    }

    foreach ($resolved_ips as $ip) {
        if (is_private_ip($ip)) {
            throw new CorsProxyException("Private IPs are forbidden");
        }
    }

    return [
        'host' => $host,
        'ip' => $resolved_ips[0]
    ];
}

function is_private_ip($ip) {
    return IpUtils::isPrivateIp($ip);
}

class IpUtils
{
    /**
     * Checks if the given IP address is a private IP address.
     *
     * @param string $ip
     * @return bool
     */
    public static function isPrivateIp($ip)
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return self::isPrivateIpv4($ip);
        } elseif (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            return self::isPrivateIpv6($ip);
        }
        
        return false;
    }

    /**
     * Checks if the given IPv4 address is private.
     *
     * @param string $ip
     * @return bool
     */
    private static function isPrivateIpv4($ip)
    {
        // Private IPv4 address ranges
        $privateRanges = [
            ['10.0.0.0', '10.255.255.255'],
            ['172.16.0.0', '172.31.255.255'],
            ['192.168.0.0', '192.168.255.255'],
            ['127.0.0.0', '127.255.255.255'], // Loopback
        ];

        foreach ($privateRanges as $range) {
            if (self::ipv4InRange($ip, $range[0], $range[1])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if the given IPv6 address is private.
     *
     * @param string $ip
     * @return bool
     */
    private static function isPrivateIpv6($ip)
    {
        // Private IPv6 address ranges
        $privateRanges = [
            ['fc00::', 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'], // Unique Local Address
            ['fe80::', 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'], // Link-local Addresses
            ['::1', '::1'], // Loopback
        ];

        foreach ($privateRanges as $range) {
            if (self::ipv6InRange($ip, $range[0], $range[1])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if the given IPv4 address is within the specified range.
     *
     * @param string $ip
     * @param string $start
     * @param string $end
     * @return bool
     */
    private static function ipv4InRange($ip, $start, $end)
    {
        $ip = ip2long($ip);
        $start = ip2long($start);
        $end = ip2long($end);

        return $ip !== false && $start !== false && $end !== false && $ip >= $start && $ip <= $end;
    }

    /**
     * Checks if the given IPv6 address is within the specified range.
     *
     * @param string $ip
     * @param string $start
     * @param string $end
     * @return bool
     */
    private static function ipv6InRange($ip, $start, $end)
    {
        $ip = unpack("H*hex", inet_pton($ip))['hex'];
        $start = unpack("H*hex", inet_pton($start))['hex'];
        $end = unpack("H*hex", inet_pton($end))['hex'];

        return $ip >= $start && $ip <= $end;
    }
}


function filter_headers_strings($php_headers, $remove_headers) {
    $remove_headers = array_map('strtolower', $remove_headers);
    $headers = [];
    foreach ($php_headers as $header) {
        $lower_header = strtolower($header);
        foreach($remove_headers as $remove_header) {
            if (strpos($lower_header, $remove_header) === 0) {
                continue 2;
            }
        }
        $headers[] = $header;
    }
    return $headers;
}

function kv_headers_to_curl_format($headers) {
    $curl_headers = [];
    foreach ($headers as $key => $value) {
        $curl_headers[] = $key . ': ' . $value;
    }
    return $curl_headers;
}

function rewrite_relative_redirect(
    $request_url,
    $redirect_location,
    $proxy_absolute_url
) {
    $is_redirect_relative = parse_url($redirect_location, PHP_URL_SCHEME) === null;
    if($is_redirect_relative) {
        $target_scheme = parse_url($request_url, PHP_URL_SCHEME);
        $target_hostname = parse_url($request_url, PHP_URL_HOST);
        $redirect_location = $target_scheme . '://' . $target_hostname . $redirect_location;
    }
    if ($proxy_absolute_url[strlen($proxy_absolute_url) - 1] !== '/') {
        $proxy_absolute_url .= '/';
    }
    return $proxy_absolute_url . $redirect_location;
}
