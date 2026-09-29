<?php
// Served only from a random, temporary path in the local Playground. Removed
// by the caller after the cookie round trip, including on failure.
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    wp_upgrade();
    // Theme roots and cached theme errors describe the source filesystem.
    // Rebuild them from the downloaded files without changing the active theme.
    delete_option('stylesheet_root');
    delete_option('template_root');
    delete_site_transient('theme_roots');
    wp_clean_themes_cache();
    $admins = get_users(['role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'order' => 'ASC']);
    if (!$admins) {
        http_response_code(409);
        echo json_encode(['error' => 'The imported site has no administrator account.']);
        return;
    }
    if (headers_sent()) {
        http_response_code(500);
        echo json_encode(['error' => 'WordPress sent output before the login cookies. Check Logs.']);
        return;
    }
    wp_set_current_user($admins[0]->ID);
    wp_set_auth_cookie($admins[0]->ID);
}

// A separate GET must also pass, proving that the cookie was accepted rather
// than merely checking the user set in memory during the POST.
$theme_error = wp_get_theme()->errors();
echo json_encode([
    'loggedIn' => current_user_can('manage_options'),
    'username' => wp_get_current_user()->user_login,
    'warning' => $theme_error ? wp_strip_all_tags($theme_error->get_error_message()) : null,
]);
