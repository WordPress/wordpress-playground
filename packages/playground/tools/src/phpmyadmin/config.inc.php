<?php declare(strict_types = 1);

// Configure session save path for Playground environment.
$session_dir = '/tmp/phpmyadmin-sessions';
if (!is_dir($session_dir)) {
    mkdir($session_dir, 0700, true);
}
session_save_path($session_dir);

// Enable development environment to display detailed error messages.
$cfg['environment'] = 'development';

// Playground-specific configuration.
$cfg['CheckConfigurationPermissions'] = false;
$cfg['VersionCheck'] = false;
$cfg['ShowCreateDb'] = false;
$cfg['ShowChgPassword'] = false;

// Cookie authentication secret.
$cfg['blowfish_secret'] = 'r/g+J#&)L2&p!z5gUS)d(vEU#KAynq#g';

// Server configuration
$cfg['Servers'][1]['host'] = '127.0.0.1';
$cfg['Servers'][1]['auth_type'] = 'config';
$cfg['Servers'][1]['user'] = 'root';
$cfg['Servers'][1]['password'] = '';
$cfg['Servers'][1]['AllowNoPassword'] = true;
$cfg['Servers'][1]['compress'] = false;
