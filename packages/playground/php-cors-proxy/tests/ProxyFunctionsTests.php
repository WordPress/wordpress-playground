<?php

use PHPUnit\Framework\TestCase;

class ProxyFunctionsTests extends TestCase
{

    /**
     * 
     * @dataProvider providerIps
     */
    public function testIsPrivateIp($ip, $is_private)
    {
        $this->assertEquals($is_private, is_private_ip($ip), "IP $ip was not detected as " . ($is_private ? 'private' : 'public'));
    }

    static public function providerIps()
    {
        return [
            ['127.0.0.1', true],      // Loopback address
            ['192.168.1.1', true],    // Private network
            ['10.0.0.1', true],       // Private network
            ['172.16.0.1', true],     // Private network
            ['172.31.255.255', true], // Private network end
            ['8.8.8.8', false],       // Public IP address (Google DNS)
            ['54.239.28.85', false],  // Public IP address
            ['192.88.99.1', true], 
            ['::1', true],           // Loopback IPv6
            ['fd00::', true],        // Unique Local Address IPv6
            ['fe80::', true],        // Link-local IPv6 address
            ['2001:db8::', true],    
            ['64:ff9b::0:0', true],    
            ['2001:4860:4860::8888', false], // Google Public IPv6 DNS
            ['204.79.197.200', false] // Public IP address (Microsoft)
        ];
    }

    /**
     * 
     * @dataProvider providerRewriteRelativeRedirect
     */
    public function testRewriteRelativeRedirect($request_url, $redirect_location, $proxy_absolute_url, $expected)
    {
        $this->assertEquals($expected, rewrite_relative_redirect($request_url, $redirect_location, $proxy_absolute_url));
    }

    static public function providerRewriteRelativeRedirect() {
        return [
            'Relative redirect to a trailing slash path' => [
                'https://w.org/hosting',
                '/hosting/',
                'https://cors.playground.wordpress.net/proxy.php',
                'https://cors.playground.wordpress.net/proxy.php?https://w.org/hosting/'
            ],
            'Relative redirect when the proxy URL has a trailing slash itself' => [
                'https://w.org/hosting',
                '/hosting/',
                'https://cors.playground.wordpress.net/proxy.php/',
                'https://cors.playground.wordpress.net/proxy.php/https://w.org/hosting/'
            ],
            'Relative redirect with query params involved' => [
                'https://w.org/hosting',
                '/hosting/?utm_source=wporg',
                'https://cors.playground.wordpress.net/proxy.php',
                'https://cors.playground.wordpress.net/proxy.php?https://w.org/hosting/?utm_source=wporg'
            ],
            'Absolute redirect with query params involved' => [
                'https://w.org/hosting',
                'https://w.net/hosting/?utm_source=wporg',
                'https://cors.playground.wordpress.net/proxy.php',
                'https://cors.playground.wordpress.net/proxy.php?https://w.net/hosting/?utm_source=wporg'
            ],
            'Root-relative redirect retains the HTTP port and query' => [
                'http://example.com:8080/one',
                '/two?download=1',
                'https://proxy.example/cors-proxy.php?',
                'https://proxy.example/cors-proxy.php?http://example.com:8080/two?download=1',
            ],
            'Path-relative redirect retains the HTTPS port' => [
                'https://example.com:8443/directory/one',
                'two',
                'https://proxy.example/cors-proxy.php?',
                'https://proxy.example/cors-proxy.php?https://example.com:8443/directory/two',
            ],
            'Absolute redirect uses its own authority' => [
                'https://example.com:8443/one',
                'https://other.example/two',
                'https://proxy.example/cors-proxy.php?',
                'https://proxy.example/cors-proxy.php?https://other.example/two',
            ],
            'Scheme-relative redirect uses its own port' => [
                'http://example.com:8080/one',
                '//other.example:9090/two',
                'https://proxy.example/cors-proxy.php?',
                'https://proxy.example/cors-proxy.php?http://other.example:9090/two',
            ],
        ];
    }
    
