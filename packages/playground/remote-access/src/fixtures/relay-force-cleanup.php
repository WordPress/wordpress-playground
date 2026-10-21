<?php
// Make cleanup fail without depending on an installed database or inherited credentials.
putenv('PLAYGROUND_RELAY_DB_HOST');
putenv('DB_HOST');

if (!function_exists('random_int')) {
    /** Replace the disabled built-in only in the test server, forcing scheduled cleanup. */
    function random_int(int $min, int $max): int {
        return $min;
    }
}
