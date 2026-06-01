<?php

const MYWP_EVENT_DASHBOARD_SESSION_COOKIE = 'MYWP_EVENT_DASHBOARD_AUTH';
const MYWP_EVENT_DASHBOARD_SESSION_SIG_COOKIE = 'MYWP_EVENT_DASHBOARD_AUTH_SIG';
const MYWP_EVENT_DASHBOARD_STATE_COOKIE = 'MYWP_EVENT_DASHBOARD_STATE';
const MYWP_EVENT_DASHBOARD_SESSION_TTL = 43200;
const MYWP_EVENT_DASHBOARD_STATE_TTL = 600;
const MYWP_EVENT_DASHBOARD_PATH = '/mywp-event-dashboard.php';
const MYWP_EVENT_DASHBOARD_ALLOWED_RANGES = array( 7, 30, 90 );
const MYWP_EVENT_DASHBOARD_ALLOWED_GRANULARITIES = array( 'day', 'hour' );

if ( 'cli' !== php_sapi_name() ) {
	mywp_event_dashboard_handle_request();
}

function mywp_event_dashboard_handle_request() {
	mywp_event_dashboard_send_security_headers();

	if ( ! mywp_event_dashboard_is_allowed_host() ) {
		http_response_code( 404 );
		return;
	}

	if ( ! in_array( $_SERVER['REQUEST_METHOD'], array( 'GET', 'HEAD' ), true ) ) {
		header( 'Allow: GET, HEAD' );
		http_response_code( 405 );
		return;
	}

	if ( isset( $_GET['logout'] ) ) {
		mywp_event_dashboard_clear_session_cookies();
		header( 'Location: ' . MYWP_EVENT_DASHBOARD_PATH );
		http_response_code( 302 );
		return;
	}

	$current_user = mywp_event_dashboard_require_authorized_user();
	if ( ! $current_user ) {
		return;
	}

	$dbh = mywp_event_dashboard_connect_db();
	if ( ! $dbh ) {
		http_response_code( 503 );
		echo 'Stats dashboard is unavailable.';
		return;
	}

	$range = mywp_event_dashboard_get_range();
	$granularity = mywp_event_dashboard_get_granularity();

	try {
		$stats = mywp_event_dashboard_load_stats(
			$dbh,
			$range,
			$granularity
		);
	} finally {
		mysqli_close( $dbh );
	}

	if ( 'HEAD' === $_SERVER['REQUEST_METHOD'] ) {
		return;
	}

	mywp_event_dashboard_render( $stats, $current_user );
}

function mywp_event_dashboard_send_security_headers() {
	header( 'Cache-Control: no-store' );
	header( 'X-Robots-Tag: noindex, nofollow' );
	header( "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" );
	header( 'Content-Type: text/html; charset=utf-8' );
}

function mywp_event_dashboard_is_allowed_host() {
	return (
		isset( $_SERVER['HTTP_HOST'] ) &&
		mywp_event_dashboard_is_my_wordpress_host( $_SERVER['HTTP_HOST'] )
	);
}

function mywp_event_dashboard_is_my_wordpress_host( $host ) {
	$normalized_host = mywp_event_dashboard_normalize_host( $host );
	return (
		$normalized_host &&
		in_array(
			$normalized_host,
			mywp_event_dashboard_get_allowed_hosts(),
			true
		)
	);
}

function mywp_event_dashboard_get_allowed_hosts() {
	$raw_hosts = mywp_event_dashboard_get_config_value(
		'MYWP_EVENT_ALLOWED_HOSTS'
	) ?: 'my.wordpress.net';
	$hosts = preg_split( '/[\s,]+/', strtolower( trim( $raw_hosts ) ) );
	$allowed_hosts = array();
	foreach ( $hosts as $host ) {
		$normalized_host = mywp_event_dashboard_normalize_host( $host );
		if ( $normalized_host ) {
			$allowed_hosts[] = $normalized_host;
		}
	}
	return array_values( array_unique( $allowed_hosts ) );
}

function mywp_event_dashboard_normalize_host( $host ) {
	if ( ! is_string( $host ) ) {
		return false;
	}

	$match = array();
	if ( ! preg_match( '/^([a-z0-9.-]+)(?::\d+)?$/i', $host, $match ) ) {
		return false;
	}

	return strtolower( $match[1] );
}

function mywp_event_dashboard_require_authorized_user() {
	$config = mywp_event_dashboard_get_auth_config();
	if ( ! $config ) {
		http_response_code( 503 );
		echo 'Stats dashboard auth is not configured.';
		return false;
	}

	$current_user = mywp_event_dashboard_validate_session_cookie(
		$_COOKIE,
		$config['cookie_secret'],
		$config['allowed_users'],
		time()
	);
	if ( $current_user ) {
		return $current_user;
	}

	if ( isset( $_GET['code'], $_GET['state'] ) ) {
		mywp_event_dashboard_complete_oauth( $config );
		return false;
	}

	mywp_event_dashboard_start_oauth( $config );
	return false;
}

