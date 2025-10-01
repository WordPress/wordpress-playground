export const DEFAULT_PHP_VERSION = '8.4';
export const DEFAULT_WP_VERSION = '6.8';
// @TODO: Use URL imported from vite build-time config
export const DEFAULT_WP_REMOTE = 'http://127.0.0.1:5400/remote.html';
// export const DEFAULT_WP_REMOTE = 'https://playground.wordpress.net/remote.html';

// @TODO: Get rid of the hardcoded initial path, always source cwd from the client.
export const DEFAULT_WORKSPACE_DIR = '/wordpress/workspace';
export const DEFAULT_URL_PREFIX = '/workspace';

export const DEFAULT_CODE = `<?php
echo "Hello from PHP " . phpversion();
echo "<br>";

// WordPress is available if you need it!
require '/wordpress/wp-load.php';

echo "WordPress " . wp_get_wp_version() . "<br>";

$html_processor = WP_HTML_Processor::create_fragment('<p><span>Hey!</span></p>');
$html_processor->next_tag();
var_dump($html_processor->get_tag());
?>`;
