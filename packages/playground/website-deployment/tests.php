<?php

require __DIR__ . '/cors-proxy-config.php';
require __DIR__ . '/custom-redirects-lib.php';
require __DIR__ . '/mywp-event.php';

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

$mywp_event_headers = playground_get_custom_response_headers( '/mywp-event.php' );
assert_equal(
    true,
    in_array( 'Cache-Control: no-store', $mywp_event_headers, true ),
    'My WordPress event endpoint should not be edge cached'
);

$_SERVER['HTTP_HOST'] = 'my.wordpress.net';
assert_equal(
    true,
    mywp_event_is_allowed_host(),
    'My WordPress event endpoint should accept the My WordPress host'
);

$_SERVER['HTTP_HOST'] = 'playground.wordpress.net';
assert_equal(
    false,
    mywp_event_is_allowed_host(),
    'My WordPress event endpoint should reject other hosts'
);

$_SERVER['HTTP_ORIGIN'] = 'https://my.wordpress.net';
assert_equal(
    true,
    mywp_event_is_allowed_request_origin(),
    'My WordPress event endpoint should accept the My WordPress origin'
);

$_SERVER['HTTP_ORIGIN'] = 'https://staging.my.wordpress.net';
assert_equal(
    false,
    mywp_event_is_allowed_request_origin(),
    'My WordPress event endpoint should reject staging origins'
);

unset( $_SERVER['HTTP_ORIGIN'] );
$_SERVER['HTTP_REFERER'] = 'https://my.wordpress.net/my-apps/?private=1';
assert_equal(
    true,
    mywp_event_is_allowed_request_origin(),
    'My WordPress event endpoint should accept the My WordPress referer'
);

$_SERVER['HTTP_REFERER'] = 'https://playground.wordpress.net/';
assert_equal(
    false,
    mywp_event_is_allowed_request_origin(),
    'My WordPress event endpoint should reject non-My WordPress referers'
);

unset( $_SERVER['HTTP_REFERER'] );

assert_equal(
    'v4:127.0.0.1',
    mywp_event_normalize_remote_ip( '127.0.0.1' ),
    'IPv4 event rate-limit key should be normalized'
);

assert_equal(
    'v6-64:2607:b4c0:aaaa:bbbb::',
    mywp_event_normalize_remote_ip(
        '2607:B4C0:AAAA:BBBB:CCCC:DDDD:EEEE:FFFF'
    ),
    'IPv6 event rate-limit key should use the /64 subnet'
);

$event_bumps = mywp_event_collect_stat_bumps( array(
    'schema' => 'personal-wp-event/v1',
    'app' => 'personal-wp',
    'event' => 'blueprint_installed',
    'properties' => array(
        'storage' => 'opfs',
        'php_version' => '8.4',
        'wp_version' => 'latest',
        'blueprint_id' => 'rss-reader',
        'trigger' => 'app-request',
        'request_source' => 'my-apps',
        'step_count' => 2,
        'step_counts' => array(
            'installPlugin' => 1,
            'privateStepName' => 1,
        ),
        'plugin_slugs' => array(
            'friends',
            'unknown',
            'attacker-controlled-id',
            'friends',
        ),
    ),
) );

assert_equal(
    true,
    in_array(
        array(
            'name' => 'blueprint_installed:blueprint_id',
            'value' => 'rss-reader',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Allowed app blueprint ID was not counted'
);

assert_equal(
    false,
    in_array(
        array(
            'name' => 'blueprint_installed:step',
            'value' => 'privateStepName',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Unrecognized blueprint step should not be counted'
);

assert_equal(
    true,
    in_array(
        array(
            'name' => 'blueprint_installed:plugin_slug',
            'value' => 'friends',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Allowed plugin slug was not counted'
);

assert_equal(
    false,
    in_array(
        array(
            'name' => 'blueprint_installed:plugin_slug',
            'value' => 'attacker-controlled-id',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Unrecognized plugin slug should not be counted'
);

assert_equal(
    true,
    in_array(
        array(
            'name' => 'blueprint_installed:plugin_slug',
            'value' => 'unknown',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Unknown plugin slug bucket was not counted'
);

assert_equal(
    true,
    in_array(
        array(
            'name' => 'blueprint_installed:request_source',
            'value' => 'my-apps',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Allowed request source was not counted'
);

assert_equal(
    false,
	in_array(
		array(
			'name' => 'blueprint_installed:blueprint_id',
			'value' => 'attacker-controlled-id',
			'views' => 1,
		),
		mywp_event_collect_stat_bumps( array(
			'schema' => 'personal-wp-event/v1',
			'app' => 'personal-wp',
			'event' => 'blueprint_installed',
			'properties' => array(
				'blueprint_id' => 'attacker-controlled-id',
			),
		) ),
		true
	),
    'Unrecognized blueprint ID should not be counted'
);

assert_equal(
    false,
	in_array(
		array(
			'name' => 'blueprint_installed:request_source',
			'value' => 'attacker-controlled-id',
			'views' => 1,
		),
		mywp_event_collect_stat_bumps( array(
			'schema' => 'personal-wp-event/v1',
			'app' => 'personal-wp',
			'event' => 'blueprint_installed',
			'properties' => array(
				'request_source' => 'attacker-controlled-id',
			),
		) ),
		true
	),
    'Unrecognized request source should not be counted'
);

echo 'All tests passed';