    /**
     * 
     * @dataProvider providerGetTargetUrl
     */
    public function testGetTargetUrl($server_data, $expected_target_url)
    {
        $this->assertEquals($expected_target_url, get_target_url($server_data));
    }

    static public function providerGetTargetUrl() {
        return [
            'Request with server-provided PATH_INFO' => [
                [
                    'PATH_INFO' => '/http://example.com',
                ],
                'http://example.com'
            ],
            'Request with server-provided single-slash PATH_INFO' => [
                [
                    'PATH_INFO' => '/',
                ],
                false,
            ],
            'Request with server-provided empty PATH_INFO' => [
                [
                    'PATH_INFO' => '',
                ],
                false,
            ],
            'Request with server-provided PATH_INFO and QUERY_STRING' => [
                [
                    'PATH_INFO' => '/http://example.com/from-path-info',
                    'QUERY_STRING' => 'http://example.com/from-query-string',
                ],
                'http://example.com/from-path-info'
            ],
            'Request with server-provided slash PATH_INFO and QUERY_STRING' => [
                [
                    'PATH_INFO' => '/',
                    'QUERY_STRING' => 'http://example.com/from-query-string',
                ],
                'http://example.com/from-query-string'
            ],
            'Request with just query params' => [
                [
                    'QUERY_STRING' => 'http://example.com/from-query-string',
                ],
                'http://example.com/from-query-string'
            ],
            'Request with neither PATH_INFO nor QUERY_STRING' => [
                [],
                false
            ],
        ];
    }

    /**
     * @dataProvider providerServerControlResponseHeaders
     */
    public function testIsServerControlResponseHeader($name, $expected)
    {
        $this->assertSame($expected, is_server_control_response_header($name));
    }

    static public function providerServerControlResponseHeaders() {
        return [
            'X-Accel- prefix' => ['X-Accel-Redirect', true],
            'X-LiteSpeed- prefix' => ['X-LiteSpeed-Location', true],
            'Prefix matching ignores case' => ['x-accel-expires', true],
            'Exact name' => ['X-Sendfile2', true],
            'CDN-targeted cache control, RFC 9213 naming' => [
                'Cloudflare-CDN-Cache-Control',
                true,
            ],
            'CGI status instruction' => ['Status', true],
            'Similar name without the prefix hyphen' => ['X-Accelerated-By', false],
            'Similar name with a suffix after an exact name' => ['X-Sendfile-Foo', false],
            'Similar name that only contains the CDN suffix' => [
                'CDN-Cache-Control-Extension',
                false,
            ],
            'Ordinary header' => ['Content-Type', false],
        ];
    }

    public function testGetCurrentScriptUri()
    {
        $this->assertEquals('http://localhost/cors-proxy/', get_current_script_uri('http://example.com', 'http://localhost/cors-proxy/http://example.com'));
    }

    public function testUrlValidateAndResolve()
    {
        $this->expectException(CorsProxyException::class);
        url_validate_and_resolve('ftp://example.com');
    }

    public function testUrlValidateAndResolveWithTargetSelf()
    {
        $this->expectException(CorsProxyException::class);
        $_SERVER['HTTP_HOST'] = 'cors.playground.wordpress.net';
        url_validate_and_resolve(
            'http://cors.playground.wordpress.net/cors-proxy.php?http://cors.playground.wordpress.net'
        );
    }

    /**
     * @dataProvider providerTargetPorts
     */
    public function testResolvesTheEffectiveTargetPort($url, $port)
    {
        $lookups = 0;
        $resolved = url_validate_and_resolve($url, function ($host) use (&$lookups) {
            $this->assertSame('example.com', $host);
            $lookups++;
            return ['8.8.8.8'];
        });
        $this->assertSame($port, $resolved['port']);
        $this->assertSame('8.8.8.8', $resolved['ip']);
        $this->assertSame(1, $lookups);
    }

    static public function providerTargetPorts()
    {
        return [
            ['http://example.com/', 80],
            ['https://example.com/', 443],
            ['http://example.com:8080/', 8080],
            ['https://example.com:8443/', 8443],
            ['http://example.com:443/', 443],
            ['https://example.com:80/', 80],
        ];
    }

