// import { logger } from '@php-wasm/logger';
// import {
// 	Blueprint,
// 	compileBlueprint,
// 	runBlueprintSteps,
// } from '@wp-playground/blueprints';
// import { ProgressTracker } from '@php-wasm/progress';
// import { loadWebRuntime } from '@php-wasm/web';
// import { bootWordPress } from '@wp-playground/wordpress';

// logger.log('Starting a PHP worker...');

import('./php_8_0.js');

// bootWorker();

// async function bootWorker() {
// 	const [wordPressZip, sqliteIntegrationPluginZip] = await Promise.all([
// 		readFileFromCurrentExtension('wordpress.zip'),
// 		readFileFromCurrentExtension('sqlite-database-integration.zip'),
// 	])
// 	const requestHandler = await bootWordPress({
// 		siteUrl: chrome.runtime.getURL(''),
// 		createPhpRuntime: async () =>
// 			await loadWebRuntime("8.0", {
// 				emscriptenOptions: {
// 					instantiateWasm(imports, receiveInstance) {

// 					}
// 				}
// 			}),
// 		wordPressZip,
// 		sqliteIntegrationPluginZip,
// 		sapiName: 'cli',
// 		phpIniEntries: {
// 			allow_url_fopen: '1',
// 			disable_functions: '',
// 		},
// 	});

// 	const compiledBlueprint = compileInitialBlueprint();
// 	const { php, reap } =
// 		await requestHandler.processManager.acquirePHPInstance();
// 	try {
// 		logger.log(`Running the Blueprint...`);
// 		await runBlueprintSteps(compiledBlueprint, php);
// 		logger.log(`Finished running the blueprint`);
// 	} finally {
// 		reap();
// 	}
// }

// function readFileFromCurrentExtension(path: string): Promise<File> {
// 	return new Promise((resolve, reject) => {
// 		chrome.runtime.getPackageDirectoryEntry(function (root) {
// 			root.getFile(path, {}, function (fileEntry) {
// 				fileEntry.file(function (file) {
// 					const reader = new FileReader();
// 					reader.onloadend = function () {
// 						const arrayBuffer = this.result;
// 						if (!arrayBuffer) {
// 							reject(new Error("Could not read file"));
// 						}
// 						resolve(new File([arrayBuffer!], path));
// 					};
// 					reader.readAsText(file);
// 				}, reject);
// 			}, reject);
// 		});
// 	});
// }

// function compileInitialBlueprint() {
// 	const blueprint = makePlaygroundBlueprint();

// 	const tracker = new ProgressTracker();
// 	let lastCaption = '';
// 	let progress100 = false;
// 	tracker.addEventListener('progress', (e: any) => {
// 		if (progress100) {
// 			return;
// 		} else if (e.detail.progress === 100) {
// 			progress100 = true;
// 		}
// 		lastCaption =
// 			e.detail.caption || lastCaption || 'Running the Blueprint';
// 		process.stdout.write(
// 			'\r\x1b[K' + `${lastCaption.trim()} – ${e.detail.progress}%`
// 		);
// 		if (progress100) {
// 			process.stdout.write('\n');
// 		}
// 	});
// 	return compileBlueprint(blueprint as Blueprint, {
// 		progress: tracker,
// 	});
// }

// function makePlaygroundBlueprint(): Blueprint {
// 	return {
// 		login: true,
// 		landingPage: '/wp-admin/post-new.php?post_type=post',
// 		preferredVersions: {
// 			wp: 'nightly',
// 			php: '8.0',
// 		},
// 		steps: [
// 			{
// 				step: 'mkdir',
// 				path: '/wordpress/wp-content/plugins/playground-editor',
// 			},
// 			{
// 				step: 'installPlugin',
// 				pluginZipFile: {
// 					resource: 'url',
// 					url: 'https://github-proxy.com/proxy/?repo=dmsnell/blocky-formats',
// 				},
// 				options: {
// 					activate: false,
// 				},
// 			},
// 			{
// 				step: 'mv',
// 				fromPath: '/wordpress/wp-content/plugins/blocky-formats-trunk',
// 				toPath: '/wordpress/wp-content/plugins/blocky-formats',
// 			},
// 			{
// 				step: 'activatePlugin',
// 				pluginPath: 'blocky-formats/blocky-formats.php',
// 			},
// 			{
// 				step: 'writeFile',
// 				path: '/wordpress/wp-content/plugins/playground-editor/script.js',
// 				data: `

