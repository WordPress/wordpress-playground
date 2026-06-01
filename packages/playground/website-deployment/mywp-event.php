<?php

const MYWP_EVENT_MAX_BODY_BYTES = 8192;
const MYWP_EVENT_RATE_LIMIT_CAPACITY = 300;
const MYWP_EVENT_RATE_LIMIT_FILL_RATE_PER_MINUTE = 120;
const MYWP_EVENT_MAX_PLUGIN_SLUGS = 10;
const MYWP_EVENT_SAFE_PLUGIN_SLUG_PATTERN = '/^[a-z0-9][a-z0-9-]{0,100}$/';

const MYWP_EVENT_ALLOWED_EVENTS = array(
	'wordpress_installed',
	'returning_visit',
	'blueprint_installed',
);

if ( 'cli' !== php_sapi_name() ) {
	mywp_event_handle_request();
}

function mywp_event_handle_request() {
	header( 'Cache-Control: no-store' );

	if ( ! mywp_event_is_allowed_host() ) {
		http_response_code( 404 );
		return;
	}

	if ( ! mywp_event_is_allowed_request_origin() ) {
		http_response_code( 403 );
		return;
	}

	if ( 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
		header( 'Allow: POST, OPTIONS' );
		http_response_code( 204 );
		return;
	}

	if ( 'POST' !== $_SERVER['REQUEST_METHOD'] ) {
		header( 'Allow: POST, OPTIONS' );
		http_response_code( 405 );
		return;
	}

	$content_length = (int) ( $_SERVER['CONTENT_LENGTH'] ?? 0 );
	if ( $content_length > MYWP_EVENT_MAX_BODY_BYTES ) {
		http_response_code( 413 );
		return;
	}

	$dbh = mywp_event_connect_db();
	if ( ! $dbh ) {
		http_response_code( 503 );
		return;
	}

	try {
		if ( ! mywp_event_obtain_rate_limit_token( $dbh ) ) {
			http_response_code( 429 );
			return;
		}

		$raw_body = file_get_contents( 'php://input' );
		if (
			false === $raw_body ||
			strlen( $raw_body ) > MYWP_EVENT_MAX_BODY_BYTES
		) {
			http_response_code( 413 );
			return;
		}

		$payload = json_decode( $raw_body, true );
		if ( ! is_array( $payload ) ) {
			http_response_code( 400 );
			return;
		}

		$bumps = mywp_event_collect_stat_bumps( $payload );
		if ( empty( $bumps ) ) {
			http_response_code( 204 );
			return;
		}

		$today = gmdate( 'Y-m-d' );
		$hour = gmdate( 'Y-m-d H:00:00' );
		foreach ( $bumps as $bump ) {
			if (
				! mywp_event_sync_bump_extra(
					$dbh,
					$bump['name'],
					$bump['value'],
					$bump['views'],
					$today,
					$hour
				)
			) {
				http_response_code( 500 );
				return;
			}
		}

		http_response_code( 204 );
	} finally {
		mysqli_close( $dbh );
	}
}

function mywp_event_is_allowed_host() {
	return (
		isset( $_SERVER['HTTP_HOST'] ) &&
		mywp_event_is_my_wordpress_host( $_SERVER['HTTP_HOST'] )
	);
}

function mywp_event_is_allowed_request_origin() {
	$has_request_origin = false;
	foreach ( array( 'HTTP_ORIGIN', 'HTTP_REFERER' ) as $header_name ) {
		if ( empty( $_SERVER[ $header_name ] ) ) {
			continue;
		}
		$has_request_origin = true;

		$host = parse_url( $_SERVER[ $header_name ], PHP_URL_HOST );
		if (
			! is_string( $host ) ||
			! mywp_event_is_my_wordpress_host( $host )
		) {
			return false;
		}
	}

	return $has_request_origin;
}