function mywp_event_dashboard_get_auth_config() {
	$client_id = mywp_event_dashboard_get_config_value(
		'MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_ID'
	)
		?: mywp_event_dashboard_get_config_value( 'GITHUB_APP_CLIENT_ID' )
		?: mywp_event_dashboard_get_config_value( 'GITHUB_CLIENT_ID' )
		?: mywp_event_dashboard_get_config_value( 'CLIENT_ID' );
	$client_secret = mywp_event_dashboard_get_config_value(
		'MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_SECRET'
	)
		?: mywp_event_dashboard_get_config_value( 'GITHUB_APP_CLIENT_SECRET' )
		?: mywp_event_dashboard_get_config_value( 'GITHUB_CLIENT_SECRET' )
		?: mywp_event_dashboard_get_config_value( 'CLIENT_SECRET' );
	$allowed_users = mywp_event_dashboard_parse_allowed_users(
		mywp_event_dashboard_get_config_value(
			'MYWP_EVENT_DASHBOARD_GITHUB_USERS'
		) ?: ''
	);
	$cookie_secret = mywp_event_dashboard_get_db_config_value( 'PASSWORD' );

	if (
		! is_string( $client_id ) ||
		'' === $client_id ||
		! is_string( $client_secret ) ||
		'' === $client_secret ||
		empty( $allowed_users ) ||
		! is_string( $cookie_secret ) ||
		'' === $cookie_secret
	) {
		return false;
	}

	return array(
		'client_id' => $client_id,
		'client_secret' => $client_secret,
		'allowed_users' => $allowed_users,
		'cookie_secret' => $cookie_secret,
	);
}

function mywp_event_dashboard_parse_allowed_users( $raw_users ) {
	$users = preg_split( '/[\s,]+/', strtolower( trim( $raw_users ) ) );
	$allowed_users = array();
	foreach ( $users as $user ) {
		if (
			is_string( $user ) &&
			preg_match( '/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/', $user )
		) {
			$allowed_users[] = $user;
		}
	}

	return array_values( array_unique( $allowed_users ) );
}

function mywp_event_dashboard_validate_session_cookie(
	$cookies,
	$cookie_secret,
	$allowed_users,
	$now
) {
	$payload = $cookies[ MYWP_EVENT_DASHBOARD_SESSION_COOKIE ] ?? '';
	$signature = $cookies[ MYWP_EVENT_DASHBOARD_SESSION_SIG_COOKIE ] ?? '';
	if (
		! is_string( $payload ) ||
		! is_string( $signature ) ||
		'' === $payload ||
		'' === $signature
	) {
		return false;
	}

	$expected_signature = mywp_event_dashboard_sign(
		$payload,
		$cookie_secret
	);
	if ( ! hash_equals( $expected_signature, $signature ) ) {
		return false;
	}

	$parts = explode( '|', $payload );
	if ( count( $parts ) !== 2 ) {
		return false;
	}

	$login = strtolower( $parts[0] );
	$expiry = (int) $parts[1];
	if (
		$expiry <= $now ||
		! mywp_event_dashboard_is_allowed_github_user(
			$login,
			$allowed_users
		)
	) {
		return false;
	}

	return $login;
}

function mywp_event_dashboard_is_allowed_github_user( $login, $allowed_users ) {
	return in_array( strtolower( $login ), $allowed_users, true );
}

function mywp_event_dashboard_sign( $payload, $secret ) {
	return hash_hmac( 'sha256', $payload, $secret );
}

function mywp_event_dashboard_start_oauth( $config ) {
	$state = bin2hex( random_bytes( 16 ) );
	mywp_event_dashboard_set_cookie(
		MYWP_EVENT_DASHBOARD_STATE_COOKIE,
		$state,
		time() + MYWP_EVENT_DASHBOARD_STATE_TTL
	);

	$params = array(
		'client_id' => $config['client_id'],
		'redirect_uri' => mywp_event_dashboard_get_callback_url(),
		'scope' => 'read:user',
		'state' => $state,
		'allow_signup' => 'false',
	);

	header(
		'Location: https://github.com/login/oauth/authorize?' .
		http_build_query( $params, '', '&', PHP_QUERY_RFC3986 )
	);
	http_response_code( 302 );
}

function mywp_event_dashboard_complete_oauth( $config ) {
	$state = $_GET['state'] ?? '';
	$cookie_state = $_COOKIE[ MYWP_EVENT_DASHBOARD_STATE_COOKIE ] ?? '';
	mywp_event_dashboard_clear_state_cookie();

	if (
		! is_string( $state ) ||
		! is_string( $cookie_state ) ||
		'' === $state ||
		! hash_equals( $cookie_state, $state )
	) {
		http_response_code( 401 );
		echo 'Unable to verify GitHub OAuth state.';
		return;
	}

	$access_token = mywp_event_dashboard_request_github_access_token(
		$config,
		$_GET['code']
	);
	if ( ! $access_token ) {
		http_response_code( 401 );
		echo 'Unable to complete GitHub OAuth.';
		return;
	}

	$login = mywp_event_dashboard_request_github_login( $access_token );
	if (
		! $login ||
		! mywp_event_dashboard_is_allowed_github_user(
			$login,
			$config['allowed_users']
		)
	) {
		http_response_code( 403 );
		echo 'This GitHub user is not allowed to view the stats dashboard.';
		return;
	}

	mywp_event_dashboard_set_session_cookie(
		$login,
		$config['cookie_secret']
	);
	header( 'Location: ' . MYWP_EVENT_DASHBOARD_PATH );
	http_response_code( 302 );
}

