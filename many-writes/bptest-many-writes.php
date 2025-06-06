<?php
/*
 * Plugin Name: Write-heavy operations
 **/
add_action( 'muplugins_loaded', function() {
	if ( ! isset( $_GET['write'] ) ) {
			return;
	}

	$key = 'bptest-' . microtime( true );
	$limit = (int) $_GET['write'];
	for ( $i = 0; $i < $limit; $i++ ) {
		update_option( $key, random_bytes(100));
	}
	echo "Wrote $limit options\n";
	exit;
} );
