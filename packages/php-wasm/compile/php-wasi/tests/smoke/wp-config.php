<?php
if ( ! defined( 'CONCATENATE_SCRIPTS' ) ) { define( 'CONCATENATE_SCRIPTS', false ); }
if ( ! defined( 'DB_NAME' ) ) { define( 'DB_NAME', 'wordpress' ); }
if ( ! defined( 'DB_USER' ) ) { define( 'DB_USER', 'root' ); }
if ( ! defined( 'DB_PASSWORD' ) ) { define( 'DB_PASSWORD', '' ); }
if ( ! defined( 'DB_HOST' ) ) { define( 'DB_HOST', 'localhost' ); }
if ( ! defined( 'DB_CHARSET' ) ) { define( 'DB_CHARSET', 'utf8mb4' ); }
if ( ! defined( 'DB_COLLATE' ) ) { define( 'DB_COLLATE', '' ); }

$table_prefix = 'wp_';

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