function mywp_event_dashboard_request_github_access_token( $config, $code ) {
	if ( ! is_string( $code ) || '' === $code ) {
		return false;
	}

	$curl = curl_init( 'https://github.com/login/oauth/access_token' );
	curl_setopt( $curl, CURLOPT_POST, true );
	curl_setopt(
		$curl,
		CURLOPT_POSTFIELDS,
		http_build_query(
			array(
				'client_id' => $config['client_id'],
				'client_secret' => $config['client_secret'],
				'code' => $code,
				'redirect_uri' => mywp_event_dashboard_get_callback_url(),
			)
		)
	);
	curl_setopt( $curl, CURLOPT_RETURNTRANSFER, 1 );
	curl_setopt( $curl, CURLOPT_HTTPHEADER, array( 'Accept: application/json' ) );
	curl_setopt( $curl, CURLOPT_USERAGENT, 'WordPress Playground' );
	$raw_response = curl_exec( $curl );
	$response_status = curl_getinfo( $curl, CURLINFO_HTTP_CODE );
	curl_close( $curl );

	if ( false === $raw_response || 200 !== $response_status ) {
		return false;
	}

	$response = json_decode( $raw_response, true );
	return is_array( $response ) &&
		isset( $response['access_token'] ) &&
		is_string( $response['access_token'] )
		? $response['access_token']
		: false;
}

function mywp_event_dashboard_request_github_login( $access_token ) {
	$curl = curl_init( 'https://api.github.com/user' );
	curl_setopt( $curl, CURLOPT_RETURNTRANSFER, 1 );
	curl_setopt(
		$curl,
		CURLOPT_HTTPHEADER,
		array(
			'Accept: application/vnd.github+json',
			'Authorization: Bearer ' . $access_token,
			'User-Agent: WordPress Playground',
		)
	);
	$raw_response = curl_exec( $curl );
	$response_status = curl_getinfo( $curl, CURLINFO_HTTP_CODE );
	curl_close( $curl );

	if ( false === $raw_response || 200 !== $response_status ) {
		return false;
	}

	$response = json_decode( $raw_response, true );
	return is_array( $response ) &&
		isset( $response['login'] ) &&
		is_string( $response['login'] )
		? strtolower( $response['login'] )
		: false;
}

function mywp_event_dashboard_get_callback_url() {
	$host = $_SERVER['HTTP_HOST'] ?? '';
	return 'https://' . $host . MYWP_EVENT_DASHBOARD_PATH;
}

function mywp_event_dashboard_set_session_cookie( $login, $cookie_secret ) {
	$expiry = time() + MYWP_EVENT_DASHBOARD_SESSION_TTL;
	$payload = mywp_event_dashboard_create_session_payload( $login, $expiry );
	mywp_event_dashboard_set_cookie(
		MYWP_EVENT_DASHBOARD_SESSION_COOKIE,
		$payload,
		$expiry
	);
	mywp_event_dashboard_set_cookie(
		MYWP_EVENT_DASHBOARD_SESSION_SIG_COOKIE,
		mywp_event_dashboard_sign( $payload, $cookie_secret ),
		$expiry
	);
}

function mywp_event_dashboard_create_session_payload( $login, $expiry ) {
	return strtolower( $login ) . '|' . (int) $expiry;
}

function mywp_event_dashboard_clear_session_cookies() {
	mywp_event_dashboard_clear_state_cookie();
	mywp_event_dashboard_set_cookie(
		MYWP_EVENT_DASHBOARD_SESSION_COOKIE,
		'',
		time() - 3600
	);
	mywp_event_dashboard_set_cookie(
		MYWP_EVENT_DASHBOARD_SESSION_SIG_COOKIE,
		'',
		time() - 3600
	);
}

function mywp_event_dashboard_clear_state_cookie() {
	mywp_event_dashboard_set_cookie(
		MYWP_EVENT_DASHBOARD_STATE_COOKIE,
		'',
		time() - 3600
	);
}

function mywp_event_dashboard_set_cookie( $name, $value, $expiry ) {
	setcookie(
		$name,
		$value,
		array(
			'expires' => $expiry,
			'path' => MYWP_EVENT_DASHBOARD_PATH,
			'secure' => true,
			'httponly' => true,
			'samesite' => 'Lax',
		)
	);
}