    public function testRejectsPortZeroBeforeResolving()
    {
        $this->expectException(CorsProxyException::class);
        $this->expectExceptionMessage('Invalid port');
        url_validate_and_resolve('http://example.com:0/', function () {
            $this->fail('Invalid ports must not reach DNS resolution');
        });
    }

    /**
     * @dataProvider providerUnsafeResolutionResults
     */
    public function testRejectsUnsafeResolutionResults($ips)
    {
        $this->expectException(CorsProxyException::class);
        url_validate_and_resolve('http://example.com:8080/', fn() => $ips);
    }

    static public function providerUnsafeResolutionResults()
    {
        return [
            'lookup failure' => [false],
            'empty answer' => [[]],
            'public and loopback' => [['8.8.8.8', '127.0.0.1']],
            'public and private' => [['8.8.8.8', '10.0.0.1']],
            'public and metadata' => [['8.8.8.8', '169.254.169.254']],
            'invalid address' => [['not-an-ip']],
            'unsupported address family' => [['2001:4860:4860::8888']],
        ];
    }

    /**
     * @dataProvider providerBlockedIpv4Destinations
     */
    public function testRejectsPrivateAndReservedDestinations($ips)
    {
        $this->expectException(CorsProxyException::class);
        $this->expectExceptionMessage('Private IPs are forbidden');
        url_validate_and_resolve('http://example.com:8080/', fn() => $ips);
    }

    static public function providerBlockedIpv4Destinations()
    {
        $blocked_ranges = [
            'private 10/8' => ['10.0.0.0', '10.255.255.255'],
            'private 172.16/12' => ['172.16.0.0', '172.31.255.255'],
            'private 192.168/16' => ['192.168.0.0', '192.168.255.255'],
            'loopback 127/8' => ['127.0.0.0', '127.0.0.1', '127.255.255.255'],
            'shared address space' => ['100.64.0.0', '100.127.255.255'],
            'current network' => ['0.0.0.0', '0.255.255.255'],
            'protocol assignments' => ['192.0.0.0', '192.0.0.255'],
            'link-local and metadata' => ['169.254.0.0', '169.254.169.254', '169.254.255.255'],
            'benchmarking' => ['198.18.0.0', '198.19.255.255'],
            'documentation TEST-NET-1' => ['192.0.2.0', '192.0.2.255'],
            'documentation TEST-NET-2' => ['198.51.100.0', '198.51.100.255'],
            'documentation TEST-NET-3' => ['203.0.113.0', '203.0.113.255'],
            'deprecated relay' => ['192.88.99.0', '192.88.99.255'],
            'multicast' => ['224.0.0.0', '239.255.255.255'],
            'reserved and broadcast' => ['240.0.0.0', '255.255.255.255'],
        ];
        $cases = [];
        foreach ($blocked_ranges as $name => $ips) {
            foreach ($ips as $ip) {
                $cases["$name: $ip alone"] = [[$ip]];
                $cases["$name: public answer followed by $ip"] = [['8.8.8.8', $ip]];
            }
        }
        return $cases;
    }

    public function testFilterHeadersStrings()
    {
        $original_headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'Cookie' => 'test=1',
            'Host' => 'example.com',
        ];

        $strictly_disallowed_headers = [
            'Cookie',
            'Host',
        ];

        $headers_requiring_opt_in = [
            'Authorization',
        ];

        $this->assertEquals(
            [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
            filter_headers_by_name(
                $original_headers,
                $strictly_disallowed_headers,
                $headers_requiring_opt_in,
            )
        );
    }

    /**
     * @dataProvider providerShouldRespondWithCorsHeaders
     */
    public function testShouldRespondWithCorsHeaders($host, $origin, $expected)
    {
        $this->assertEquals(
            $expected,
            should_respond_with_cors_headers($host, $origin)
        );
    }

