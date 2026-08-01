<?php

require __DIR__ . '/cors-proxy-config.php';
require __DIR__ . '/custom-redirects-lib.php';
require __DIR__ . '/my-wordpress-net/mywp-event.php';
require __DIR__ . '/my-wordpress-net/mywp-event-dashboard.php';

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

$mywp_event_dashboard_headers = playground_get_custom_response_headers(
    '/mywp-event-dashboard.php'
);
assert_equal(
    true,
    in_array( 'Cache-Control: no-store', $mywp_event_dashboard_headers, true ),
    'My WordPress event dashboard should not be edge cached'
);

$mywp_relay_headers = playground_get_custom_response_headers( '/relay.php' );
assert_equal(
    true,
    in_array( 'Cache-Control: no-store', $mywp_relay_headers, true ),
    'My WordPress relay endpoint should not be edge cached'
);

$mywp_event_server_snapshot = $_SERVER;

$_SERVER['HTTP_HOST'] = 'my.wordpress.net';
assert_equal(
    '/relay.php',
    playground_maybe_rewrite( '/relay/session' ),
    'My WordPress relay session endpoint should be routed to relay.php'
);
assert_equal(
    '/relay.php',
    playground_maybe_rewrite( '/relay/session/abc/signal' ),
    'My WordPress relay subpaths should be routed to relay.php'
);