function mywp_event_dashboard_connect_db() {
	$db_host = mywp_event_dashboard_get_db_config_value( 'HOST' );
	$db_user = mywp_event_dashboard_get_db_config_value( 'USER' );
	$db_password = mywp_event_dashboard_get_db_config_value( 'PASSWORD' );
	$db_name = mywp_event_dashboard_get_db_config_value( 'NAME' );

	foreach (
		array(
			'MYWP_DB_HOST' => $db_host,
			'MYWP_DB_USER' => $db_user,
			'MYWP_DB_PASSWORD' => $db_password,
			'MYWP_DB_NAME' => $db_name,
		) as $name => $value
	) {
		if ( ! is_string( $value ) || '' === $value ) {
			error_log( "MYWP event dashboard: $name is missing" );
			return false;
		}
	}

	$dbh = mysqli_init();
	if ( ! $dbh ) {
		return false;
	}

	if (
		! mysqli_real_connect(
			$dbh,
			$db_host,
			$db_user,
			$db_password,
			$db_name
		)
	) {
		error_log( 'MYWP event dashboard: failed to connect to MySQL' );
		return false;
	}

	mysqli_set_charset( $dbh, 'utf8mb4' );
	return $dbh;
}

function mywp_event_dashboard_get_db_config_value( $name ) {
	return mywp_event_dashboard_get_config_value( "MYWP_DB_$name" )
		?: mywp_event_dashboard_get_config_value( "DB_$name" );
}

function mywp_event_dashboard_get_config_value( $name ) {
	$value = getenv( $name );
	if ( is_string( $value ) && '' !== $value ) {
		return $value;
	}

	if ( isset( $_SERVER[ $name ] ) && is_string( $_SERVER[ $name ] ) && '' !== $_SERVER[ $name ] ) {
		return $_SERVER[ $name ];
	}

	if ( defined( $name ) ) {
		$value = constant( $name );
		return is_string( $value ) && '' !== $value ? $value : null;
	}

	return null;
}

function mywp_event_dashboard_get_range() {
	$range = (int) ( $_GET['range'] ?? 30 );
	return in_array( $range, MYWP_EVENT_DASHBOARD_ALLOWED_RANGES, true )
		? $range
		: 30;
}

function mywp_event_dashboard_get_granularity() {
	$granularity = $_GET['granularity'] ?? 'day';
	return in_array(
		$granularity,
		MYWP_EVENT_DASHBOARD_ALLOWED_GRANULARITIES,
		true
	)
		? $granularity
		: 'day';
}

function mywp_event_dashboard_load_stats( $dbh, $range, $granularity ) {
	$table = 'hour' === $granularity
		? 'mywp_event_stats_hourly'
		: 'mywp_event_stats_daily';
	$time_column = 'hour' === $granularity ? 'hour' : 'date';
	$since = 'hour' === $granularity
		? gmdate( 'Y-m-d H:00:00', time() - $range * 24 * 60 * 60 )
		: gmdate( 'Y-m-d', time() - ( $range - 1 ) * 24 * 60 * 60 );

	return array(
		'range' => $range,
		'granularity' => $granularity,
		'since' => $since,
		'rows' => mywp_event_dashboard_query_rollup(
			$dbh,
			$table,
			$time_column,
			$since
		),
		'timeline' => mywp_event_dashboard_query_event_timeline(
			$dbh,
			$table,
			$time_column,
			$since,
			'day' === $granularity ? '%Y-%m-%d' : '%Y-%m-%d %H:00'
		),
	);
}

function mywp_event_dashboard_query_rollup(
	$dbh,
	$table,
	$time_column,
	$since
) {
	$query = "
		SELECT `name`, `value`, SUM(`views`) AS `views`
		FROM `$table`
		WHERE `$time_column` >= ?
		GROUP BY `name`, `value`
		ORDER BY `name` ASC, `views` DESC, `value` ASC
	";
	$statement = mysqli_prepare( $dbh, $query );
	if ( ! $statement ) {
		return array();
	}

	mysqli_stmt_bind_param( $statement, 's', $since );
	mysqli_stmt_execute( $statement );
	mysqli_stmt_bind_result( $statement, $name, $value, $views );

	$rows = array();
	while ( mysqli_stmt_fetch( $statement ) ) {
		$rows[] = array(
			'name' => $name,
			'value' => $value,
			'views' => (int) $views,
		);
	}
	mysqli_stmt_close( $statement );

	return $rows;
}

function mywp_event_dashboard_query_event_timeline(
	$dbh,
	$table,
	$time_column,
	$since,
	$period_format
) {
	$query = "
		SELECT DATE_FORMAT(`$time_column`, '$period_format') AS `period`,
			`value`,
			SUM(`views`) AS `views`
		FROM `$table`
		WHERE `$time_column` >= ? AND `name` = 'event'
		GROUP BY `period`, `value`
		ORDER BY `period` ASC, `value` ASC
	";
	$statement = mysqli_prepare( $dbh, $query );
	if ( ! $statement ) {
		return array();
	}

	mysqli_stmt_bind_param( $statement, 's', $since );
	mysqli_stmt_execute( $statement );
	mysqli_stmt_bind_result( $statement, $period, $value, $views );

	$rows = array();
	while ( mysqli_stmt_fetch( $statement ) ) {
		$rows[] = array(
			'period' => $period,
			'value' => $value,
			'views' => (int) $views,
		);
	}
	mysqli_stmt_close( $statement );

	return $rows;
}