    static public function providerShouldRespondWithCorsHeaders() {
        return [
            'known origin http://localhost:5400' => [
                'cors.playground.wordpress.net',
                'http://localhost:5400',
                true,
            ],
            'known origin https://playground.wordpress.net' => [
                'cors.playground.wordpress.net',
                'https://playground.wordpress.net',
                true,
            ],
            'unknown origin is rejected' => [
                'cors.playground.wordpress.net',
                'https://evil.example.com',
                false,
            ],
            'empty origin is rejected' => [
                'cors.playground.wordpress.net',
                '',
                false,
            ],
        ];
    }

    /**
     * @dataProvider providerCorsProxyOriginMatchesRule
     */
    public function testCorsProxyOriginMatchesRule(
        $supported_origin_rule,
        $origin,
        $expected
    )
    {
        $this->assertSame(
            $expected,
            is_cors_proxy_origin_supported(
                $origin,
                [$supported_origin_rule]
            )
        );
    }

    static public function providerCorsProxyOriginMatchesRule() {
        return [
            'exact origin' => [
                [
                    'type' => 'match-exact',
                    'origin' => 'https://pg.ashfame.com',
                ],
                'https://pg.ashfame.com',
                true,
            ],
            'single-label subdomain' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'https://pr123.pg.ashfame.com',
                true,
            ],
            'subdomain host matching is case-insensitive' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'https://PR123.PG.ASHFAME.COM',
                true,
            ],
            'invalid request origin is rejected' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'https://*.pg.ashfame.com',
                false,
            ],
            'subdomain rule does not match the apex origin' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'https://pg.ashfame.com',
                false,
            ],
            'subdomain rule does not cross a dot boundary' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'https://nested.pr123.pg.ashfame.com',
                false,
            ],
            'subdomain rule does not accept a deceptive suffix' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'https://pr123.pg.ashfame.com.evil.test',
                false,
            ],
            'subdomain rule preserves an exact port' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => 443,
                ],
                'https://pr123.pg.ashfame.com:444',
                false,
            ],
            'subdomain rule matches its configured port' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => 8443,
                ],
                'https://pr123.pg.ashfame.com:8443',
                true,
            ],
            'subdomain rule distinguishes an omitted port' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'https://pr123.pg.ashfame.com:443',
                false,
            ],
            'subdomain rule preserves the scheme' => [
                [
                    'type' => 'match-subdomain',
                    'scheme' => 'https',
                    'host' => 'pg.ashfame.com',
                    'port' => null,
                ],
                'http://pr123.pg.ashfame.com',
                false,
            ],
        ];
    }

    public function testInvalidCorsProxyOriginRulesAreSkipped()
    {
        $supported_origin_rules = [
            'https://pg.ashfame.com',
            [],
            [
                'type' => 'unknown',
            ],
            [
                'type' => 'match-exact',
                'origin' => [],
            ],
            [
                'type' => 'match-subdomain',
                'scheme' => 'https',
                'host' => 'pg.ashfame.com',
            ],
            [
                'type' => 'match-exact',
                'origin' => 'https://pg.ashfame.com',
            ],
        ];

        $this->assertTrue(
            is_cors_proxy_origin_supported(
                'https://pg.ashfame.com',
                $supported_origin_rules
            )
        );
    }

    public function testFilterHeaderStringsWithAdditionalAllowedHeaders()
    {
        $original_headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'Cookie' => 'test=1',
            'Host' => 'example.com',
            'Authorization' => 'Bearer 1234567890',
            'X-Authorization' => 'Bearer 1234567890',
            'X-Cors-Proxy-Allowed-Request-Headers' => 'Authorization',
        ];

        $strictly_disallowed_headers = [
            'Cookie',
            'Host',
        ];

        $headers_requiring_opt_in = [
            'Authorization',
        ];

        $this->assertEquals(
            [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer 1234567890',
                'X-Authorization' => 'Bearer 1234567890',
                'X-Cors-Proxy-Allowed-Request-Headers' => 'Authorization',
            ],
            filter_headers_by_name(
                $original_headers,
                $strictly_disallowed_headers,
                $headers_requiring_opt_in,
            )
        );
    }
}
