import * as React from 'react';
import { useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

import WordPressBrowser from './wordpress-browser';
import wpWorker from './wp-worker-bridge';

function App() {
	const iframeElRef = useRef();
	const runJs = useCallback( ( code ) => {
		return (
			wpWorker
				.ready()
				.then( () => loadPlugin( iframeElRef.current ) )
				.then( () => document.querySelector( 'iframe' ).contentWindow.eval( code ) )
		);
	}, [] );

	return (
		<div className="flex flex-col justify-center w-screen h-screen py-2 px-4">
			<WordPressBrowser
				className="hidden"
				initialUrl="/wp-login.php"
				ref={ iframeElRef } />
		</div>
	);
}

async function loadPlugin( iframe ) {
	console.log( iframe.src );
	if ( iframe.src.endsWith( '/wp-admin/admin.php?page=my-plugin' ) ) {
		return;
	}
	await wpWorker.run( `
	<?php

// Next step: https://developer.wordpress.org/block-editor/how-to-guides/block-tutorial/writing-your-first-block-type/

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

 function my_admin_menu() {
    // Create a new admin page for our app.
    add_menu_page(
        __( 'My Development Plugin', 'gutenberg' ),
        __( 'My Development Plugin', 'gutenberg' ),
        'manage_options',
        'my-plugin',
        function () {
        },
        'dashicons-schedule',
        3
    );
}
 
add_action( 'admin_menu', 'my_admin_menu' );

function load_custom_wp_admin_scripts( $hook ) {
    // Load only on ?page=my-plugin.
    if ( 'toplevel_page_my-plugin' !== $hook ) {
        return;
    }
 
    // Load the required WordPress packages.
 
    // Automatically load imported dependencies and assets version.
    $asset_file = array('dependencies' => array('wp-components', 'wp-core-data', 'wp-data', 'wp-element', 'wp-html-entities', 'wp-notices', 'wp-polyfill'), 'version' => 'e616d860b19e9c45233d4092088232c5');
 
    // Enqueue CSS dependencies.
    foreach ( $asset_file['dependencies'] as $style ) {
        wp_enqueue_style( $style );
    }
 
    // Load our app.js.
    wp_register_script(
        'my-plugin',
        plugins_url( 'build/index.js', __FILE__ ),
        $asset_file['dependencies'],
        $asset_file['version']
    );
    wp_enqueue_script( 'my-plugin' );
 
    // Load our style.css.
    wp_register_style(
        'my-plugin',
        plugins_url( 'style.css', __FILE__ ),
        array(),
        $asset_file['version']
    );
    wp_enqueue_style( 'my-plugin' );
	add_action('admin_head', function() {
		echo '<style>
		#wpadminbar, #adminmenuback, #adminmenuwrap {
			display: none;
		}
		html.wp-toolbar {
			padding: 10px !important;
		}
		body {
			font-size: 16px;
		}
		ul {
			padding-left: 20px;
		}
		ul,
		ul li {
			list-style-type: disc;
		}
		</style>';
	});
}
 
add_action( 'admin_enqueue_scripts', 'load_custom_wp_admin_scripts' );
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

` );

	await wpWorker.request( {
		path: '/wp-login.php',
		method: 'POST',
		_POST: {
			log: 'admin',
			pwd: 'password',
			rememberme: 'forever',
		},
	} );

	iframe.src = window.location.origin + '/wp-admin/admin.php?page=my-plugin';

	await new Promise( ( resolve ) => {
		const interval = setInterval( () => {
			if ( iframe.contentWindow.wp && iframe.contentWindow.wp.data && iframe.contentWindow.wp.data.select( 'core' ) ) {
				clearInterval( interval );
				resolve();
			}
		}, 100 );
	} );
}

createRoot( document.querySelector( '#app' ) ).render(
	<App />,
);
