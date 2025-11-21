<?php

/**
 * Automatically log in when the query string is empty (= main page).
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
