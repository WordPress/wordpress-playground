<?php

declare(strict_types=1);

if (!function_exists('mysqli_stmt_get_result')) {
	function mysqli_stmt_get_result() {
		// Dummy function to supress phpMyAdmin warning.
	}
}

$cfg['CheckConfigurationPermissions'] = false;
$cfg['environment'] = 'development';

$cfg['VersionCheck'] = false;

// Suppress warnings about missing extensions
$cfg['ServerLibraryDifference_DisableWarning'] = true;
$cfg['LoginCookieValidity'] = 86400;
$cfg['SendErrorReports'] = 'never';

/**
 * This is needed for cookie based authentication to encrypt the cookie.
 * Needs to be a 32-bytes long string of random bytes. See FAQ 2.10.
 */
$cfg['blowfish_secret'] = ''; /* YOU MUST FILL IN THIS FOR COOKIE AUTH! */

// Server configuration
$cfg['Servers'][1]['host'] = '127.0.0.1';
$cfg['Servers'][1]['auth_type'] = 'config';
$cfg['Servers'][1]['user'] = 'root';
$cfg['Servers'][1]['password'] = '';
$cfg['Servers'][1]['AllowNoPassword'] = true;
$cfg['Servers'][1]['compress'] = false;
