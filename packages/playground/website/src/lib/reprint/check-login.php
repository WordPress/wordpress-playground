<?php
// Served only from a random, temporary path in the local Playground. Removed
// by the caller after the cookie round trip, including on failure.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // The old site may have a valid session or an "auto-login already happened"
    // cookie. Ignore both for this request so Playground's auto-login plugin
    // uses the administrator selected by the Blueprint login step.
    $_COOKIE = [];
}
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');

// A separate GET checks that the cookies set by Playground's auto-login plugin
// were accepted. This script does not create login cookies itself.
$theme_error = wp_get_theme()->errors();
echo json_encode([
    'loggedIn' => current_user_can('manage_options'),
    'username' => wp_get_current_user()->user_login,
    'warning' => $theme_error ? wp_strip_all_tags($theme_error->get_error_message()) : null,
]);
