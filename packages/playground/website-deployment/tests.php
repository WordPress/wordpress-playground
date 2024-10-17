<?php

require __DIR__ . '/cors-proxy-config.php';

function assert_equal($expected, $actual, $message='') {
	if ($expected !== $actual) {
        $message = $message ?: "Test failed.";
		echo "$message.\nExpected: $expected\nActual:   $actual\n";
        die();
	}
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

echo 'All tests passed';
