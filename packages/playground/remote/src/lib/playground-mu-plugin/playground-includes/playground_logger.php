<?php
// Configure error logging
$log_file = WP_CONTENT_DIR . '/debug.log';
error_reporting(E_ALL);
define('ERROR_LOG_FILE', $log_file);
ini_set('error_log', $log_file);
ini_set('ignore_repeated_errors', true);
ini_set('display_errors', false);
ini_set('log_errors', true);

error_log('playground_logger.php loaded');

throw new Exception('test');
