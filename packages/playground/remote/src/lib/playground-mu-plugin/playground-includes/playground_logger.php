<?php

// Configure error logging
// $log_file = WP_CONTENT_DIR . '/debug.log';
$log_file = '/tmp/debug.log';
error_reporting(E_ALL);
define('ERROR_LOG_FILE', $log_file);
ini_set('error_log', $log_file);
ini_set("display_errors", "off");

/**
 * Get OpenTracing severity number from PHP error code
 *
 * @param int $code PHP error code
 * @return int OpenTracing severity number
 */
function get_severity_number($code)
{
    // @TODO Update numbers
    switch ($code) {
        case E_ERROR:
        case E_CORE_ERROR:
        case E_COMPILE_ERROR:
        case E_USER_ERROR:
            return 17;
        case E_WARNING:
        case E_CORE_WARNING:
        case E_COMPILE_WARNING:
        case E_USER_WARNING:
            return 13;
        case E_NOTICE:
        case E_USER_NOTICE:
            return 9;
        default:
            return 5;
    }
}

/**
 * Send log message to JS
 */
function playground_error_handler($errno, $errstr, $errfile, $errline)
{
    post_message_to_js(
        json_encode([
            'event' => 'wordpress-log',
            'timestamp' => time(),
            'severityNumber' => get_severity_number($errno),
            'body' => "$errstr in $errfile on line $errline",
        ])
    );
    return false;
}

set_error_handler('playground_error_handler', E_ALL);

/**
 * Collect last error on shutdown
 */
function collect_last_error_on_shutdown()
{
    $error = error_get_last();
    if ($error !== null) {
        playground_error_handler($error['type'], $error['message'], $error['file'], $error['line']);
    }
}

register_shutdown_function('collect_last_error_on_shutdown');

error_log('playground-mu-plugin loaded');
