<?php
/**
 * Tests for SSGWP_Plugin helpers.
 *
 * @package PlaygroundStaticSiteGenerator
 */

define( 'ABSPATH', '/' );
define( 'HOUR_IN_SECONDS', 3600 );

$ssgwp_transients = array();
$ssgwp_user_meta  = array();

function sanitize_key( $key ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
}

function sanitize_text_field( $value ) {
	return trim( strip_tags( (string) $value ) );
}

function trailingslashit( $value ) {
	return rtrim( (string) $value, "/\\" ) . '/';
}

function get_temp_dir() {
	return '/tmp/wp-playground-test/';
}

function get_current_user_id() {
	return 42;
}

function get_transient( $key ) {
	global $ssgwp_transients;

	if ( ! isset( $ssgwp_transients[ $key ] ) ) {
		return false;
	}

	return $ssgwp_transients[ $key ]['value'];
}

function set_transient( $key, $value, $expiration ) {
	global $ssgwp_transients;

	$ssgwp_transients[ $key ] = array(
		'value'      => $value,
		'expiration' => $expiration,
	);

	return true;
}

function get_user_meta( $user_id, $key, $single = false ) {
	global $ssgwp_user_meta;

	if ( ! isset( $ssgwp_user_meta[ $user_id ][ $key ] ) ) {
		return $single ? '' : array();
	}

	return $single ? $ssgwp_user_meta[ $user_id ][ $key ] : array( $ssgwp_user_meta[ $user_id ][ $key ] );
}

function update_user_meta( $user_id, $key, $value ) {
	global $ssgwp_user_meta;

	if ( ! isset( $ssgwp_user_meta[ $user_id ] ) ) {
		$ssgwp_user_meta[ $user_id ] = array();
	}

	$ssgwp_user_meta[ $user_id ][ $key ] = $value;

	return true;
}

require_once dirname( __DIR__ ) . '/includes/class-plugin.php';

$sanitize_method = new ReflectionMethod( 'SSGWP_Plugin', 'sanitize_export_job_id' );
$sanitize_method->setAccessible( true );

$temp_dir_method = new ReflectionMethod( 'SSGWP_Plugin', 'get_export_temp_directory' );
$temp_dir_method->setAccessible( true );

ssgwp_assert_same(
	'/tmp/wp-playground-test/static-site-generator',
	$temp_dir_method->invoke( null ),
	'get_export_temp_directory keeps admin ZIP scratch files outside uploads.'
);

ssgwp_assert_same(
	'job_123-danger',
	$sanitize_method->invoke( null, 'JOB_123-<b>Danger</b>../' ),
	'sanitize_export_job_id keeps only safe opaque id characters.'
);

ssgwp_assert_same(
	64,
	strlen( $sanitize_method->invoke( null, str_repeat( 'a', 80 ) ) ),
	'sanitize_export_job_id limits stored ids to 64 characters.'
);

$progress_key_method = new ReflectionMethod( 'SSGWP_Plugin', 'progress_transient_key' );
$progress_key_method->setAccessible( true );

$latest_meta_key_method = new ReflectionMethod( 'SSGWP_Plugin', 'latest_export_meta_key' );
$latest_meta_key_method->setAccessible( true );

$store_method = new ReflectionMethod( 'SSGWP_Plugin', 'store_progress_event' );
$store_method->setAccessible( true );

$latest_progress_method = new ReflectionMethod( 'SSGWP_Plugin', 'get_latest_export_progress' );
$latest_progress_method->setAccessible( true );
$store_method->invoke(
	null,
	'job-1',
	array(
		'stage'          => 'render_page',
		'message'        => 'Rendering <strong>page</strong>.',
		'pages_exported' => 2,
		'files_exported' => 5,
		'context'        => array(
			'queue_position' => 3,
			'queue_total'    => 7,
		),
	)
);

$progress_key = $progress_key_method->invoke( null, 'job-1' );

ssgwp_assert_same(
	'render_page',
	$ssgwp_transients[ $progress_key ]['value']['stage'],
	'store_progress_event stores the latest progress stage.'
);

ssgwp_assert_same(
	'Rendering page.',
	$ssgwp_transients[ $progress_key ]['value']['message'],
	'store_progress_event sanitizes the browser-facing progress message.'
);

ssgwp_assert_same(
	7,
	$ssgwp_transients[ $progress_key ]['value']['context']['queue_total'],
	'store_progress_event preserves structured progress context.'
);

ssgwp_assert_same(
	25,
	$ssgwp_transients[ $progress_key ]['value']['percent'],
	'store_progress_event calculates progress from queue position and queue total.'
);