function mywp_event_dashboard_group_rows( $rows ) {
	$groups = array();
	foreach ( $rows as $row ) {
		$name = $row['name'];
		if ( ! isset( $groups[ $name ] ) ) {
			$groups[ $name ] = array();
		}
		$groups[ $name ][] = $row;
	}
	return $groups;
}

function mywp_event_dashboard_render( $stats, $current_user ) {
	$groups = mywp_event_dashboard_group_rows( $stats['rows'] );
	$metric_definitions = mywp_event_dashboard_metric_definitions();
	$metric_sections = mywp_event_dashboard_metric_sections();
	$other_metric_names = mywp_event_dashboard_other_metric_names(
		array_keys( $groups ),
		$metric_sections
	);
	?>
	<!doctype html>
	<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Personal WP Usage Stats</title>
		<style>
			:root {
				color-scheme: light;
				--bg: #f5f6f8;
				--surface: #fff;
				--border: #dcdcde;
				--text: #1d2327;
				--muted: #646970;
				--accent: #0a7a69;
				--accent-2: #3858e9;
				--accent-3: #b26200;
			}
			* {
				box-sizing: border-box;
			}
			body {
				margin: 0;
				background: var(--bg);
				color: var(--text);
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				font-size: 14px;
				line-height: 1.5;
			}
			header {
				background: #1d2327;
				color: #fff;
				padding: 24px;
			}
			main {
				max-width: 1280px;
				margin: 0 auto;
				padding: 24px;
			}
			h1 {
				margin: 0 0 8px;
				font-size: 28px;
				line-height: 1.2;
			}
			h2 {
				margin: 0 0 12px;
				font-size: 18px;
			}
			a {
				color: inherit;
			}
			.header-row,
			.controls {
				display: flex;
				gap: 12px;
				justify-content: space-between;
				align-items: center;
				flex-wrap: wrap;
			}
			.controls a,
			.controls span {
				border: 1px solid var(--border);
				border-radius: 4px;
				padding: 6px 10px;
				text-decoration: none;
			}
			.controls span {
				background: var(--text);
				color: #fff;
			}
			.grid {
				display: grid;
				gap: 16px;
				grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
				margin: 16px 0 24px;
			}
			.panel {
				background: var(--surface);
				border: 1px solid var(--border);
				border-radius: 6px;
				padding: 16px;
			}
			.stat-number {
				font-size: 28px;
				font-weight: 700;
				line-height: 1.2;
			}
			.muted {
				color: var(--muted);
			}
			table {
				width: 100%;
				border-collapse: collapse;
			}
			th,
			td {
				border-top: 1px solid var(--border);
				padding: 8px 0;
				text-align: left;
				vertical-align: top;
			}
			th:last-child,
			td:last-child {
				text-align: right;
			}
			code {
				background: #f0f0f1;
				border-radius: 3px;
				padding: 1px 4px;
				overflow-wrap: anywhere;
			}
			.dashboard-section {
				margin: 24px 0;
			}
			.section-heading {
				margin-bottom: 12px;
			}
			.section-heading p,
			.panel p {
				margin: 0;
			}
			.bar {
				background: #f0f0f1;
				border-radius: 3px;
				height: 8px;
				margin-top: 6px;
				overflow: hidden;
			}
			.bar span {
				display: block;
				height: 100%;
				background: var(--accent);
			}
			.timeline-row {
				display: grid;
				grid-template-columns: minmax(130px, 180px) 1fr minmax(70px, auto);
				gap: 12px;
				align-items: center;
				padding: 8px 0;
				border-top: 1px solid var(--border);
			}
			.timeline-bar {
				display: flex;
				height: 18px;
				overflow: hidden;
				border-radius: 4px;
				background: #f0f0f1;
			}
			.timeline-bar span:nth-child(1) {
				background: var(--accent);
			}
			.timeline-bar span:nth-child(2) {
				background: var(--accent-2);
			}
			.timeline-bar span:nth-child(3) {
				background: var(--accent-3);
			}
			.legend {
				display: flex;
				gap: 12px;
				flex-wrap: wrap;
				margin-bottom: 12px;
			}
			.legend span {
				display: inline-flex;
				gap: 6px;
				align-items: center;
				color: var(--muted);
			}
			.legend i {
				width: 10px;
				height: 10px;
				border-radius: 50%;
			}
			.legend span:nth-child(1) i {
				background: var(--accent);
			}
			.legend span:nth-child(2) i {
				background: var(--accent-2);
			}
			.legend span:nth-child(3) i {
				background: var(--accent-3);
			}
			.notice {
				border-left: 4px solid var(--accent);
			}
			.metric {
				margin-bottom: 16px;
			}
			.kpi-detail {
				margin-top: 8px;
				color: var(--muted);
			}
			details.legacy-metrics summary {
				cursor: pointer;
				font-weight: 600;
			}
			details.legacy-metrics > p {
				margin-top: 8px;
			}
			@media (max-width: 700px) {
				header,
				main {
					padding: 16px;
				}
				.timeline-row {
					grid-template-columns: 1fr;
				}
				th,
				td {
					display: block;
					text-align: left !important;
				}
			}
		</style>
	</head>
	<body>
		<header>
			<div class="header-row">
				<div>
					<h1>Personal WP Usage Stats</h1>
					<div class="muted">
						Aggregate-only dashboard. Signed in as
						<?php echo mywp_event_dashboard_h( $current_user ); ?>.
					</div>
				</div>
				<a href="<?php echo mywp_event_dashboard_h( MYWP_EVENT_DASHBOARD_PATH ); ?>?logout=1">Sign out</a>
			</div>
		</header>
		<main>
			<section class="panel notice">
				<h2>Privacy Boundary</h2>
				<p>
					This dashboard reads only aggregate counters from
					<code>mywp_event_stats_daily</code> and
					<code>mywp_event_stats_hourly</code>. It does not show raw
					events, IP addresses, site identifiers, site names, full URLs,
					request bodies, or GitHub tokens.
				</p>
			</section>

			<section class="controls" aria-label="Dashboard filters">
				<div>
					<?php foreach ( MYWP_EVENT_DASHBOARD_ALLOWED_RANGES as $range ) : ?>
						<?php if ( $range === $stats['range'] ) : ?>
							<span><?php echo (int) $range; ?> days</span>
						<?php else : ?>
							<a href="<?php echo mywp_event_dashboard_h( mywp_event_dashboard_filter_url( $range, $stats['granularity'] ) ); ?>"><?php echo (int) $range; ?> days</a>
						<?php endif; ?>
					<?php endforeach; ?>
				</div>
				<div>
					<?php foreach ( MYWP_EVENT_DASHBOARD_ALLOWED_GRANULARITIES as $granularity ) : ?>
						<?php if ( $granularity === $stats['granularity'] ) : ?>
							<span><?php echo mywp_event_dashboard_h( $granularity ); ?></span>
						<?php else : ?>
							<a href="<?php echo mywp_event_dashboard_h( mywp_event_dashboard_filter_url( $stats['range'], $granularity ) ); ?>"><?php echo mywp_event_dashboard_h( $granularity ); ?></a>
						<?php endif; ?>
					<?php endforeach; ?>
				</div>
			</section>

			<section class="dashboard-section" aria-label="Overview">
				<div class="section-heading">
					<h2>Overview</h2>
					<p class="muted">
						Selected range since <?php echo mywp_event_dashboard_h( $stats['since'] ); ?>.
					</p>
				</div>
				<?php mywp_event_dashboard_render_overview_cards( $groups ); ?>
			</section>

			<section class="panel dashboard-section">
				<div class="section-heading">
					<h2>Event Trend</h2>
					<p class="muted">Daily or hourly aggregate event counts.</p>
				</div>
				<?php mywp_event_dashboard_render_timeline( $stats['timeline'] ); ?>
			</section>

			<?php foreach ( $metric_sections as $section_title => $section ) : ?>
				<?php mywp_event_dashboard_render_metric_section(
					$section_title,
					$section['description'],
					$section['metrics'],
					$groups,
					$metric_definitions
				); ?>
			<?php endforeach; ?>

			<?php if ( ! empty( $other_metric_names ) ) : ?>
				<details class="legacy-metrics dashboard-section">
					<summary>Other Metrics</summary>
					<p class="muted">
						Older or unexpected aggregate counters kept separate from the main view.
					</p>
					<section class="grid">
						<?php foreach ( $other_metric_names as $metric_name ) : ?>
							<?php if ( empty( $groups[ $metric_name ] ) ) { continue; } ?>
							<div class="panel metric">
								<h2><?php echo mywp_event_dashboard_h( $metric_definitions[ $metric_name ] ?? $metric_name ); ?></h2>
								<?php mywp_event_dashboard_render_metric_table( $groups[ $metric_name ] ); ?>
							</div>
						<?php endforeach; ?>
					</section>
				</details>
			<?php endif; ?>
		</main>
	</body>
	</html>
	<?php
}