// 				function waitForDOMContentLoaded() {
// 					return new Promise((resolve) => {
// 						if (
// 							document.readyState === 'complete' ||
// 							document.readyState === 'interactive'
// 						) {
// 							resolve();
// 						} else {
// 							document.addEventListener('DOMContentLoaded', resolve);
// 						}
// 					});
// 				}

// 				await import('../blocky-formats/vendor/commonmark.min.js');
// 				const { markdownToBlocks, blocks2markdown } = await import('../blocky-formats/src/markdown.js');
//                 const formatConverters = {
//                     markdown: {
//                         toBlocks: markdownToBlocks,
//                         fromBlocks: blocks2markdown
//                     }
//                 };

//                 function populateEditorWithFormattedText(text, format) {
//                     if(!(format in formatConverters)) {
//                         throw new Error('Unsupported format');
//                     }

// 					const createBlocks = blocks => blocks.map(block => wp.blocks.createBlock(block.name, block.attributes, createBlocks(block.innerBlocks)));
//                     const rawBlocks = formatConverters[format].toBlocks(text);

//                     window.wp.data
//                         .dispatch('core/block-editor')
//                         .resetBlocks(createBlocks(rawBlocks))
//                 }

//                 function pushEditorContentsToParent(format) {
//                     const blocks = wp.data.select('core/block-editor').getBlocks();
// 					window.parent.postMessage({
// 						command: 'playgroundEditorTextChanged',
// 						format: format,
// 						text: formatConverters[format].fromBlocks(blocks),
// 						type: 'relay'
// 					}, '*');
//                 }

//                 // Accept commands from the parent window
//                 let lastKnownFormat = '';
//                 window.addEventListener('message', (event) => {
//                     if(typeof event.data !== 'object') {
//                         return;
//                     }

//                     const { command, format, text } = event.data;
//                     lastKnownFormat = format;

//                     if(command === 'setEditorContent') {
//                         populateEditorWithFormattedText(text, format);
//                     } else if(command === 'getEditorContent') {
//                         const blocks = wp.data.select('core/block-editor').getBlocks();
//                         window.parent.postMessage({
//                             command: 'playgroundEditorTextChanged',
//                             format: format,
//                             text: formatConverters[format].fromBlocks(blocks),
//                             type: 'relay'
//                         }, '*');
//                     }
//                 });

//                 waitForDOMContentLoaded().then(() => {
//                     // Experiment with sending the updated value back to the parent window
//                     // when typing. Debounce by 600ms.
//                     function debounce(func, wait) {
//                         let timeout;
//                         return function(...args) {
//                             const context = this;
//                             clearTimeout(timeout);
//                             timeout = setTimeout(() => func.apply(context, args), wait);
//                         };
//                     }
//                 });
//                 `,
// 			},
// 			{
// 				step: 'writeFile',
// 				path: '/wordpress/wp-content/plugins/playground-editor/index.php',
// 				data: `<?php
//     /**
//     * Plugin Name: Playground Editor
//     * Description: A simple plugin to edit rich text formats in Gutenberg.
//     */
//     // Disable welcome panel every time a user accesses the editor
//     function disable_gutenberg_welcome_on_load() {
//     if (is_admin()) {
//     update_user_meta(get_current_user_id(), 'show_welcome_panel', 0);
//     remove_action('enqueue_block_editor_assets', 'wp_enqueue_editor_tips');
//     }
//     }
//     add_action('admin_init', 'disable_gutenberg_welcome_on_load');

//     function enqueue_script() {
//     	wp_enqueue_script( 'playground-editor-script', plugin_dir_url( __FILE__ ) . 'script.js', array( 'jquery' ), '1.0', true );
//     }
//     add_action( 'admin_init', 'enqueue_script' );

//     // Set script attribute to module
//     add_filter('script_loader_tag', function($tag, $handle, $src) {
//     if ($handle === 'playground-editor-script') {
// 		$tag = '<script type="module" src="' . esc_url($src) . '">'.'<'.'/script>';
//     }
//     return $tag;
//     }, 10, 3);
//                 `,
// 			},
// 			{
// 				step: 'activatePlugin',
// 				pluginPath: 'playground-editor/index.php',
// 			},
// 		],
// 	};
// }
