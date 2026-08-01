<?php

class CorsProxyException extends Exception
{
}

function get_target_url($server_data=null) {
    if ($server_data === null) {
        $server_data = $_SERVER;
    }

    $path_info = $server_data['PATH_INFO'] ?? '';
    if (str_starts_with($path_info, '/') && strlen($path_info) > 1) {
        return substr($path_info, 1);
    }

    $query_string = $server_data['QUERY_STRING'] ?? '';
    if (!empty($server_data['QUERY_STRING'])) {
        return $query_string;
    }

    return false;
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

    if (
        ( isset( $_SERVER['HTTP_HOST'] ) &&
            strcasecmp($_SERVER['HTTP_HOST'], $host) === 0) ||
        ( isset( $_SERVER['SERVER_ADDR'] ) &&
            strcasecmp($_SERVER['SERVER_ADDR'], $host) === 0)
    ) {
        throw new CorsProxyException("URL cannot target the CORS proxy host.");
    }

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

if (!function_exists('is_private_ip')) {
    function is_private_ip($ip) {
        return IpUtils::isPrivateIp($ip);
    }
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
        $privateRanges = [
            /**
             * Private addresses according to RFC 1918.
             *
             * See https://datatracker.ietf.org/doc/html/rfc1918#section-3.
             */
            ['10.0.0.0', '10.255.255.255'],
            ['172.16.0.0', '172.31.255.255'],
            ['192.168.0.0', '192.168.255.255'],

            /**
             * IPv4 reserves the entire class A address block 127.0.0.0/8 for
             * use as private loopback addresses.
             */
            ['127.0.0.0', '127.255.255.255'],
            /**
             * In April 2012, IANA allocated the 100.64.0.0/10 block of IPv4 addresses
             * specifically for use in carrier-grade NAT scenarios
             *
             * See https://datatracker.ietf.org/doc/html/rfc6598.
             */
            ['100.64.0.0', '100.127.255.255'],
            /**
             * Current (local, "this") network[1]
             * See https://datatracker.ietf.org/doc/html/rfc6890.
             */
            ["0.0.0.0", "0.255.255.255"],
            ["192.0.0.0", "192.0.0.255"],
            ["240.0.0.0", "255.255.255.255"],
            /**
             * https://datatracker.ietf.org/doc/html/rfc3927
             */
            ["169.254.0.0", "169.254.255.255"],
            /**
             * https://datatracker.ietf.org/doc/html/rfc2544
             */
            ["198.18.0.0", "198.19.255.255"],
            /**
             * https://datatracker.ietf.org/doc/html/rfc5737
             */
            ["198.51.100.0", "198.51.100.255"],
            ["203.0.113.0", "203.0.113.255"],
            ["192.0.2.0", "192.0.2.255"],
            ["192.88.99.0", "192.88.99.255"],
            /**
             * Multicast space
             * https://datatracker.ietf.org/doc/html/rfc5771
             */
            ["224.0.0.0", "239.255.255.255"],
            ["233.252.0.0", "233.252.0.255"],
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
        $privateRanges = [
            /**
             * The Local IPv6 addresses are created using a pseudo-randomly
             * allocated global ID (RFC 4193).
             *
             * See https://datatracker.ietf.org/doc/html/rfc4193#section-3
             */
            ['fc00::', 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
            ['fe80::', 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
            /*
             * Unspecified address
             */
            ["::","::"],
            /*
             * Loopback address
             */
            ["::1","::1"],
            /*
             * IPv4-mapped addresses
             */
            ["::ffff:0.0.0.0","::ffff:255.255.255.255"],
            ["::ffff:0:0","::ffff:ffff:ffff"],
            /*
             * IPv4-translated addresses
             */
            ["::ffff:0:0.0.0.0","::ffff:0:255.255.255.255"],
            ["::ffff:0:0:0","::ffff:0:ffff:ffff"],
            /*
             * IPv4/IPv6 translation
             * https://datatracker.ietf.org/doc/html/rfc6052
             */
            ["64:ff9b::0.0.0.0","64:ff9b::255.255.255.255"],
            ["64:ff9b::0:0","64:ff9b::ffff:ffff"],
            /*
             * IPv4/IPv6 translation
             * https://datatracker.ietf.org/doc/html/rfc8215
             */
            ["64:ff9b:1::","64:ff9b:1:ffff:ffff:ffff:ffff:ffff"],
            /*
             * Discard prefix
             * https://datatracker.ietf.org/doc/html/rfc6666
             */
            ["100::","100::ffff:ffff:ffff:ffff"],
            /*
             * Teredo tunneling
             * https://datatracker.ietf.org/doc/html/rfc4680
             */
            ["2001::","2001:0:ffff:ffff:ffff:ffff:ffff:ffff"],
            /*
             * ORCHIDv2
             * https://datatracker.ietf.org/doc/html/rfc7343
             */
            ["2001:20::","2001:2f:ffff:ffff:ffff:ffff:ffff:ffff"],
            /*
             * Addresses used in documentation and example source code.
             * https://datatracker.ietf.org/doc/html/rfc3849
             */
            ["2001:db8::","2001:db8:ffff:ffff:ffff:ffff:ffff:ffff"],
            /*
             * Deprecated 6to4 addressing scheme
             * https://datatracker.ietf.org/doc/html/rfc7526
             */
            ["2002::","2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff"],
            /*
             * SRv6 https://datatracker.ietf.org/doc/html/draft-ietf-6man-sids-06
             */
            ["5f00::","5f00:ffff:ffff:ffff:ffff:ffff:ffff:ffff"],
            /*
             * Multicast space
             */
            ["ff00::","ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"]
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
        // Convert IP addresses to binary format
        $ip = inet_pton($ip);
        $from = inet_pton($start);
        $to = inet_pton($end);

        // Check if the IP is valid and within the range
        if ($ip === false || $from === false || $to === false) {
            return false; // Invalid IP format
        }

        // Compare the binary representations
        return ($ip >= $from && $ip <= $to);
    }

}

/**
 * Filters headers by name, removing disallowed headers and enforcing opt-in requirements.
 *
 * @param array $php_headers {
 *  An associative array of headers.
 *  @type string $key Header name.
 * }
 * @param array $disallowed_headers       List of header names that are disallowed.
 * @param array $headers_requiring_opt_in List of header names that require opt-in
 *                                        via the X-Cors-Proxy-Allowed-Request-Headers header.
 *
 * @return array {
 *  Filtered headers.
 *  @type string $key Header name.
 */
function filter_headers_by_name(
    $php_headers,
    $disallowed_headers,
    $headers_requiring_opt_in = [],
) {
    $lowercased_php_headers = array_change_key_case($php_headers, CASE_LOWER);
    $disallowed_headers = array_map('strtolower', $disallowed_headers);
    $headers_requiring_opt_in = array_map('strtolower', $headers_requiring_opt_in);

    // Get explicitly allowed headers from X-Cors-Proxy-Allowed-Request-Headers
    $headers_opt_in_str =
        $lowercased_php_headers['x-cors-proxy-allowed-request-headers'] ?? '';
    $headers_with_opt_in = $headers_opt_in_str
        ? array_map('trim', explode(',', $headers_opt_in_str))
        : [];
    $headers_with_opt_in = array_map('strtolower', $headers_with_opt_in);

    // Filter headers
    return array_filter(
        $php_headers,
        function (
            $key
        ) use (
            $disallowed_headers,
            $headers_requiring_opt_in,
            $headers_with_opt_in,
        ) {
            $lower_key = strtolower($key);

            // Skip if disallowed
            if (in_array($lower_key, $disallowed_headers)) {
                return false;
            }

            // Skip if opt-in is required but not provided
            if (
                in_array($lower_key, $headers_requiring_opt_in) &&
                !in_array($lower_key, $headers_with_opt_in)
            ) {
                return false;
            }

            return true;
        },
        ARRAY_FILTER_USE_KEY
    );
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
    $target_hostname = parse_url($request_url, PHP_URL_HOST);
    if (!parse_url($redirect_location, PHP_URL_HOST)) {
        $redirect_path = parse_url($redirect_location, PHP_URL_PATH);
        if ($redirect_path && $redirect_path[0] !== '/') {
            $request_path = parse_url($request_url, PHP_URL_PATH);
            $request_path_parent = dirname($request_path);
            $redirect_location = $request_path_parent . '/' . $redirect_path;
        }

        $redirect_location = $target_hostname . $redirect_location;
    }

    if (!parse_url($redirect_location, PHP_URL_SCHEME)) {
        $target_scheme = parse_url($request_url, PHP_URL_SCHEME) ?: 'https';
        $redirect_location = "$target_scheme://$redirect_location";
    }

    $last_char = $proxy_absolute_url[strlen($proxy_absolute_url) - 1];
    if ($last_char !== '/' && $last_char !== '?') {
        $proxy_absolute_url .= '?';
    }
    return $proxy_absolute_url . $redirect_location;
}

/**
 * Whether the CORS proxy is running on the PHP built-in dev server.
 *
 * In dev, the proxy is accessed via a same-origin Vite proxy, so the
 * browser doesn't send an Origin header at all. We accept any origin
 * in this context so the X-Playground-Cors-Proxy marker is always
 * present and the client doesn't mistake the response for a firewall
 * interception.
 */
function is_local_dev_server() {
    return php_sapi_name() === 'cli-server';
}

/**
 * Answers whether CORS is allowed for the specified origin.
 */
function should_respond_with_cors_headers($host, $origin) {
    if (is_local_dev_server()) {
        return true;
    }

    if (empty($origin)) {
        return false;
    }

    $supported_origin_rules = [
        ['type' => 'match-exact', 'origin' => 'https://playground-preview.test'],
        ['type' => 'match-exact', 'origin' => 'https://playground.wordpress.net'],
        ['type' => 'match-exact', 'origin' => 'http://localhost'],
        ['type' => 'match-exact', 'origin' => 'http://127.0.0.1'],
        ['type' => 'match-exact', 'origin' => 'http://127.0.0.1:5400'],
        ['type' => 'match-exact', 'origin' => 'http://localhost:5400'],
        ['type' => 'match-exact', 'origin' => 'http://127.0.0.1:5401'],
        ['type' => 'match-exact', 'origin' => 'http://localhost:5401'],
        ['type' => 'match-exact', 'origin' => 'http://127.0.0.1:4400'],
        ['type' => 'match-exact', 'origin' => 'http://localhost:4400'],
    ];
    if (
        defined('PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES') &&
        is_array(PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES)
    ) {
        $supported_origin_rules =
            PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES;
    }

    return is_cors_proxy_origin_supported($origin, $supported_origin_rules);
}

/**
 * Whether an origin matches one of the configured origin rules.
 */
function is_cors_proxy_origin_supported($origin, $supported_origin_rules) {
    $origin_parts = parse_cors_proxy_origin($origin);
    if ($origin_parts === false) {
        return false;
    }

    foreach ($supported_origin_rules as $supported_origin_rule) {
        if (!is_array($supported_origin_rule)) {
            continue;
        }

        $rule_type = $supported_origin_rule['type'] ?? null;

        if ($rule_type === 'match-exact') {
            $supported_origin = $supported_origin_rule['origin'] ?? null;
            if (!is_string($supported_origin)) {
                continue;
            }

            if ($origin === $supported_origin) {
                return true;
            }

            continue;
        }

        if ($rule_type === 'match-subdomain') {
            if (
                cors_proxy_origin_matches_subdomain_rule(
                    $origin,
                    $origin_parts,
                    $supported_origin_rule
                )
            ) {
                return true;
            }

            continue;
        }
    }

    return false;
}

/**
 * Whether a parsed origin matches a subdomain rule.
 */
function cors_proxy_origin_matches_subdomain_rule(
    $origin,
    $origin_parts,
    $supported_origin_rule
) {
    $required_scheme = $supported_origin_rule['scheme'] ?? null;
    if ($required_scheme !== 'http' && $required_scheme !== 'https') {
        return false;
    }

    $required_host = $supported_origin_rule['host'] ?? null;
    if (!is_string($required_host) || $required_host === '') {
        return false;
    }

    if (!array_key_exists('port', $supported_origin_rule)) {
        return false;
    }

    $required_port = $supported_origin_rule['port'];
    if ($required_port !== null && !is_int($required_port)) {
        return false;
    }

    if (
        $required_port !== null &&
        ($required_port < 1 || $required_port > 65535)
    ) {
        return false;
    }

    $first_dot = strpos($origin_parts['host'], '.');
    if ($first_dot === false || $first_dot === 0) {
        return false;
    }

    $origin_first_host_label = substr(
        $origin_parts['host'],
        0,
        $first_dot
    );

    $port_suffix = '';
    if ($required_port !== null) {
        $port_suffix = ":{$required_port}";
    }

    $expected_host = "{$origin_first_host_label}.{$required_host}";
    $expected_origin =
        "{$required_scheme}://{$expected_host}{$port_suffix}";

    return strcasecmp($origin, $expected_origin) === 0;
}

/**
 * Parses a concrete HTTP(S) origin into the fields used by origin rules.
 */
function parse_cors_proxy_origin($origin) {
    if (!is_string($origin)) {
        return false;
    }

    if ($origin === '') {
        return false;
    }

    if (str_contains($origin, '*')) {
        return false;
    }

    if (filter_var($origin, FILTER_VALIDATE_URL) === false) {
        return false;
    }

    $origin_parts = parse_url($origin);
    if ($origin_parts === false) {
        return false;
    }

    $scheme = $origin_parts['scheme'] ?? null;
    if ($scheme !== 'http' && $scheme !== 'https') {
        return false;
    }

    $host = $origin_parts['host'] ?? null;
    if (!is_string($host) || $host === '') {
        return false;
    }

    if (isset($origin_parts['user'])) {
        return false;
    }

    if (isset($origin_parts['pass'])) {
        return false;
    }

    if (isset($origin_parts['path'])) {
        return false;
    }

    if (isset($origin_parts['query'])) {
        return false;
    }

    if (isset($origin_parts['fragment'])) {
        return false;
    }

    $port = $origin_parts['port'] ?? null;
    if ($port !== null && $port < 1) {
        return false;
    }

    if ($port !== null && $port > 65535) {
        return false;
    }

    return [
        'scheme' => $scheme,
        'host' => $host,
        'port' => $port,
    ];
}
