<?php
/** WP Cloud invokes this only when Nginx has not served a public static file. */
if ( 'cli' === php_sapi_name() ) return;
preg_match( '~<script id="playground-release" type="application/json">(.*?)</script>~s', file_get_contents( __DIR__ . '/index.html' ), $playground_match );
$playground_selector = json_decode( $playground_match[1] ?? '', true );
if ( ( $playground_selector['protocol'] ?? null ) !== 1 ||
    ! is_string( $playground_selector['release'] ?? null ) ||
    ! preg_match( '/\Arelease\.[a-zA-Z0-9]+\z/', $playground_selector['release'] ?? '' ) ||
    ! is_file( __DIR__ . '/.playground-releases/' . $playground_selector['release'] . '/custom-redirects-lib.php' ) ) {
    http_response_code( 503 );
    header( 'Cache-Control: no-store' );
    header( 'A8C-Edge-Cache: no-cache' );
    exit;
}
$playground_private = __DIR__ . '/.playground-releases/' . $playground_selector['release'];
require_once $playground_private . '/custom-redirects-lib.php';
playground_handle_public_release_request( __DIR__, $playground_private, $playground_selector );
