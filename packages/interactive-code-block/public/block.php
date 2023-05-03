<?php

add_action('init', function () {
    $asset_file = require plugin_dir_path(__FILE__) . 'index.asset.php';
    foreach ($asset_file['dependencies'] as $dep) {
        if (wp_script_is($dep, 'registered')) {
            $deps[] = $dep;
        }
    }
    // Register block scripts
    $scripts = [
        'interactive-code-block' => $asset_file['files']['view'],
        'interactive-code-block-editor' => $asset_file['files']['editor'],
    ];
    foreach ($scripts as $script => $file) {
        wp_register_script(
            $script,
            plugins_url($file, __FILE__),
            $deps,
            '' // Version is included in the file name
        );
    }

    // Load block scripts as ES modules
    add_filter('script_loader_tag', function ($tag, $handle, $src) use ($scripts) {
        if (!array_key_exists($handle, $scripts)) {
            return $tag;
        }
        
        // Remove any query string from the URL
        $new_url = current(explode('?', $src));
        $tag = '<script type="module" src="' . esc_url($new_url) . '"></script>';
        return $tag;
    }, 10, 3);

    $asset_file = require plugin_dir_path(__FILE__) . 'index.asset.php';
    $deps = [];
    foreach ($asset_file['dependencies'] as $dep) {
        if (wp_style_is($dep, 'registered')) {
            $deps[] = $dep;
        }
    }

    // Register block styles
    $styles = [
        'interactive-code-block' => 'view',
        'interactive-code-block-editor' => 'editor',
    ];
    foreach ($styles as $style => $file) {
        wp_register_style(
            $style,
            plugins_url('assets/' . $file . '.css', __FILE__),
            $deps,
            $asset_file['version']
        );
    }

    // Register the block itself
    register_block_type_from_metadata(__DIR__ . '/assets/block.json', [
        'render_callback' => function ($attributes) {
            if (!isset($attributes['code'])) {
                return '';
            }

            $execution_scripts = get_option(LCS_Execution_Scripts_Endpoint::OPTION_KEY, []);
            $script_id = $attributes['executionScript'];
            $script = $execution_scripts[$script_id] ?? '';

            $all_libraries = lcs_get_libraries_list();
            $library_ids = array_unique(
                array_merge(
                    $attributes['libraries'],
                    $script['libraries'] ?? []
                )
            );
            $libraries = array_values(array_filter($all_libraries, function ($library) use ($library_ids) {
                return in_array($library['id'], $library_ids);
            }));

            // The base64_decode is to prevent incorrect escaping by Gutenberg
            // E.g. representing <h1 title="&lt;div&gt; &quot;html&quot;"> seems
            // to be a problem for Gutenberg – it will store it as
            // &lt;h1 title=&quot;&amp;lt;div&amp;gt; &amp;quot;html&amp;quot;&quot;$gt;
            return '
            <div 
                class="wp-playground-interactive-code-snippet" 
                data-code="' . esc_attr($attributes['code']) . '" 
                data-file-type="' . esc_attr($attributes['fileType']) . '" 
                data-libraries="' . esc_attr(json_encode($libraries)) . '"
                data-execution-script="' . esc_attr(json_encode($script)) . '"
                data-execution-script-id="' . esc_attr(json_encode($script_id)) . '"
                data-cached-output="' . esc_attr($attributes['cachedOutput']) . '"
                data-show-cached-output="' . esc_attr($attributes['showCachedOutput']) . '"
            >
                <b>Loading interactive code snippet...</b>     
            </div>
            ';
        }
        // Render a static code snippet while the interactive one is loading:
        // Useful only for PHP and only if the PHP version >= webhost version.
        // ' . highlight_string(base64_decode($attributes['code']), true) . '
    ]);
});


function lce_editor_init($hook)
{
    global $current_screen;
    if (!$current_screen->is_block_editor()) {
        return;
    }

    lce_preload_endpoints_data();
}
add_action('admin_enqueue_scripts', 'lce_editor_init');