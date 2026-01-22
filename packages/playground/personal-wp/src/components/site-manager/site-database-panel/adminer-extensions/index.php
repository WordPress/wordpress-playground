<?php

/**
 * Adminer loader file.
 *
 * Setup the MySQL-on-SQLite driver and login automatically.
 *
 * @see https://www.adminer.org/en/extension/
 */

/**
 * Automatically log in when the query string is empty (= login page).
 */
if (!count($_GET)) {
    $_POST['auth'] = [
        'driver'   => 'server',
        'server'   => '127.0.0.1',
        'username' => 'db_user',
        'password' => 'db_password',
        'db'       => 'wordpress'
    ];
}

/**
 * Load Adminer with the SQLite driver plugin.
 *
 * We need to define a custom "adminer_object" function to ensure the custom
 * Adminer driver is loaded after Adminer classes are defined, but before the
 * built-in MySQL/MariaDB driver is loaded.
 *
 * @see https://www.adminer.org/en/extension/
 */
function adminer_object() {
	require_once __DIR__ . '/adminer-mysql-on-sqlite-driver.php';
	return new Adminer\Adminer();
}
require_once __DIR__ . '/adminer.php';
