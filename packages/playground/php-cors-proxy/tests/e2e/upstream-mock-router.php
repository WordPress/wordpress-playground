<?php
/**
 * Mock upstream server for CORS proxy e2e tests.
 *
 * Serves various response types so the CORS proxy can be tested
 * against realistic upstream behavior.
 */

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($path) {
    case '/plain-text':
        header('Content-Type: text/plain');
        echo 'Hello from plain-text endpoint';
        break;

    default:
        http_response_code(404);
        echo 'Not Found';
        break;
}
