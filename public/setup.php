<?php


function createFileTree($tree, $prefix = '')
{
    foreach ($tree as $key => $value) {
        $path = $prefix . $key;
        echo $path . "\n";
        if (is_array($value)) {
            // Directory
            if (!is_dir($path)) {
                mkdir($path);
            }
            createFileTree($value, rtrim($path, '/') . '/');
        } else {
            // File
            file_put_contents($path, $value);
        }
    }
}

createFileTree([
    "/preload/wordpress/wp-content/plugins/my-plugin" => [
        "style.css" => "",
        "my-plugin.php" => <<<'PLUGIN'
<?php
/**
 * Plugin Name: My plugin
 *
 */

add_action('init', function() {
    if ( array_key_exists( "rest_route", $_GET ) && $_GET['rest_route'] === '/wp/v2/block-patterns/categories' ) {
        // die(var_dump(current_user_can( 'edit_posts' )));
    }
});
PLUGIN
    ]
]);

// print_r(glob("/preload/wordpress/wp-content/plugins/*"));
// print_r(glob("/preload/wordpress/wp-content/plugins/my-plugin/*"));
// echo file_get_contents("/preload/wordpress/wp-content/plugins/my_plugin/index.php");

$file_php_path = '/preload/wordpress/wp-includes/functions.php';
$file_php = file_get_contents($file_php_path);

if ($file_php) {
    if (strpos($file_php, "start-test-snippet") !== false) {
        $file_php = substr($file_php, 0, strpos($file_php, "start-test-snippet"));
    }

    $file_php .= <<<'ADMIN'
        // start-test-snippet
        add_action('init', function() {
            require_once WP_HOME . '/wp-admin/includes/plugin.php';
            $plugin = 'my-plugin/my-plugin.php';
            if(!is_plugin_active($plugin)) {
                $result = activate_plugin( $plugin, '', is_network_admin() );
                if ( is_wp_error( $result ) ) {
                    if ( 'unexpected_output' === $result->get_error_code() ) {
                        var_dump($result->get_error_data());
                        die();
                    } else {
                        wp_die( $result );
                    }
                }
            }
        });
        // end-test-snippet
ADMIN;

    file_put_contents(
        $file_php_path,
        $file_php
    );
}

echo "done!";
