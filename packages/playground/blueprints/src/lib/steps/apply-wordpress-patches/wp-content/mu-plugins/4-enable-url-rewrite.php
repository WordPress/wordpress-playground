<?php
/**
 * Supports URL rewriting to remove `index.php` from permalinks.
 */
add_filter( 'got_url_rewrite', '__return_true' );