function mywp_event_dashboard_render_overview_cards( $groups ) {
	$new_installs = mywp_event_dashboard_event_count(
		$groups,
		'wordpress_installed'
	);
	$returning_visits = mywp_event_dashboard_event_count(
		$groups,
		'returning_visit'
	);
	$blueprint_installs = mywp_event_dashboard_event_count(
		$groups,
		'blueprint_installed'
	);
	$total_views = mywp_event_dashboard_sum_views( $groups['event'] ?? array() );
	?>
	<section class="grid" aria-label="Event totals">
		<div class="panel">
			<div class="muted">New installs</div>
			<div class="stat-number"><?php echo mywp_event_dashboard_number( $new_installs ); ?></div>
			<div class="kpi-detail">
				<?php echo mywp_event_dashboard_percent( $new_installs, $total_views ); ?> of all events
			</div>
		</div>
		<div class="panel">
			<div class="muted">Returning visits</div>
			<div class="stat-number"><?php echo mywp_event_dashboard_number( $returning_visits ); ?></div>
			<div class="kpi-detail">
				<?php echo mywp_event_dashboard_ratio( $returning_visits, $new_installs ); ?> per new install
			</div>
		</div>
		<div class="panel">
			<div class="muted">Blueprint installs</div>
			<div class="stat-number"><?php echo mywp_event_dashboard_number( $blueprint_installs ); ?></div>
			<div class="kpi-detail">
				<?php echo mywp_event_dashboard_ratio( $blueprint_installs, $new_installs ); ?> per new install
			</div>
		</div>
		<div class="panel">
			<div class="muted">Total aggregate event count</div>
			<div class="stat-number"><?php echo mywp_event_dashboard_number( $total_views ); ?></div>
			<div class="kpi-detail">Across all event types</div>
		</div>
	</section>
	<?php
}