function mywp_event_is_my_wordpress_host( $host ) {
	$normalized_host = mywp_event_normalize_host( $host );
	return (
		$normalized_host &&
		in_array( $normalized_host, mywp_event_get_allowed_hosts(), true )
	);
}

function mywp_event_get_allowed_hosts() {
	$raw_hosts = mywp_event_get_config_value( 'MYWP_EVENT_ALLOWED_HOSTS' )
		?: 'my.wordpress.net';
	$hosts = preg_split( '/[\s,]+/', strtolower( trim( $raw_hosts ) ) );
	$allowed_hosts = array();
	foreach ( $hosts as $host ) {
		$normalized_host = mywp_event_normalize_host( $host );
		if ( $normalized_host ) {
			$allowed_hosts[] = $normalized_host;
		}
	}
	return array_values( array_unique( $allowed_hosts ) );
}

function mywp_event_normalize_host( $host ) {
	if ( ! is_string( $host ) ) {
		return false;
	}

	$match = array();
	if ( ! preg_match( '/^([a-z0-9.-]+)(?::\d+)?$/i', $host, $match ) ) {
		return false;
	}

	return strtolower( $match[1] );
}

function mywp_event_connect_db() {
	$db_host = mywp_event_get_db_config_value( 'HOST' );
	$db_user = mywp_event_get_db_config_value( 'USER' );
	$db_password = mywp_event_get_db_config_value( 'PASSWORD' );
	$db_name = mywp_event_get_db_config_value( 'NAME' );

	foreach (
		array(
			'MYWP_DB_HOST' => $db_host,
			'MYWP_DB_USER' => $db_user,
			'MYWP_DB_PASSWORD' => $db_password,
			'MYWP_DB_NAME' => $db_name,
		) as $name => $value
	) {
		if ( ! is_string( $value ) || '' === $value ) {
			error_log( "MYWP event logging: $name is missing" );
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
		error_log( 'MYWP event logging: failed to connect to MySQL' );
		return false;
	}

	mysqli_set_charset( $dbh, 'utf8mb4' );
	return $dbh;
}

function mywp_event_collect_stat_bumps( $payload ) {
	if (
		( $payload['schema'] ?? null ) !== 'personal-wp-event/v1' ||
		( $payload['app'] ?? null ) !== 'personal-wp'
	) {
		return array();
	}

	$event = $payload['event'] ?? null;
	if ( ! in_array( $event, MYWP_EVENT_ALLOWED_EVENTS, true ) ) {
		return array();
	}

	$properties = $payload['properties'] ?? array();
	if ( ! is_array( $properties ) ) {
		$properties = array();
	}

	$bumps = array();
	mywp_event_add_bump( $bumps, 'event', $event );

	mywp_event_add_allowed_property(
		$bumps,
		$event,
		'site_age_bucket',
		$properties,
		mywp_event_age_buckets()
	);
	mywp_event_add_allowed_property(
		$bumps,
		$event,
		'previous_visit_age_bucket',
		$properties,
		mywp_event_age_buckets()
	);

	if ( 'wordpress_installed' === $event ) {
		mywp_event_add_allowed_property(
			$bumps,
			$event,
			'original_blueprint_source',
			$properties,
			array(
				'inline-string',
				'last-autosave',
				'none',
				'opfs-site',
				'personal-blueprint',
				'remote-url',
			)
		);
	}

	if ( 'blueprint_installed' === $event ) {
		mywp_event_add_blueprint_bumps( $bumps, $properties );
	}

	return $bumps;
}

function mywp_event_add_blueprint_bumps( &$bumps, $properties ) {
	mywp_event_add_allowed_property(
		$bumps,
		'blueprint_installed',
		'trigger',
		$properties,
		array( 'app-request', 'dependent-tab-request', 'url' )
	);
	mywp_event_add_allowed_property(
		$bumps,
		'blueprint_installed',
		'request_source',
		$properties,
		array( 'my-apps' )
	);
	mywp_event_add_allowed_property(
		$bumps,
		'blueprint_installed',
		'blueprint_source',
		$properties,
		array(
			'data-url',
			'external-url',
			'github',
			'invalid-url',
			'other-url',
			'same-origin',
			'wordpress-org',
		)
	);
	mywp_event_add_safe_list_bumps(
		$bumps,
		'blueprint_installed:plugin_slug',
		$properties['plugin_slugs'] ?? null,
		MYWP_EVENT_SAFE_PLUGIN_SLUG_PATTERN,
		MYWP_EVENT_MAX_PLUGIN_SLUGS
	);
}

function mywp_event_add_allowed_property(
	&$bumps,
	$event,
	$property,
	$properties,
	$allowed_values
) {
	$value = $properties[ $property ] ?? null;
	if ( in_array( $value, $allowed_values, true ) ) {
		mywp_event_add_bump( $bumps, "$event:$property", $value );
	}
}

function mywp_event_add_safe_list_bumps(
	&$bumps,
	$name,
	$values,
	$pattern,
	$max_values
) {
	if ( ! is_array( $values ) ) {
		return;
	}

	$seen = array();
	foreach ( $values as $value ) {
		if (
			! is_string( $value ) ||
			! preg_match( $pattern, $value ) ||
			isset( $seen[ $value ] )
		) {
			continue;
		}

		$seen[ $value ] = true;
		mywp_event_add_bump( $bumps, $name, $value );
		if ( count( $seen ) >= $max_values ) {
			return;
		}
	}
}

function mywp_event_add_bump( &$bumps, $name, $value, $views = 1 ) {
	if (
		! is_string( $name ) ||
		! is_string( $value ) ||
		! preg_match( '/^[a-z0-9_:.-]{1,80}$/', $name ) ||
		! preg_match( '/^[A-Za-z0-9_.:\/-]{1,128}$/', $value )
	) {
		return;
	}

	$bumps[] = array(
		'name' => $name,
		'value' => $value,
		'views' => min( max( (int) $views, 1 ), 50 ),
	);
}

function mywp_event_age_buckets() {
	return array(
		'unknown',
		'same-day',
		'1-7-days',
		'8-30-days',
		'31-90-days',
		'over-90-days',
	);
}

function mywp_event_sync_bump_extra( $dbh, $name, $value, $num, $today, $hour ) {
	$success_daily = mywp_event_execute_bump(
		$dbh,
		'INSERT INTO mywp_event_stats_daily ( `date`, `name`, `value`, `views` )
			VALUES ( ?, ?, ?, ? )
			ON DUPLICATE KEY UPDATE `views` = `views` + VALUES( `views` )',
		$today,
		$name,
		$value,
		$num
	);
	$success_hourly = mywp_event_execute_bump(
		$dbh,
		'INSERT INTO mywp_event_stats_hourly ( `hour`, `name`, `value`, `views` )
			VALUES ( ?, ?, ?, ? )
			ON DUPLICATE KEY UPDATE `views` = `views` + VALUES( `views` )',
		$hour,
		$name,
		$value,
		$num
	);

	return $success_daily && $success_hourly;
}

function mywp_event_execute_bump( $dbh, $query, $when, $name, $value, $num ) {
	$statement = mysqli_prepare( $dbh, $query );
	if ( ! $statement ) {
		error_log( 'MYWP event logging: failed to prepare stats query' );
		return false;
	}

	mysqli_stmt_bind_param( $statement, 'sssi', $when, $name, $value, $num );
	$success = mysqli_stmt_execute( $statement );
	mysqli_stmt_close( $statement );

	if ( ! $success ) {
		error_log( 'MYWP event logging: failed to update stats table' );
	}

	return $success;
}

function mywp_event_obtain_rate_limit_token( $dbh ) {
	$remote_key = mywp_event_get_remote_key();
	if ( ! $remote_key ) {
		return false;
	}

	$cleanup_query = <<<'SQL'
		DELETE FROM mywp_event_rate_limiting
			WHERE updated_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
		SQL;
	if ( mysqli_query( $dbh, $cleanup_query ) === false ) {
		error_log( 'MYWP event logging: failed to clean up rate limit buckets' );
		return false;
	}

	$token_query = <<<'SQL'
		INSERT INTO mywp_event_rate_limiting (
			remote_key,
			capacity,
			fill_rate_per_minute,
			tokens
		)
		WITH
			config AS (
				SELECT
					? AS remote_key,
					? AS capacity,
					? AS fill_rate_per_minute
			),
			bucket AS (
				SELECT
					remote_key,
					tokens AS previous_tokens,
					updated_at AS previous_updated_at,
					LEAST(
						config.capacity,
						tokens + FLOOR(
							config.fill_rate_per_minute
							* TIMESTAMPDIFF(SECOND, updated_at, NOW())
							/ 60
						)
					) AS available_tokens
				FROM mywp_event_rate_limiting INNER JOIN config USING (remote_key)
			)
		SELECT
			config.remote_key,
			config.capacity,
			config.fill_rate_per_minute,
			GREATEST(
				0,
				COALESCE(bucket.available_tokens, config.capacity) - 1
			) AS tokens
		FROM config LEFT OUTER JOIN bucket USING (remote_key)
		ON DUPLICATE KEY UPDATE
			capacity = IF(
				bucket.available_tokens > 0,
				VALUES(capacity),
				mywp_event_rate_limiting.capacity
			),
			fill_rate_per_minute = IF(
				bucket.available_tokens > 0,
				VALUES(fill_rate_per_minute),
				mywp_event_rate_limiting.fill_rate_per_minute
			),
			tokens = IF(
				bucket.available_tokens > 0,
				VALUES(tokens),
				mywp_event_rate_limiting.tokens
			),
			updated_at = IF(
				bucket.available_tokens > 0,
				NOW(),
				mywp_event_rate_limiting.updated_at
			)
		SQL;

	$statement = mysqli_prepare( $dbh, $token_query );
	if ( ! $statement ) {
		error_log( 'MYWP event logging: failed to prepare rate limit query' );
		return false;
	}

	$capacity = MYWP_EVENT_RATE_LIMIT_CAPACITY;
	$fill_rate = MYWP_EVENT_RATE_LIMIT_FILL_RATE_PER_MINUTE;
	mysqli_stmt_bind_param(
		$statement,
		'sii',
		$remote_key,
		$capacity,
		$fill_rate
	);

	$success =
		mysqli_stmt_execute( $statement ) &&
		mysqli_stmt_affected_rows( $statement ) > 0;
	mysqli_stmt_close( $statement );

	return $success;
}

function mywp_event_get_remote_key() {
	$remote_ip = $_SERVER['REMOTE_ADDR'] ?? '';
	$normalized = mywp_event_normalize_remote_ip( $remote_ip );
	if ( false === $normalized ) {
		error_log( 'MYWP event logging: invalid remote IP' );
		return false;
	}

	$secret = mywp_event_get_db_config_value( 'PASSWORD' ) ?: '';
	return $secret
		? hash_hmac( 'sha256', $normalized, $secret )
		: hash( 'sha256', $normalized );
}

function mywp_event_get_db_config_value( $name ) {
	return mywp_event_get_config_value( "MYWP_DB_$name" )
		?: mywp_event_get_config_value( "DB_$name" );
}

function mywp_event_get_config_value( $name ) {
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

function mywp_event_normalize_remote_ip( $remote_ip ) {
	if ( filter_var( $remote_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
		return 'v4:' . $remote_ip;
	}

	if ( ! filter_var( $remote_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
		return false;
	}

	$packed = inet_pton( $remote_ip );
	if ( false === $packed || strlen( $packed ) !== 16 ) {
		return false;
	}

	$subnet = substr( $packed, 0, 8 ) . str_repeat( "\0", 8 );
	return 'v6-64:' . inet_ntop( $subnet );
}
