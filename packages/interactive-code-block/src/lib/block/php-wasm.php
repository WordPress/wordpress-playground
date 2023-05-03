<?php
header( 'Content-Type: application/wasm' );
header( 'Content-Length: ' . filesize( __DIR__ . '/php-8.0.wasm' ) );
header( 'Cache-Control: public, max-age=31536000' );

// If the browser supports gzip, use it
if( strpos( $_SERVER['HTTP_ACCEPT_ENCODING'], 'br' ) !== false ) {
    header( 'Content-Encoding: br' );
    $ext = '.br';
} else if( strpos( $_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip' ) !== false ) {
    header( 'Content-Encoding: gzip' );
    $ext = '.gz';
} else {
    header( 'Content-Encoding: identity' );
    $ext = '';
}


// Stream the php.wasm file to the response
$wasmFile = fopen( __DIR__ . '/php-8.0.wasm' . $ext, 'rb' );
while( ! feof( $wasmFile ) ) {
    echo fread( $wasmFile, 1024 );
    flush();
}
fclose( $wasmFile );