function mywp_event_dashboard_render_timeline( $rows ) {
	if ( empty( $rows ) ) {
		echo '<p class="muted">No events in this range.</p>';
		return;
	}

	$periods = array();
	$event_values = array();
	foreach ( $rows as $row ) {
		$period = $row['period'];
		$value = $row['value'];
		if ( ! isset( $periods[ $period ] ) ) {
			$periods[ $period ] = array( 'total' => 0, 'values' => array() );
		}
		$periods[ $period ]['total'] += $row['views'];
		$periods[ $period ]['values'][ $value ] = $row['views'];
		$event_values[ $value ] = true;
	}

	$max_total = max( array_column( $periods, 'total' ) );
	$event_values = mywp_event_dashboard_order_event_values(
		array_keys( $event_values )
	);
	mywp_event_dashboard_render_timeline_legend( $event_values );
	foreach ( $periods as $period => $period_data ) {
		echo '<div class="timeline-row">';
		echo '<div><code>' . mywp_event_dashboard_h( $period ) . '</code></div>';
		echo '<div class="timeline-bar">';
		foreach ( $event_values as $event_value ) {
			$views = $period_data['values'][ $event_value ] ?? 0;
			if ( 0 === $views ) {
				continue;
			}
			$width = $max_total > 0 ? ( $views / $max_total ) * 100 : 0;
			echo '<span title="' .
				mywp_event_dashboard_h( "$event_value: $views" ) .
				'" style="width:' .
				mywp_event_dashboard_h( sprintf( '%.2f%%', $width ) ) .
				';background:' .
				mywp_event_dashboard_h(
					mywp_event_dashboard_event_color( $event_value )
				) .
				'"></span>';
		}
		echo '</div>';
		echo '<div>' . mywp_event_dashboard_number( $period_data['total'] ) . '</div>';
		echo '</div>';
	}
}

function mywp_event_dashboard_render_timeline_legend( $event_values ) {
	echo '<div class="legend">';
	foreach ( $event_values as $event_value ) {
		echo '<span><i style="background:' .
			mywp_event_dashboard_h(
				mywp_event_dashboard_event_color( $event_value )
			) .
			'"></i>' .
			mywp_event_dashboard_h(
				mywp_event_dashboard_event_label( $event_value )
			) .
			'</span>';
	}
	echo '</div>';
}

function mywp_event_dashboard_order_event_values( $event_values ) {
	$preferred_order = array(
		'wordpress_installed',
		'returning_visit',
		'blueprint_installed',
	);
	$ordered_values = array();
	foreach ( $preferred_order as $event_value ) {
		if ( in_array( $event_value, $event_values, true ) ) {
			$ordered_values[] = $event_value;
		}
	}
	foreach ( $event_values as $event_value ) {
		if ( ! in_array( $event_value, $ordered_values, true ) ) {
			$ordered_values[] = $event_value;
		}
	}

	return $ordered_values;
}

function mywp_event_dashboard_render_metric_table( $rows ) {
	$max_views = max( array_column( $rows, 'views' ) );
	echo '<table><thead><tr><th>Value</th><th>Views</th></tr></thead><tbody>';
	foreach ( $rows as $row ) {
		$width = $max_views > 0 ? ( $row['views'] / $max_views ) * 100 : 0;
		echo '<tr><td><code>' .
			mywp_event_dashboard_h( $row['value'] ) .
			'</code><div class="bar"><span style="width:' .
			mywp_event_dashboard_h( sprintf( '%.2f%%', $width ) ) .
			'"></span></div></td><td>' .
			mywp_event_dashboard_number( $row['views'] ) .
			'</td></tr>';
	}
	echo '</tbody></table>';
}

function mywp_event_dashboard_sum_views( $rows ) {
	$total = 0;
	foreach ( $rows as $row ) {
		$total += $row['views'];
	}
	return $total;
}

