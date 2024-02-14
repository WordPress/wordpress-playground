<?php
// Configure error logging
// @TODO use the WordPress directory
$log_file = '/tmp/debug.log';
error_reporting(E_ALL);
define('ERROR_LOG_FILE', $log_file);
ini_set('error_log', $log_file);

/**
 * Get OpenTracing severity text from PHP error code
 *
 * @param int $code PHP error code
 * @return int OpenTracing severity text
 */
function get_severity_text($code)
{
    switch ($code) {
        case E_ERROR:
        case E_CORE_ERROR:
        case E_COMPILE_ERROR:
        case E_USER_ERROR:
            return 'Error';
        case E_WARNING:
        case E_CORE_WARNING:
        case E_COMPILE_WARNING:
        case E_USER_WARNING:
            return 'Warning';
        case E_NOTICE:
        case E_USER_NOTICE:
            return 'Info';
        default:
            return 'Debug';
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
            'severityText' => get_severity_text($errno),
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