$_SERVER['HTTP_HOST'] = 'playground.wordpress.net';
assert_equal(
    false,
    playground_maybe_rewrite( '/relay/session' ),
    'Playground host should not route relay paths to my.wordpress.net relay.php'
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

$_SERVER['MYWP_EVENT_ALLOWED_HOSTS'] = 'staging.example.test,my.wordpress.net';
$_SERVER['HTTP_HOST'] = 'staging.example.test';
assert_equal(
    true,
    mywp_event_is_allowed_host(),
    'My WordPress event endpoint should accept configured staging hosts'
);
assert_equal(
    true,
    mywp_event_dashboard_is_allowed_host(),
    'My WordPress event dashboard should accept configured staging hosts'
);
unset( $_SERVER['MYWP_EVENT_ALLOWED_HOSTS'] );

$_SERVER['HTTP_HOST'] = 'my.wordpress.net';
unset( $_SERVER['HTTP_ORIGIN'], $_SERVER['HTTP_REFERER'] );
assert_equal(
    false,
    mywp_event_is_allowed_request_origin(),
    'My WordPress event endpoint should reject headerless direct requests'
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

$_SERVER['MYWP_DB_HOST'] = 'mysql.example.test';
assert_equal(
    'mysql.example.test',
    mywp_event_get_db_config_value( 'HOST' ),
    'Event endpoint should read nginx FastCGI params from $_SERVER'
);
assert_equal(
    'mysql.example.test',
    mywp_event_dashboard_get_db_config_value( 'HOST' ),
    'Event dashboard should read nginx FastCGI params from $_SERVER'
);
unset( $_SERVER['MYWP_DB_HOST'] );

$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.10';
$remote_key_with_spoofed_forwarded_for = mywp_event_get_remote_key();
unset( $_SERVER['HTTP_X_FORWARDED_FOR'] );
assert_equal(
    $remote_key_with_spoofed_forwarded_for,
    mywp_event_get_remote_key(),
    'Event rate-limit key should ignore spoofable X-Forwarded-For values'
);

$_SERVER['HTTP_HOST'] = 'my.wordpress.net:8443';
assert_equal(
    'https://my.wordpress.net/mywp-event-dashboard.php',
    mywp_event_dashboard_get_callback_url(),
    'Dashboard OAuth callback should use the normalized host without a port'
);

$_SERVER = $mywp_event_server_snapshot;

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

assert_equal(
    'akirk,other-user',
    implode(
        ',',
        mywp_event_dashboard_parse_allowed_users(
            ' akirk, Other-User invalid_user @bad '
        )
    ),
    'Dashboard auth should parse safe GitHub logins only'
);

assert_equal(
    true,
    mywp_event_dashboard_is_allowed_github_user(
        'AKIRK',
        array( 'akirk', 'other-user' )
    ),
    'Dashboard auth should compare GitHub logins case-insensitively'
);

$dashboard_payload = mywp_event_dashboard_create_session_payload(
    'AKIRK',
    2000
);
$dashboard_signature = mywp_event_dashboard_sign(
    $dashboard_payload,
    'cookie-secret'
);
assert_equal(
    'akirk',
    mywp_event_dashboard_validate_session_cookie(
        array(
            MYWP_EVENT_DASHBOARD_SESSION_COOKIE => $dashboard_payload,
            MYWP_EVENT_DASHBOARD_SESSION_SIG_COOKIE => $dashboard_signature,
        ),
        'cookie-secret',
        array( 'akirk' ),
        1000
    ),
    'Dashboard auth should accept a valid signed session cookie'
);

assert_equal(
    false,
    mywp_event_dashboard_validate_session_cookie(
        array(
            MYWP_EVENT_DASHBOARD_SESSION_COOKIE => $dashboard_payload,
            MYWP_EVENT_DASHBOARD_SESSION_SIG_COOKIE => 'bad-signature',
        ),
        'cookie-secret',
        array( 'akirk' ),
        1000
    ),
    'Dashboard auth should reject a bad session signature'
);

assert_equal(
    false,
    mywp_event_dashboard_validate_session_cookie(
        array(
            MYWP_EVENT_DASHBOARD_SESSION_COOKIE => $dashboard_payload,
            MYWP_EVENT_DASHBOARD_SESSION_SIG_COOKIE => $dashboard_signature,
        ),
        'cookie-secret',
        array( 'other-user' ),
        1000
    ),
    'Dashboard auth should enforce the current user allowlist'
);

$dashboard_metric_sections = mywp_event_dashboard_metric_sections();
assert_equal(
    'returning_visit:extra_library_count_bucket,returning_visit:storage',
    implode(
        ',',
        mywp_event_dashboard_other_metric_names(
            array(
                'event',
                'blueprint_installed:plugin_slug',
                'returning_visit:extra_library_count_bucket',
                'returning_visit:storage',
            ),
            $dashboard_metric_sections
        )
    ),
    'Dashboard should keep legacy and removed metrics out of the main sections'
);

assert_equal(
    4,
    mywp_event_dashboard_event_count(
        array(
            'event' => array(
                array(
                    'name' => 'event',
                    'value' => 'returning_visit',
                    'views' => 4,
                ),
            ),
        ),
        'returning_visit'
    ),
    'Dashboard should read event totals from the aggregate event rows'
);

$mywp_event_get_snapshot = $_GET;

$_GET = array(
    'area' => 'plugin',
    'plugin_slug' => 'friends',
);
$current_dashboard_area = mywp_event_dashboard_get_current_area( array() );
assert_equal(
    'plugin',
    $current_dashboard_area['type'],
    'Dashboard should select the plugin area'
);
assert_equal(
    'friends',
    $current_dashboard_area['plugin_slug'],
    'Dashboard should keep the selected plugin slug'
);

$dashboard_plugin_slug_rows = mywp_event_dashboard_plugin_slug_rows(
    array(
        'blueprint_installed:plugin_slug' => array(
            array(
                'name' => 'blueprint_installed:plugin_slug',
                'value' => 'friends',
                'views' => 7,
            ),
            array(
                'name' => 'blueprint_installed:plugin_slug',
                'value' => 'Unsafe Slug',
                'views' => 3,
            ),
        ),
    )
);
assert_equal(
    1,
    count( $dashboard_plugin_slug_rows ),
    'Dashboard plugin area controls should skip unsafe slugs'
);
assert_equal(
    'friends',
    $dashboard_plugin_slug_rows[0]['value'],
    'Dashboard plugin area controls should keep safe slugs'
);

$_GET = array(
    'area' => 'plugin',
    'plugin_slug' => 'Unsafe Slug',
);
assert_equal(
    'overview',
    mywp_event_dashboard_get_current_area( array() )['type'],
    'Dashboard should reject unsafe plugin slugs'
);

$_GET = $mywp_event_get_snapshot;

assert_equal(
    '/mywp-event-dashboard.php?range=90&granularity=hour&area=plugin&plugin_slug=friends',
    mywp_event_dashboard_filter_url(
        90,
        'hour',
        array(
            'type' => 'plugin',
            'plugin_slug' => 'friends',
        )
    ),
    'Dashboard filter URLs should preserve the selected plugin area'
);

assert_equal(
    '/mywp-event-dashboard.php?range=30&granularity=day&area=remote-access',
    mywp_event_dashboard_filter_url(
        30,
        'day',
        mywp_event_dashboard_area( 'remote-access' )
    ),
    'Dashboard filter URLs should support the Remote Access area'
);

assert_equal(
    '/mywp-event-dashboard.php?range=30&granularity=day&area=health-check',
    mywp_event_dashboard_filter_url(
        30,
        'day',
        mywp_event_dashboard_area( 'health-check' )
    ),
    'Dashboard filter URLs should support the Health Check area'
);

assert_equal(
    7,
    mywp_event_dashboard_metric_value_count(
        array(
            'blueprint_installed:plugin_slug' => array(
                array(
                    'name' => 'blueprint_installed:plugin_slug',
                    'value' => 'friends',
                    'views' => 7,
                ),
            ),
        ),
        'blueprint_installed:plugin_slug',
        'friends'
    ),
    'Dashboard should count a selected metric value'
);

$dashboard_filtered_timeline = mywp_event_dashboard_filter_timeline_values(
    array(
        array(
            'period' => '2026-06-01',
            'value' => 'friends',
            'views' => 7,
        ),
        array(
            'period' => '2026-06-01',
            'value' => 'new-reader',
            'views' => 3,
        ),
    ),
    array( 'friends' )
);
assert_equal(
    1,
    count( $dashboard_filtered_timeline ),
    'Dashboard should filter timelines to the selected area'
);
assert_equal(
    'friends',
    $dashboard_filtered_timeline[0]['value'],
    'Dashboard should keep the selected timeline value'
);

$event_bumps = mywp_event_collect_stat_bumps( array(
    'schema' => 'personal-wp-event/v1',
    'app' => 'personal-wp',
    'event' => 'blueprint_installed',
    'properties' => array(
        'storage' => 'opfs',
        'php_version' => '8.4',
        'wp_version' => 'latest',
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
            'new-reader',
            'Attacker Controlled ID',
            'friends',
        ),
    ),
) );

assert_equal(
    false,
    in_array(
        array(
            'name' => 'blueprint_installed:storage',
            'value' => 'opfs',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Storage backend should not be counted'
);

assert_equal(
    false,
    in_array(
        array(
            'name' => 'blueprint_installed:php_version',
            'value' => '8.4',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Runtime version should not be counted'
);

assert_equal(
    false,
    in_array(
        array(
            'name' => 'blueprint_installed:step',
            'value' => 'installPlugin',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Blueprint steps should not be counted'
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
    true,
    in_array(
        array(
            'name' => 'blueprint_installed:plugin_slug',
            'value' => 'new-reader',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Safe plugin slug was not counted'
);

assert_equal(
    false,
    in_array(
        array(
            'name' => 'blueprint_installed:plugin_slug',
            'value' => 'Attacker Controlled ID',
            'views' => 1,
        ),
        $event_bumps,
        true
    ),
    'Unsafe plugin slug should not be counted'
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

$remote_access_bumps = mywp_event_collect_stat_bumps( array(
    'schema' => 'personal-wp-event/v1',
    'app' => 'personal-wp',
    'event' => 'remote_access_started',
    'properties' => array(
        'site_age_bucket' => '1-7-days',
        'previous_visit_age_bucket' => 'same-day',
    ),
) );

assert_equal(
    array(
        array(
            'name' => 'event',
            'value' => 'remote_access_started',
            'views' => 1,
        ),
    ),
    $remote_access_bumps,
    'Remote Access starts should be counted as aggregate events only'
);

foreach (
	array(
		'health_check_installed',
		'sidebar_opened',
		'backup_restored',
	) as $aggregate_event
) {
	assert_equal(
		array(
			array(
				'name' => 'event',
				'value' => $aggregate_event,
				'views' => 1,
			),
		),
		mywp_event_collect_stat_bumps( array(
			'schema' => 'personal-wp-event/v1',
			'app' => 'personal-wp',
			'event' => $aggregate_event,
			'properties' => array(
				'site_age_bucket' => '1-7-days',
				'previous_visit_age_bucket' => 'same-day',
			),
		) ),
		'Dimensionless events should be counted as aggregate events only'
	);
}

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