function mywp_event_dashboard_event_count( $groups, $event ) {
	foreach ( $groups['event'] ?? array() as $row ) {
		if ( $event === $row['value'] ) {
			return $row['views'];
		}
	}

	return 0;
}

function mywp_event_dashboard_render_metric_section(
	$title,
	$description,
	$metric_names,
	$groups,
	$metric_definitions
) {
	$available_metric_names = array_values(
		array_filter(
			$metric_names,
			function ( $metric_name ) use ( $groups ) {
				return ! empty( $groups[ $metric_name ] );
			}
		)
	);
	if ( empty( $available_metric_names ) ) {
		return;
	}
	?>
	<section class="dashboard-section">
		<div class="section-heading">
			<h2><?php echo mywp_event_dashboard_h( $title ); ?></h2>
			<p class="muted"><?php echo mywp_event_dashboard_h( $description ); ?></p>
		</div>
		<div class="grid">
			<?php foreach ( $available_metric_names as $metric_name ) : ?>
				<div class="panel metric">
					<h2><?php echo mywp_event_dashboard_h( $metric_definitions[ $metric_name ] ?? $metric_name ); ?></h2>
					<?php mywp_event_dashboard_render_metric_table( $groups[ $metric_name ] ); ?>
				</div>
			<?php endforeach; ?>
		</div>
	</section>
	<?php
}

function mywp_event_dashboard_metric_sections() {
	return array(
		'Growth and Retention' => array(
			'description' => 'Signals that explain new-site and returning-site usage.',
			'metrics' => array(
				'wordpress_installed:original_blueprint_source',
				'wordpress_installed:storage',
				'returning_visit:previous_visit_age_bucket',
				'returning_visit:site_age_bucket',
				'returning_visit:storage',
			),
		),
		'Blueprint Installs' => array(
			'description' => 'Which blueprint paths and plugin buckets are being installed.',
			'metrics' => array(
				'blueprint_installed:blueprint_id',
				'blueprint_installed:plugin_slug',
				'blueprint_installed:trigger',
				'blueprint_installed:request_source',
				'blueprint_installed:blueprint_source',
			),
		),
	);
}

function mywp_event_dashboard_other_metric_names( $names, $metric_sections ) {
	$known_names = array( 'event' );
	foreach ( $metric_sections as $section ) {
		$known_names = array_merge( $known_names, $section['metrics'] );
	}

	$other_names = array();
	foreach ( $names as $name ) {
		if ( ! in_array( $name, $known_names, true ) ) {
			$other_names[] = $name;
		}
	}
	sort( $other_names );
	return $other_names;
}

function mywp_event_dashboard_percent( $value, $total ) {
	if ( $total <= 0 ) {
		return '0%';
	}

	return number_format( ( $value / $total ) * 100, 1 ) . '%';
}

function mywp_event_dashboard_ratio( $numerator, $denominator ) {
	if ( $denominator <= 0 ) {
		return '0.0x';
	}

	return number_format( $numerator / $denominator, 1 ) . 'x';
}

function mywp_event_dashboard_event_color( $event ) {
	$colors = array(
		'wordpress_installed' => '#0a7a69',
		'returning_visit' => '#3858e9',
		'blueprint_installed' => '#b26200',
	);

	return $colors[ $event ] ?? '#646970';
}

function mywp_event_dashboard_event_label( $event ) {
	$labels = array(
		'wordpress_installed' => 'New installs',
		'returning_visit' => 'Returning visits',
		'blueprint_installed' => 'Blueprint installs',
	);

	return $labels[ $event ] ?? $event;
}

function mywp_event_dashboard_metric_definitions() {
	return array(
		'event' => 'Events',
		'wordpress_installed:storage' => 'New Installs: Storage',
		'wordpress_installed:site_age_bucket' => 'New Installs: Site Age',
		'wordpress_installed:previous_visit_age_bucket' => 'New Installs: Previous Visit Age',
		'wordpress_installed:original_blueprint_source' => 'New Installs: Original Blueprint Source',
		'returning_visit:storage' => 'Returning Visits: Storage',
		'returning_visit:site_age_bucket' => 'Returning Visits: Site Age',
		'returning_visit:previous_visit_age_bucket' => 'Returning Visits: Previous Visit Age',
		'blueprint_installed:trigger' => 'Blueprint Installs: Trigger',
		'blueprint_installed:request_source' => 'Blueprint Installs: Request Source',
		'blueprint_installed:blueprint_source' => 'Blueprint Installs: Source Class',
		'blueprint_installed:blueprint_id' => 'Blueprint Installs: Blueprint ID',
		'blueprint_installed:plugin_slug' => 'Blueprint Installs: Plugin Slug',
	);
}

function mywp_event_dashboard_filter_url( $range, $granularity ) {
	return MYWP_EVENT_DASHBOARD_PATH . '?' . http_build_query(
		array(
			'range' => $range,
			'granularity' => $granularity,
		)
	);
}

function mywp_event_dashboard_number( $value ) {
	return number_format( (int) $value );
}

function mywp_event_dashboard_h( $value ) {
	return htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' );
}
