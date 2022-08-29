import * as React from 'react';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

import * as babel from '@babel/standalone';
import importGlobal from 'babel-plugin-import-global';

import Editor from './editor';
import WordPressBrowser from './wordpress-browser';
import { ObjectInspector } from 'react-inspector';
import wpWorker from './wp-worker-bridge';

function App() {
	const [ postEditorReady, setPostEditorReady ] = useState( false );

	const iframeElRef = useRef();
	useEffect( () => {
		loadPostEditor( iframeElRef.current ).then( () => setPostEditorReady( true ) );
	}, [] );

	const runJs = useCallback( ( code ) => {
		return document.querySelector( 'iframe' ).contentWindow.eval( code );
	}, [] );

	return (
		<div className="flex justify-center w-screen h-screen py-2 px-4">
			<div className="min-w-20 max-w-40 w-1/2">
				<p className="my-2">
					To fetch the list of pages, we will use the getEntityRecords selector. In broad strokes, it will
					issue the correct API request, cache the results, and return the list of the records we need. Here’s
					how to use it:
				</p>

				{ postEditorReady && (
					<JSCodeSnippet
						runner={ runJs }
						singleLine
						withInspector
						initialLanguage="javascript"
						initialValue="wp.data.select( 'core' ).getEntityRecords( 'postType', 'page' )"
					/>
				) }

				<p className="my-2">
					Once you run that code, you will see it returns null. Why? The
					pages are only requested by the getEntityRecords resolver after first running the selector. If you wait a
					moment and re-run it, it will return the list of all pages.
				</p>

				<p className="my-2">
					Here's how you can use the getEntityRecords to render a list of pages:
				</p>

				{ postEditorReady && (
					<JSCodeSnippet
						runner={ runJs }
						style={ { height: 550 } }
						initialLanguage="javascript"
						initialValue={ `import { useSelect } from "@wordpress/data";
import { store as coreStore } from "@wordpress/core-data";
import { render } from '@wordpress/element';

function PagesList () {
	const pages = useSelect( function(select) {
		return select( coreStore )
			.getEntityRecords( 'postType', 'page' ) || [];
	} );
	
	return (
		<div>
			<h2>Pages</h2>
			<ul>
				{pages?.map(page => (
					<li key={page.id}>
						{page.title.raw}
					</li>
				))}
			</ul>
		</div>
	)
};

render(
	<PagesList />,
	document.body
);
` }
					/>
				) }

				<WordPressBrowser
					style={ { height: 150 } }
					initialUrl="/wp-login.php"
					ref={ iframeElRef } />
			</div>
		</div>
	);
}

const INITIAL_OUTPUT = {};
function JSCodeSnippet( { runner, withInspector, ...editorProps } ) {
	const [ output, setOutput ] = useState( INITIAL_OUTPUT );
	const editorRef = useRef();
	const handleRun = useCallback( ( ) => {
		try {
			const transpiledCode = transpile( editorRef.current.getValue() );
			console.log( transpiledCode );
			const result = runner( transpiledCode );
			console.log( result );
			setOutput( result );
		} catch ( e ) {
			console.error( e );
			setOutput( e );
		}
	}, [ runner ] );
	return (
		<>
			<Editor
				key="editor"
				ref={ editorRef }
				initialLanguage="javascript"
				onRun={ handleRun }
				className={ `${ editorProps.className ? editorProps.className : '' } border-solid border-1 border-indigo-600 flex-grow-0` }
				{ ...editorProps }
			/>
			<div className="flex justify-end my-2">
				<button
					onClick={ handleRun }
					className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={ 1.5 } stroke="currentColor" className="inline-block mr-1 w-6 h-6">
						<path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
					</svg>
					Run
				</button>
			</div>
			{ withInspector && output !== INITIAL_OUTPUT && (
				<ObjectInspector data={ output } />
			) }
		</>
	);
}

async function loadPostEditor( iframe ) {
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

	iframe.src = '/wp-admin/admin.php?page=my-plugin';

	await new Promise( ( resolve ) => {
		const interval = setInterval( () => {
			if ( iframe.contentWindow.wp ) {
				clearInterval( interval );
				resolve();
			}
		}, 100 );
	} );
}

function transpile( rawCode ) {
	return babel.transform(
		rawCode,
		{
			plugins: [
				[
					babel.availablePlugins[ 'transform-react-jsx' ],
					{
						pragma: 'window.wp.element.createElement',
						pragmaFrag: 'Fragment',
					},
				],
				[
					importGlobal,
					{
						globals: {
							'@wordpress/a11y': 'wp.a11y',
							'@wordpress/api-fetch': 'wp.apiFetch',
							'@wordpress/autop': 'wp.autop',
							'@wordpress/blob': 'wp.blob',
							'@wordpress/block-directory': 'wp.blockDirectory',
							'@wordpress/block-editor': 'wp.blockEditor',
							'@wordpress/block-library': 'wp.blockLibrary',
							'@wordpress/block-serialization-default-parser': 'wp.blockSerializationDefaultParser',
							'@wordpress/blocks': 'wp.blocks',
							'@wordpress/components': 'wp.components',
							'@wordpress/compose': 'wp.compose',
							'@wordpress/core-data': 'wp.coreData',
							'@wordpress/data': 'wp.data',
							'@wordpress/date': 'wp.date',
							'@wordpress/deprecated': 'wp.deprecated',
							'@wordpress/dom': 'wp.dom',
							'@wordpress/dom-ready': 'wp.domReady',
							'@wordpress/edit-navigation': 'wp.editNavigation',
							'@wordpress/edit-post': 'wp.editPost',
							'@wordpress/edit-site': 'wp.editSite',
							'@wordpress/edit-widgets': 'wp.editWidgets',
							'@wordpress/editor': 'wp.editor',
							'@wordpress/element': 'wp.element',
							'@wordpress/escape-html': 'wp.escapeHtml',
							'@wordpress/format-library': 'wp.formatLibrary',
							'@wordpress/hooks': 'wp.hooks',
							'@wordpress/html-entities': 'wp.htmlEntities',
							'@wordpress/i18n': 'wp.i18n',
							'@wordpress/is-shallow-equal': 'wp.isShallowEqual',
							'@wordpress/keyboard-shortcuts': 'wp.keyboardShortcuts',
							'@wordpress/keycodes': 'wp.keycodes',
							'@wordpress/nux': 'wp.nux',
							'@wordpress/plugins': 'wp.plugins',
							'@wordpress/preferences': 'wp.preferences',
							'@wordpress/preferences-persistence': 'wp.preferencesPersistence',
							'@wordpress/primitives': 'wp.primitives',
							'@wordpress/reusable-blocks': 'wp.reusableBlocks',
							'@wordpress/rich-text': 'wp.richText',
							'@wordpress/shortcode': 'wp.shortcode',
							'@wordpress/url': 'wp.url',
							'@wordpress/viewport': 'wp.viewport',
							'@wordpress/warning': 'wp.warning',
							'@wordpress/widgets': 'wp.widgets',
							'@wordpress/wordcount': 'wp.wordcount',
						},
					},
				],
			],
		},
	).code;
}
window.transpile = transpile;

createRoot( document.querySelector( '#app' ) ).render(
	<App />,
);
