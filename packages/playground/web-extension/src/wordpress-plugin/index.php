<?php
/**
* Plugin Name: Playground Editor
* Description: A simple plugin to edit rich text formats in Gutenberg.
*/
// Disable welcome panel every time a user accesses the editor
function disable_gutenberg_welcome_on_load() {
    if (is_admin()) {
        update_user_meta(get_current_user_id(), 'show_welcome_panel', 0);
        remove_action('enqueue_block_editor_assets', 'wp_enqueue_editor_tips');
    }
}
add_action('admin_init', 'disable_gutenberg_welcome_on_load');

function enqueue_script() {
    wp_enqueue_script( 'playground-editor-script', plugin_dir_url( __FILE__ ) . 'script.js', array( 'jquery' ), '1.0', true );
}
add_action( 'admin_init', 'enqueue_script' );

add_action('enqueue_block_editor_assets', 'myplugin_add_inline_editor_styles');

function myplugin_add_inline_editor_styles() {
    $custom_css = "
        .editor-editor-canvas__post-title-wrapper {
            display: none;
        }
        .is-root-container {
            padding-top: 10px;
        }
        /* Make the 'Finish editing' button look like the primary button */
        .components-button[aria-label=\"Finish editing\"] {
            width: auto !important;
            background: var(--wp-components-color-accent, var(--wp-admin-theme-color, #3858e9)) !important;
            color: var(--wp-components-color-accent-inverted, #fff) !important;
            outline: 1px solid #0000 !important;
            text-decoration: none !important;
            text-shadow: none !important;
            white-space: nowrap !important;
        }
        /* Hide the default Publish button */
        .edit-post-header__settings > .is-primary {
            display: none !important;
        }

    ";
    wp_add_inline_style('wp-block-library', $custom_css);
}

// Set script attribute to module
add_filter('script_loader_tag', function($tag, $handle, $src) {
    if ($handle === 'playground-editor-script') {
        $tag = '<script type="module" src="' . esc_url($src) . '">'.'<'.'/script>';
    }
    return $tag;
}, 10, 3);
