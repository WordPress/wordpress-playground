<?php

use PHPUnit\Framework\TestCase;

class GenerateSupportedOriginsTests extends TestCase
{
    /**
     * @dataProvider providerValidOrigins
     */
    public function testGeneratesExpectedConfiguration($origins, $expected_output)
    {
        $result = $this->runGenerator($origins);

        $this->assertSame(0, $result['exit_code']);
        $this->assertSame('', $result['stderr']);
        $this->assertSame($expected_output, $result['stdout']);
    }

    static public function providerValidOrigins()
    {
        return [
            'single exact origin' => [
                'https://playground.example.com',
                <<<'PHP'
<?php

define(
    'PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES',
    [
        [
            'type' => 'match-exact',
            'origin' => 'https://playground.example.com',
        ],
    ]
);

PHP,
            ],
            'single wildcard origin' => [
                'https://*.preview.example.com:8443',
                <<<'PHP'
<?php

define(
    'PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES',
    [
        [
            'type' => 'match-subdomain',
            'scheme' => 'https',
            'host' => 'preview.example.com',
            'port' => 8443,
        ],
    ]
);

PHP,
            ],
            'multiple origins' => [
                'https://playground.example.com https://*.preview.example.com',
                <<<'PHP'
<?php

define(
    'PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES',
    [
        [
            'type' => 'match-exact',
            'origin' => 'https://playground.example.com',
        ],
        [
            'type' => 'match-subdomain',
            'scheme' => 'https',
            'host' => 'preview.example.com',
            'port' => null,
        ],
    ]
);

PHP,
            ],
        ];
    }

    /**
     * @dataProvider providerInvalidOrigins
     */
    public function testRejectsInvalidOrigins($origins, $expected_error)
    {
        $result = $this->runGenerator($origins);

        $this->assertSame(1, $result['exit_code']);
        $this->assertSame('', $result['stdout']);
        $this->assertSame($expected_error, $result['stderr']);
    }

    static public function providerInvalidOrigins()
    {
        return [
            'empty value' => [
                '',
                "CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED must contain at least one origin.\n",
            ],
            'invalid wildcard pattern' => [
                'https://*.*.example.com',
                "Invalid supported origin in CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED: https://*.*.example.com\n",
            ],
            'partial-label wildcard' => [
                'https://preview-*.example.com',
                "Invalid supported origin in CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED: https://preview-*.example.com\n",
            ],
            'wildcard after the first hostname label' => [
                'https://preview.*.example.com',
                "Invalid supported origin in CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED: https://preview.*.example.com\n",
            ],
            'wildcard in the path' => [
                'https://example.com/*',
                "Invalid supported origin in CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED: https://example.com/*\n",
            ],
        ];
    }

    private function runGenerator($origins)
    {
        $process = proc_open(
            [
                PHP_BINARY,
                __DIR__ .
                    '/../../php-cors-proxy-deployment/generate-supported-origins.php',
            ],
            [
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ],
            $pipes,
            null,
            [
                'CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED' => $origins,
            ]
        );

        if (!is_resource($process)) {
            $this->fail('Unable to start the supported origins generator.');
        }

        $stdout = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[2]);

        return [
            'exit_code' => proc_close($process),
            'stdout' => $stdout,
            'stderr' => $stderr,
        ];
    }
}
