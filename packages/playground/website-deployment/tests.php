<?php

require __DIR__ . '/cors-proxy-config.php';
require __DIR__ . '/custom-redirects-lib.php';

function assert_equal($expected, $actual, $message='') {
	if ($expected !== $actual) {
        $message = $message ?: "Test failed.";
		echo "$message.\nExpected: $expected\nActual:   $actual\n";
        die();
	}
}

function assert_throws($expected_message, $callback) {
    try {
        $callback();
    } catch (Exception $e) {
        if ($e->getMessage() !== $expected_message) {
            echo "Test failed.\nExpected: $expected_message\nActual:   {$e->getMessage()}\n";
            die();
        }
        return;
    }
    echo "Test failed.\nExpected: $expected_message\nActual:   No exception was thrown\n";
    die();
}

assert_equal(
    '2607:B4C0:0000:0000:0000:0000:0000:0000',
    playground_ip_to_a_64_subnet(
        '2607:B4C0:0000:0000:0000:0000:0000:0001'
    ),
    'IPv6 was not correctly transformed into a subnet'
);

assert_equal(
    '2607:B4C0:AAAA:BBBB:0000:0000:0000:0000',
    playground_ip_to_a_64_subnet(
        '2607:B4C0:AAAA:BBBB:CCCC:DDDD:EEEE:FFFF'
    ),
    'IPv6 was not correctly transformed into a subnet'
);

assert_equal(
    '::ffff:127.0.0.1', 
    playground_ip_to_a_64_subnet('127.0.0.1', 64),
    'A part of the IPv4 range was lost'
);

assert_throws(
    'Block size must be a multiple of 8.',
    function () {
        playground_get_ipv6_block(
            '2607:B4C0:AAAA:BBBB:CCCC:DDDD:EEEE:FFFF',
            8 - 1
        );
    }
);

assert_throws(
    'Block size must be less than or equal to 128.',
    function () {
        playground_get_ipv6_block(
            '2607:B4C0:AAAA:BBBB:CCCC:DDDD:EEEE:FFFF',
            128 + 8
        );
    }
);

$preview_sw_headers = playground_get_custom_response_headers(
    '/pr-previews/123/abcdef1234567890abcdef1234567890abcdef12/sw.js'
);
assert_equal(
    1,
    playground_is_pr_preview_request('/pr-previews/123/current.json'),
    'PR preview current.json should be handled by the artifact proxy'
);
assert_equal(
    1,
    playground_is_pr_preview_request('/pr-previews/123/abcdef1/assets/index.js'),
    'PR preview assets should be handled by the artifact proxy'
);
assert_equal(
    true,
    in_array('Service-Worker-Allowed: /', $preview_sw_headers, true),
    'PR preview service worker must be allowed to control the root scope'
);
assert_equal(
    array('Cache-Control: max-age=0, no-cache, no-store, must-revalidate'),
    playground_get_custom_response_headers('/pr-previews/123/current.json'),
    'PR preview current.json must not be cached'
);


echo 'All tests passed';
