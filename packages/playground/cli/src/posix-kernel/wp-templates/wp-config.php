<?php
define('DB_NAME', 'wordpress');
define('DB_USER', '');
define('DB_PASSWORD', '');
define('DB_HOST', '');
define('DB_CHARSET', 'utf8');
define('DB_COLLATE', '');

define('DB_DIR', __DIR__ . '/wp-content/database/');
define('DB_FILE', 'wordpress.db');

define('AUTH_KEY',         'playground-posix-kernel-dev');
define('SECURE_AUTH_KEY',  'playground-posix-kernel-dev');
define('LOGGED_IN_KEY',    'playground-posix-kernel-dev');
define('NONCE_KEY',        'playground-posix-kernel-dev');
define('AUTH_SALT',        'playground-posix-kernel-dev');
define('SECURE_AUTH_SALT', 'playground-posix-kernel-dev');
define('LOGGED_IN_SALT',   'playground-posix-kernel-dev');
define('NONCE_SALT',       'playground-posix-kernel-dev');

$table_prefix = 'wp_';

// Conditional so the playground-defines mu-plugin (loaded earlier via
// router.php) wins when --define / --define-bool / --define-number sets
// these. Without the guard, wp-config.php's redefine triggers PHP
// warnings that prepend HTML to JSON test responses.
if (!defined('WP_DEBUG')) {
    define('WP_DEBUG', true);
}
if (!defined('WP_DEBUG_LOG')) {
    define('WP_DEBUG_LOG', true);
}
if (!defined('WP_DEBUG_DISPLAY')) {
    define('WP_DEBUG_DISPLAY', true);
}

if (isset($_SERVER['HTTP_HOST'])) {
    define('WP_HOME', 'http://' . $_SERVER['HTTP_HOST']);
    define('WP_SITEURL', 'http://' . $_SERVER['HTTP_HOST']);
}

define('WP_HTTP_BLOCK_EXTERNAL', true);
define('DISABLE_WP_CRON', true);

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
