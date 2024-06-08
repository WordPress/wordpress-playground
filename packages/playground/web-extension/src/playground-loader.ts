import {
	activatePlugin,
	installPlugin,
	login,
} from '@wp-playground/blueprints';
import { bootWordPress } from '@wp-playground/wordpress';
import { PHPRequest, loadPHPRuntime } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import { listenForPhpRequests } from './messaging';

const requestHandler = bootWorker();
prerenderEditor();

async function prerenderEditor() {
	await requestHandler;
	const iframe = document.createElement('iframe');
	iframe.src = 'http://localhost:5400/scope:777777777/wp-admin/post-new.php';
	document.body.appendChild(iframe);

	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve);
	});

	setTimeout(() => {
		document.body.removeChild(iframe);
	}, 10000);
}

listenForPhpRequests(async (request) => {
	const handler = await requestHandler;
	console.log({
		'handling a request': request,
	});
	request.headers = {
		...(request.headers || {}),
		Host: 'playground.internal',
		Origin: 'http://playground.internal',
		Referer: 'http://playground.internal',
	};
	const response = await handler.request(request);
	const newHeaders = {};
	for (const [key, value] of Object.entries(response.headers)) {
		newHeaders[key.toLowerCase() as any] = value.map((v: string) =>
			v.replace('http://playground.internal', chrome.runtime.getURL(''))
		);
	}
	console.log({
		'Got a response': response,
		newHeaders,
	});
	return {
		...response,
		headers: newHeaders,
		bytes: new TextEncoder().encode(
			response.text.replaceAll(
				'http://playground.internal',
				chrome.runtime.getURL('')
			)
		),
	};
});

const putInCache = async (request, response) => {
	const cache = await caches.open('v1');
	await cache.put(request, response);
};

const iframe = document.querySelector(
	'#playground-remote-service-worker'
) as any;

// Super naive caching, let's use actual request caches instead
window.addEventListener('message', async (event) => {
	console.log('Got some message!', event);
	if (event.data.type === 'playground-extension-sw-message') {
		if (event.data.data.method === 'request') {
			const phpRequest = event.data.data.args[0] as PHPRequest;

			const requestUrl = new URL(phpRequest.url);
			requestUrl.searchParams.delete('_ajax_nonce');

			const request = new Request(requestUrl.toString(), {
				method: event.data.data.args[0].method,
				// Do not use headers or body as cache keys. We
				// only need basic matching here.
			});
			const response = await caches.match(request);
			let phpResponse = undefined;
			if (!response) {
				phpResponse = await (
					await requestHandler
				).request(event.data.data.args[0]);
				if (
					requestUrl.searchParams.has('rest_route') ||
					requestUrl.pathname.includes('wp-includes')
				) {
					putInCache(
						request,
						new Response(phpResponse.bytes, {
							headers: phpResponse.headers as any,
							status: phpResponse.httpStatusCode,
						})
					);
				}
			}

			if (response && !phpResponse) {
				const phpResponseHeaders: Record<string, string[]> = {};
				response.headers.forEach((value, key) => {
					phpResponseHeaders[key.toLowerCase()] = [value];
				});

				phpResponse = {
					bytes: await response.arrayBuffer(),
					headers: phpResponseHeaders,
					httpStatusCode: response.status,
				};
			}

			iframe.contentWindow.postMessage(
				responseTo(event.data.requestId, phpResponse),
				'*'
			);
		}
		console.log('Got SW message!', event);
	}
});

