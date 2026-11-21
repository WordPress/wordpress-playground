<?php

use PHPUnit\Framework\TestCase;

/**
 * Protects the proxy trust boundary from case changes and callback reordering.
 * Transport tests separately exercise cURL framing and PHP header emission.
 */
class HeaderFilteringTests extends TestCase {
    /** @dataProvider blockedRequestHeaders */
    public function testRequestHeadersCannotBeOptedBackIn($name) {
        $this->assertSame(['X-End-To-End' => 'kept'], filter_request_headers([
            $name => 'private',
            'X-Cors-Proxy-Allowed-Request-Headers' => $name,
            'X-End-To-End' => 'kept',
        ]));
    }

    public static function blockedRequestHeaders() {
        return self::caseVariants([
            'Cookie', 'Cookie2', 'Host', 'Content-Length',
            'X-Cors-Proxy-Allowed-Request-Headers', 'X-Cors-Proxy-Content-Type',
            'X-Cors-Proxy-Range', 'X-Kandelo-Proxy-Session',
            'X-Forwarded-For', 'X-IP-Proxy-Type',
            'Connection', 'Keep-Alive', 'Proxy-Authenticate', 'Proxy-Authorization',
            'TE', 'Trailer', 'Transfer-Encoding', 'Upgrade',
        ]);
    }

    public function testAuthorizationOptInIsConsumedBeforeFiltering() {
        $this->assertSame([], filter_request_headers(['aUtHoRiZaTiOn' => 'Bearer secret']));
        $this->assertSame(['aUtHoRiZaTiOn' => 'Bearer secret'], filter_request_headers([
            'aUtHoRiZaTiOn' => 'Bearer secret',
            'x-CoRs-PrOxY-AlLoWeD-ReQuEsT-HeAdErS' => ' Accept, AUTHORIZATION ',
        ]));
    }

    public function testRequestConnectionNominationsOverrideOptInInEitherOrder() {
        $headers = [
            'X-Early' => 'private',
            'cOnNeCtIoN' => ' X-EARLY, authorization, x-late ',
            'X-Late' => 'private',
            'Authorization' => 'Bearer secret',
            'X-Cors-Proxy-Allowed-Request-Headers' => 'Authorization, X-Early, X-Late',
            'X-End-To-End' => 'kept',
        ];
        $this->assertSame(['X-End-To-End' => 'kept'], filter_request_headers($headers));
        $this->assertSame(['X-End-To-End' => 'kept'], filter_request_headers(array_reverse($headers)));
    }

    /** @dataProvider blockedResponseHeaders */
    public function testResponseHeaderFiltering($name) {
        $this->assertSame(['X-End-To-End: kept'], filter_response_headers([
            "$name: untrusted", 'X-End-To-End: kept',
        ]));
    }

    public static function blockedResponseHeaders() {
        return self::caseVariants([
            'Set-Cookie', 'Set-Cookie2', 'Authorization', 'WWW-Authenticate', 'Cache-Control',
            'Strict-Transport-Security', 'Upgrade-Insecure-Requests', 'Clear-Site-Data',
            'Content-Security-Policy', 'Content-Security-Policy-Report-Only',
            'Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy', 'Cross-Origin-Resource-Policy',
            'Vary', 'X-Playground-Cors-Proxy', 'X-Kandelo-Proxy-Session',
            'X-Spacefast-Test', 'X-Stattic-Test',
            'Access-Control-Allow-Origin', 'Access-Control-Expose-Headers', 'Access-Control-Future',
            'Connection', 'Keep-Alive', 'Proxy-Authenticate', 'Proxy-Authorization',
            'TE', 'Trailer', 'Transfer-Encoding', 'Upgrade',
            'X-Accel-Redirect', 'X-LiteSpeed-Location', 'X-Sendfile', 'X-Sendfile-Temporary',
            'X-Sendfile2', 'X-Lighttpd-Send-File', 'Surrogate-Control', 'Edge-Control',
            'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control', 'Status',
        ]);
    }

    public function testRepeatedConnectionFieldsNominateBothEarlierAndLaterHeaders() {
        $headers = [
            'X-Early: private',
            'cOnNeCtIoN: X-EARLY, x-late',
            'X-Late: private',
            'Connection: x-other',
            'X-Other: private',
            'X-End-To-End: first',
            'X-End-To-End: second',
        ];
        $this->assertSame([
            'X-End-To-End: first', 'X-End-To-End: second',
        ], filter_response_headers($headers));
    }

    public function testDeploymentHeadersAreOwnedByTheProxy() {
        $this->assertSame(['ETag: "kept"'], filter_response_headers([
            'x-deployment-header: forged', 'Connection: X-Deployment-Header', 'ETag: "kept"',
        ], ['X-Deployment-Header: trusted']));
    }

    public function testSimilarNamesAndBodyMetadataRemainEndToEnd() {
        $headers = [
            'Content-Length: 42', 'Content-Encoding: gzip', 'Content-Range: bytes 0-41/100',
            'X-Spacefast: kept', 'X-Stattic: kept', 'Access-Control: kept', 'X-Connection: kept',
        ];
        $this->assertSame($headers, filter_response_headers($headers));
    }

    private static function caseVariants($names) {
        $cases = [];
        foreach ($names as $name) {
            $cases[$name] = [$name];
            $mixed = '';
            foreach (str_split($name) as $i => $letter) {
                $mixed .= $i % 2 ? strtoupper($letter) : strtolower($letter);
            }
            $cases["$name mixed case"] = [$mixed];
        }
        return $cases;
    }
}