ssgwp_assert_same(
	array(
		'job_id' => 'job-1',
		'run_id' => '',
	),
	$ssgwp_user_meta[42][ $latest_meta_key_method->invoke( null ) ],
	'store_progress_event remembers the latest export for admin page reloads.'
);

ssgwp_assert_same(
	'render_page',
	$latest_progress_method->invoke( null )['state']['stage'],
	'get_latest_export_progress reloads the current export progress state.'
);

ssgwp_assert_same(
	HOUR_IN_SECONDS,
	$ssgwp_transients[ $progress_key ]['expiration'],
	'store_progress_event keeps progress available long enough for browser polling.'
);

$store_method->invoke(
	null,
	'job-1',
	array(
		'stage'   => 'zip_complete',
		'message' => 'Previous export finished.',
	),
	'run-previous'
);
$store_method->invoke(
	null,
	'job-1',
	array(
		'stage'   => 'started',
		'message' => 'New export started.',
	),
	'run-current'
);

$previous_run_key = $progress_key_method->invoke( null, 'job-1', 'run-previous' );
$current_run_key  = $progress_key_method->invoke( null, 'job-1', 'run-current' );

ssgwp_assert_not_same(
	$previous_run_key,
	$current_run_key,
	'progress_transient_key isolates repeated exports with different run ids.'
);

ssgwp_assert_same(
	'zip_complete',
	$ssgwp_transients[ $previous_run_key ]['value']['stage'],
	'store_progress_event keeps previous run progress isolated.'
);

ssgwp_assert_same(
	'started',
	$ssgwp_transients[ $current_run_key ]['value']['stage'],
	'store_progress_event stores current run progress separately.'
);

$store_method->invoke(
	null,
	'job-3',
	array(
		'stage'          => 'page_exported',
		'message'        => 'Exported a page.',
		'pages_exported' => 1,
		'context'        => array( 'queue_total' => 2 ),
	),
	'run-3'
);
$store_method->invoke(
	null,
	'job-3',
	array(
		'stage'   => 'zip_complete',
		'message' => 'Static export ZIP created.',
	),
	'run-3'
);

$log_key = $progress_key_method->invoke( null, 'job-3', 'run-3' );

ssgwp_assert_same(
	100,
	$ssgwp_transients[ $log_key ]['value']['percent'],
	'store_progress_event advances terminal progress to 100 percent.'
);

ssgwp_assert_same(
	true,
	$ssgwp_transients[ $log_key ]['value']['is_terminal'],
	'store_progress_event marks completed exports as terminal for polling.'
);

ssgwp_assert_same(
	'page_exported',
	$ssgwp_transients[ $log_key ]['value']['log'][0]['stage'],
	'store_progress_event keeps a browser-facing log of completed actions.'
);

ssgwp_assert_same(
	'zip_complete',
	$ssgwp_transients[ $log_key ]['value']['log'][1]['stage'],
	'store_progress_event appends terminal events to the completed action log.'
);

$callback_method = new ReflectionMethod( 'SSGWP_Plugin', 'create_progress_callback' );
$callback_method->setAccessible( true );
$callback = $callback_method->invoke( null, 'job-2', 'run-2' );
$callback(
	array(
		'stage'   => 'zip_complete',
		'message' => 'Static export ZIP created.',
	)
);

$callback_key = $progress_key_method->invoke( null, 'job-2', 'run-2' );

ssgwp_assert_same(
	'zip_complete',
	$ssgwp_transients[ $callback_key ]['value']['stage'],
	'create_progress_callback stores exporter progress events.'
);

/**
 * Assert two values are identical.
 *
 * @param mixed  $expected Expected value.
 * @param mixed  $actual   Actual value.
 * @param string $message  Failure message.
 */
function ssgwp_assert_same( $expected, $actual, $message ) {
	if ( $expected === $actual ) {
		return;
	}

	ssgwp_fail( $message . ' Expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) . '.' );
}

/**
 * Assert two values are not identical.
 *
 * @param mixed  $unexpected Unexpected value.
 * @param mixed  $actual     Actual value.
 * @param string $message    Failure message.
 */
function ssgwp_assert_not_same( $unexpected, $actual, $message ) {
	if ( $unexpected !== $actual ) {
		return;
	}

	ssgwp_fail( $message . ' Did not expect ' . var_export( $actual, true ) . '.' );
}

/**
 * Exit with a test failure.
 *
 * @param string $message Failure message.
 */
function ssgwp_fail( $message ) {
	fwrite( STDERR, $message . PHP_EOL ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
	exit( 1 );
}
