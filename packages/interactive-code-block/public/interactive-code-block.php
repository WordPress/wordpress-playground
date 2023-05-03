<?php
/**
 * Plugin Name: Interactive Code Block
 * Plugin URI: https://developer.wordpress.org/playground
 * Description: An interactive code block you can edit and run in your browser.
 * Version: 0.0.3
 * Author: Adam Zielinski
 * Author URI: https://adamadam.blog
 * Requires at least: 5.9
 * Requires PHP: 5.6
 *
 * @package WordPressPlayground
 */

add_action('init', function () {
    $asset_file = require plugin_dir_path(__FILE__) . 'index.asset.php';
    $scripts = [
        'interactive-code-block-execution-scripts-page' => $asset_file['files']['execution-scripts'],
        'interactive-code-block-libraries-page' => $asset_file['files']['libraries'],
    ];
    foreach ($asset_file['dependencies'] as $dep) {
        if (wp_script_is($dep, 'registered')) {
            $deps[] = $dep;
        }
    }
    foreach ($scripts as $script => $file) {
        wp_register_script(
            $script,
            plugins_url($file, __FILE__),
            $deps,
            $asset_file['version']
        );
    }

    // Load scripts as ES modules
    add_filter('script_loader_tag', function($tag, $handle, $src) use ($scripts) {
        if(!array_key_exists($handle, $scripts)) {
            return $tag;
        }
        $tag = '<script type="module" src="' . esc_url($src) . '"></script>';
        return $tag;
    }, 10, 3);

    require_once __DIR__ . '/rest-api-lcs-libraries-endpoint.php';
    $lcs_libraries_endpoint = new LCS_Libraries_Endpoint();
    add_action('rest_api_init', array($lcs_libraries_endpoint, 'register_routes'));

    require_once __DIR__ . '/rest-api-lcs-execution-scripts-endpoint.php';
    $lcs_execution_scripts = new LCS_Execution_Scripts_Endpoint();
    add_action('rest_api_init', array($lcs_execution_scripts, 'register_routes'));
});

function lce_setup_admin_menu()
{
    // Add a top-level menu item that has two nested items named differently than the top-level menu 
    add_menu_page('Interactive Code Block', 'Interactive Code Block', 'manage_options', 'interactive-code-block--execution-scripts', 'lce_execution_scripts_page', 'dashicons-editor-code', 6);
    add_submenu_page('interactive-code-block--execution-scripts', 'Execution Scripts', 'Execution Scripts', 'manage_options', 'interactive-code-block--execution-scripts', 'lce_execution_scripts_page');
    add_submenu_page('interactive-code-block--execution-scripts', 'Libraries', 'Libraries', 'manage_options', 'interactive-code-block--libraries', 'lce_libraries_page');
}

function lce_execution_scripts_page()
{
    echo '
        <h2>Execution Scripts</h2>
        <div id="execution-scripts"></div>
    ';
}

function lce_libraries_page()
{
    echo '
        <h2>Phar libraries</h2>
        <div id="libraries"></div>
    ';
}

add_action('admin_menu', 'lce_setup_admin_menu');

function load_custom_wp_admin_scripts($hook)
{
    if ('interactive-code-block_page_interactive-code-block--libraries' === $hook) {
        wp_enqueue_script('interactive-code-block-libraries-page');
        wp_enqueue_style('interactive-code-block-editor');
        lce_preload_endpoints_data();
    } else if ('toplevel_page_interactive-code-block--execution-scripts' === $hook) {
        wp_enqueue_script('interactive-code-block-execution-scripts-page');
        wp_enqueue_style('interactive-code-block-editor');
        lce_preload_endpoints_data();
    }
}

add_action('admin_enqueue_scripts', 'load_custom_wp_admin_scripts');

function lce_preload_endpoints_data()
{
    // Preload block editor paths.
    // most of these are copied from edit-forms-blocks.php.
    $preload_paths = array(
        '/interactive-code-block/v1/libraries?context=edit',
        '/interactive-code-block/v1/execution-scripts?context=edit',
    );
    $preload_data = array_reduce(
        $preload_paths,
        'rest_preload_api_request',
        array()
    );
    wp_add_inline_script(
        'wp-api-fetch',
        sprintf('wp.apiFetch.use( wp.apiFetch.createPreloadingMiddleware( %s ) );', wp_json_encode($preload_data)),
        'after'
    );
}


require_once __DIR__ . '/block.php';