async function bootWorker() {
	const iframe = document.querySelector(
		'#playground-remote-service-worker'
	) as any;
	iframe.src = 'http://localhost:5400/extension.html';
	// iframe.src = 'https://playground.wordpress.net';
	setTimeout(() => {
		iframe.contentWindow.addEventListener('message', (event) => {
			console.log({ event });
		});
	}, 3000);

	const [wordPressZip, sqliteIntegrationPluginZip] = await Promise.all([
		readFileFromCurrentExtension('wordpress-6.5.4.zip'),
		readFileFromCurrentExtension('sqlite-database-integration.zip'),
	]);
	const requestHandler = await bootWordPress({
		// WordPress installer needs a `http://` URL.
		// We can't keep using it to run the site later on because it's
		// not a real URL and WordPress will keep redirecting there.
		// Fortunately, we can override it with `chrome.runtime.getURL`
		// right after the installation is completed.
		siteUrl: 'http://localhost:5400/scope:777777777/',
		createPhpRuntime: async () => {
			// @ts-expect-error
			const phpModule = await import('./php_8_0.js');
			return await loadPHPRuntime(phpModule, {
				...fakeWebsocket(),
			});
		},
		wordPressZip,
		sqliteIntegrationPluginZip,
		sapiName: 'cli',
		phpIniEntries: {
			allow_url_fopen: '0',
			disable_functions: '',
		},
	});

	const url = 'http://localhost:5400/scope:777777777/';
	const primaryPHP = await requestHandler.getPrimaryPhp();
	primaryPHP.defineConstant('WP_HOME', url);
	primaryPHP.defineConstant('WP_SITEURL', url);

	primaryPHP.mkdir('/wordpress/wp-content/plugins/playground-editor');
	await installPlugin(primaryPHP, {
		pluginZipFile: new File(
			[await (await fetch('blocky-formats.zip')).blob()],
			'blocky-formats.zip'
		),
		options: {
			activate: false,
		},
	});
	primaryPHP.mv(
		'/wordpress/wp-content/plugins/blocky-formats-trunk',
		'/wordpress/wp-content/plugins/blocky-formats'
	);
	await activatePlugin(primaryPHP, {
		pluginPath: 'blocky-formats/blocky-formats.php',
	});
	await login(primaryPHP, {});

	primaryPHP.writeFile(
		'/wordpress/wp-content/plugins/playground-editor/script.js',
		`
		
		// Accept commands from the parent window
		let lastKnownFormat = '';
		window.addEventListener('message', (event) => {
			if(typeof event.data !== 'object') {
				return;
			}
			
			const { command, format, text } = event.data;
			lastKnownFormat = format;
	
			if(command === 'setEditorContent') {
				populateEditorWithFormattedText(text, format);
			} else if(command === 'getEditorContent') {
				const blocks = wp.data.select('core/block-editor').getBlocks();
				window.opener.postMessage({
					command: 'playgroundEditorTextChanged',
					format: format,
					text: formatConverters[format].fromBlocks(blocks),
					type: 'relay'
				}, '*');
			}
		});
	
	function waitForDOMContentLoaded() {
		return new Promise((resolve) => {
			if (
				document.readyState === 'complete' ||
				document.readyState === 'interactive'
			) {
				resolve();
			} else {
				document.addEventListener('DOMContentLoaded', resolve);
			}
		});
	}

	// @TODO: Figure out why this import is needed – blocky formats should hook this
	//        file on its own. Do I need WP nightly with modules support?
	await import('../blocky-formats/src/blocky-formats.js');
	await import('../blocky-formats/vendor/commonmark.min.js');
	const { markdownToBlocks, blocks2markdown } = await import('../blocky-formats/src/markdown.js');
	const formatConverters = {
		markdown: {
			toBlocks: markdownToBlocks,
			fromBlocks: blocks2markdown
		}
	};

	const createBlocks = blocks => blocks.map(block =>
		wp.blocks.createBlock(block.name, block.attributes, createBlocks(block.innerBlocks))
	);
	function populateEditorWithFormattedText(text, format) {
		console.log(format, {text});
		if(!(format in formatConverters)) {
			throw new Error('Unsupported format');
		}

		const rawBlocks = formatConverters[format].toBlocks(text);
		window.wp.data
			.dispatch('core/block-editor')
			.resetBlocks(createBlocks(rawBlocks))
	}

	function pushEditorContentsToParent(format) {
		const blocks = wp.data.select('core/block-editor').getBlocks();
		window.opener.postMessage({
			command: 'playgroundEditorTextChanged',
			format: format,
			text: formatConverters[format].fromBlocks(blocks),
			type: 'relay'
		}, '*');
	}

	waitForDOMContentLoaded().then(() => {
		// Experiment with sending the updated value back to the parent window
		// when typing. Debounce by 600ms.
		function debounce(func, wait) {
			let timeout;
			return function(...args) {
				const context = this;
				clearTimeout(timeout);
				timeout = setTimeout(() => func.apply(context, args), wait);
			};
		}

		setInterval(() => {
			pushEditorContentsToParent('markdown');
		}, 1000);
	});

    const { subscribe, select, dispatch } = wp.data;
    const { store } = wp.editPost;

    // Store the current post visibility
    let isSavingPost = false;

    subscribe(() => {
        const currentPost = select('core/editor').getCurrentPost();
        const isSaving = select('core/editor').isSavingPost();

        // Detect when the user initiated a save (publish or update)
        if (!isSavingPost && isSaving) {
            const postStatus = currentPost.status;
            const postType = currentPost.type;

            // Check if it is an actual publish or update action
            if (postStatus === 'publish' && postType !== 'auto-draft') {
                onPublish()
            }
        }

        // Update the saving post flag
        isSavingPost = isSaving;
    });

	function onPublish() {
		pushEditorContentsToParent('markdown');
		window.close();
		window.opener.focus();
	}	

	const initialText = decodeURIComponent((new URL(location.href)).hash?.substring(1));
	const initialFormat = 'markdown';
	if(initialText) {
		console.log(initialText, initialFormat);
		populateEditorWithFormattedText(initialText, initialFormat);
	} else {
		const blocks = [{
			name: 'core/paragraph',
			attributes: {
				content: ''
			},
			innerBlocks: []
		}];
		wp.data.dispatch('core/block-editor').resetBlocks(createBlocks(blocks));

        // const firstEditableBlock = document.querySelector('.editor-canvas__iframe').contentDocument.querySelector('.wp-block:not(.wp-block-post-title)');
        // if (firstEditableBlock) {
        //     firstEditableBlock.focus();
		// }
	}
	`
	);

	primaryPHP.writeFile(
		'/wordpress/wp-content/plugins/playground-editor/index.php',
		`<?php
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
                `
	);

	await activatePlugin(primaryPHP, {
		pluginPath: 'playground-editor/index.php',
	});
	return requestHandler;
}

async function readFileFromCurrentExtension(path: string): Promise<File> {
	const response = await fetch(path);
	return new File([await response.blob()], path);
}

/**
 * Fake a websocket connection to prevent errors in the web app
 * from cascading and breaking the Playground.
 */
const fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor: any) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						try {
							super();
						} catch (e) {
							// pass
						}
					}

					send() {
						return null;
					}
				};
			},
		},
	};
};
