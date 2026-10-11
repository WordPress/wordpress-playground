<?php

use PHPUnit\Framework\TestCase;

class CurlDestinationTests extends TestCase
{
    /**
     * The connection must use the validated destination even when cURL has
     * another address cached or the environment asks it to use a proxy.
     * Local addresses stand in for the approved and forbidden destinations;
     * the production IP validator is tested separately, without overrides.
     *
     * @dataProvider providerUnvalidatedDestinations
     */
    public function testPinsTheConnection($cached_ip, $family, $approved_ip, $use_proxy)
    {
        $ipv4 = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
        $this->assertIsResource($ipv4, $error);
        $port = parse_url('tcp://' . stream_socket_get_name($ipv4, false), PHP_URL_PORT);
        $listeners = [$ipv4];
        $canary_available = true;
        if ($family === CURL_IPRESOLVE_V6) {
            $ipv6 = @stream_socket_server("tcp://[::1]:$port", $errno, $error);
            $canary_available = $ipv6 !== false;
            if ($canary_available) {
                $listeners[] = $ipv6;
            }
        }
        foreach ($listeners as $listener) {
            stream_set_blocking($listener, false);
        }

        $saved_env = [];
        foreach (['http_proxy', 'HTTP_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY'] as $name) {
            $saved_env[$name] = getenv($name);
            putenv($name);
        }
        $ch = curl_init("http://localhost:$port/");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS => 250,
            CURLOPT_PROXY => '',
            CURLOPT_IPRESOLVE => $family,
            CURLOPT_RESOLVE => ["localhost:$port:$cached_ip"],
        ]);

        try {
            // Prime cURL's DNS cache with the address that validation did
            // not approve. With IPv6 loopback, the control returns its canary;
            // without it, the control fails and the approved IPv4 must still work.
            $control = $this->transfer($ch, $listeners, $port, $approved_ip);
            if ($canary_available) {
                $this->assertSame(CURLE_OK, $control['error']);
                $this->assertSame('PRIVATE_CANARY', json_decode($control['body'], true)['canary']);
            } else {
                $this->assertNotSame(CURLE_OK, $control['error']);
                $this->assertSame('', $control['body']);
                $this->assertSame([], $control['destinations']);
            }

            curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_WHATEVER);
            if ($use_proxy) {
                putenv("http_proxy=http://127.0.0.1:$port");
                // Use a fresh handle so its default options read the proxy
                // environment rather than retaining the control's settings.
                $ch = curl_init("http://localhost:$port/");
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT_MS => 250,
                ]);
            }
            set_curl_destination($ch, [
                'host' => 'localhost',
                'port' => $port,
                'ip' => $approved_ip,
            ]);

            $response = $this->transfer($ch, $listeners, $port, $approved_ip);
            $this->assertStringNotContainsString('PRIVATE_CANARY', $response['body']);
            if ($approved_ip === '127.0.0.2') {
                // This approved stand-in has no listener. cURL must fail,
                // rather than fall back to the reachable private canary.
                $this->assertNotSame(CURLE_OK, $response['error']);
                $this->assertSame([], $response['destinations']);
            } else {
                $this->assertSame(CURLE_OK, $response['error']);
                $body = json_decode($response['body'], true);
                $this->assertSame('APPROVED_CANARY', $body['canary']);
                $this->assertSame("localhost:$port", $body['host']);
            }
        } finally {
            foreach ($listeners as $listener) {
                fclose($listener);
            }
            foreach ($saved_env as $name => $value) {
                putenv($value === false ? $name : "$name=$value");
            }
        }
    }

    static public function providerUnvalidatedDestinations()
    {
        return [
            'changed IPv4 address on a custom port' => [
                '127.0.0.1', CURL_IPRESOLVE_V4, '127.0.0.2', false,
            ],
            'unchecked private AAAA on a custom port' => [
                '[::1]', CURL_IPRESOLVE_V6, '127.0.0.1', false,
            ],
            'environment HTTP proxy' => [
                '127.0.0.1', CURL_IPRESOLVE_V4, '127.0.0.2', true,
            ],
        ];
    }

    /**
     * Drive real cURL and the canary listeners in one event loop. Seeded DNS
     * cache entries make address changes deterministic using only loopback.
     */
    private function transfer($ch, $listeners, $port, $approved_ip)
    {
        $multi = curl_multi_init();
        curl_multi_add_handle($multi, $ch);
        $connections = [];
        $requests = [];
        $destinations = [];
        try {
            do {
                curl_multi_exec($multi, $running);
                foreach ($listeners as $listener) {
                    while ($connection = @stream_socket_accept($listener, 0)) {
                        stream_set_blocking($connection, false);
                        $connections[] = $connection;
                        $requests[] = '';
                        $destinations[] = stream_socket_get_name($connection, false);
                    }
                }
                foreach ($connections as $i => $connection) {
                    $requests[$i] .= fread($connection, 8192);
                    if (!str_contains($requests[$i], "\r\n\r\n")) {
                        continue;
                    }
                    preg_match('/\r\nHost: ([^\r\n]+)/i', $requests[$i], $matches);
                    $body = json_encode([
                        'canary' => stream_socket_get_name($connection, false) === "$approved_ip:$port"
                            ? 'APPROVED_CANARY' : 'PRIVATE_CANARY',
                        'host' => $matches[1] ?? null,
                    ]);
                    fwrite($connection, "HTTP/1.1 200 OK\r\nConnection: close\r\n" .
                        'Content-Length: ' . strlen($body) . "\r\n\r\n$body");
                    fclose($connection);
                    unset($connections[$i], $requests[$i]);
                }
                if ($running) {
                    usleep(1000);
                }
            } while ($running);
            $info = curl_multi_info_read($multi);
            return [
                'body' => curl_multi_getcontent($ch),
                'error' => $info['result'],
                'destinations' => $destinations,
            ];
        } finally {
            foreach ($connections as $connection) {
                fclose($connection);
            }
            curl_multi_remove_handle($multi, $ch);
        }
    }
}
