import { bootWordPress } from './index';
import { login, installPlugin } from './macros';
import {
	cloneResponseMonitorProgress,
	responseTo,
} from '../php-wasm-browser/index';
import React from 'react';
import { render } from 'react-dom';
import CodeEditorApp from './runnable-code-snippets/CodeEditorApp';

const query = new URL(document.location.href).searchParams;

const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;

function setupAddressBar(wasmWorker) {
	// Manage the address bar
	const addressBar = document.querySelector(
		'#address-bar'
	)! as HTMLInputElement;
	wpFrame.addEventListener('load', (e: any) => {
		addressBar.value = wasmWorker.internalUrlToPath(
			e.currentTarget!.contentWindow.location.href
		);
	});

	document
		.querySelector('#address-bar-form')!
		.addEventListener('submit', (e) => {
			e.preventDefault();
			let requestedPath = addressBar.value;
			// Ensure a trailing slash when requesting directory paths
			const isDirectory = !requestedPath.split('/').pop()!.includes('.');
			if (isDirectory && !requestedPath.endsWith('/')) {
				requestedPath += '/';
			}
			wpFrame.src = wasmWorker.pathToInternalUrl(requestedPath);
		});
}

class FetchProgressBar {
	expectedRequests;
	progress;
	min;
	max;
	el;
	constructor({ expectedRequests, min = 0, max = 100 }) {
		this.expectedRequests = expectedRequests;
		this.progress = {};
		this.min = min;
		this.max = max;
		this.el = document.querySelector('.progress-bar.is-finite');

		// Hide the progress bar when the page is first loaded.
		const hideProgressBar = () => {
			document
				.querySelector('body.is-loading')!
				.classList.remove('is-loading');
			wpFrame.removeEventListener('load', hideProgressBar);
		};
		wpFrame.addEventListener('load', hideProgressBar);
	}

	onDataChunk = ({ file, loaded, total }) => {
		if (Object.keys(this.progress).length === 0) {
			this.setFinite();
		}

		this.progress[file] = loaded / total;
		const progressSum = Object.entries(this.progress).reduce(
			(acc, [_, percentFinished]) => acc + (percentFinished as number),
			0
		);
		const totalProgress = Math.min(1, progressSum / this.expectedRequests);
		const scaledProgressPercentage =
			this.min + (this.max - this.min) * totalProgress;

		this.setProgress(scaledProgressPercentage);
	};

	setProgress(percent) {
		this.el.style.width = `${percent}%`;
	}

	setFinite() {
		const classList = document.querySelector(
			'.progress-bar-wrapper.mode-infinite'
		)!.classList;
		classList.remove('mode-infinite');
		classList.add('mode-finite');
	}
}

async function main() {
	const preinstallPlugin = query.get('plugin');
	let progressBar;
	let pluginResponse;
	if (preinstallPlugin) {
		pluginResponse = await fetch(
			'/plugin-proxy?plugin=' + preinstallPlugin
		);
		progressBar = new FetchProgressBar({
			expectedRequests: 3,
			max: 80,
		});
	} else {
		progressBar = new FetchProgressBar({ expectedRequests: 2 });
	}

	const workerThread = await bootWordPress({
		onWasmDownloadProgress: progressBar.onDataChunk,
	});
	const appMode = query.get('mode') === 'seamless' ? 'seamless' : 'browser';
	if (appMode === 'browser') {
		setupAddressBar(workerThread);
	}

	if (preinstallPlugin) {
		// Download the plugin file
		const progressPluginResponse = cloneResponseMonitorProgress(
			pluginResponse,
			(progress) =>
				progressBar.onDataChunk({ file: preinstallPlugin, ...progress })
		);
		const blob = await progressPluginResponse.blob();
		const pluginFile = new File([blob], preinstallPlugin);

		// We can't tell how long the operations below
		// will take. Let's slow down the CSS width transition
		// to at least give some impression of progress.
		progressBar.el.classList.add('indeterminate');
		// We're at 80 already, but it's a nice reminder.
		progressBar.setProgress(80);

		progressBar.setProgress(85);
		await login(workerThread, 'admin', 'password');

		progressBar.setProgress(100);
		await installPlugin(workerThread, pluginFile);
	} else if (query.get('login')) {
		await login(workerThread, 'admin', 'password');
	}

	if (query.get('rpc')) {
		console.log('Registering an RPC handler');
		async function handleMessage(event) {
			if (event.data.type === 'rpc') {
				return await workerThread[event.data.method](
					...event.data.args
				);
			} else if (event.data.type === 'go_to') {
				wpFrame.src = workerThread.pathToInternalUrl(event.data.path);
			} else if (event.data.type === 'is_alive') {
				return true;
			}
		}
		window.addEventListener('message', async (event) => {
			const result = await handleMessage(event.data);

			// When `requestId` is present, the other thread expects a response:
			if (event.data.requestId) {
				const response = responseTo(event.data.requestId, result);
				window.parent.postMessage(response, '*');
			}
		});
	}

	await scaffoldCreateBlockTutorial(workerThread);

	render(
		<CodeEditorApp
			workerThread={workerThread}
			root={srcPath}
			initialFile={`${srcPath}/edit.js`}
			onSaveFile={() => buildSourceFiles(workerThread)}
		/>,
		document.getElementById('test-snippets')!
	);

	const initialUrl = query.get('url') || '/';
	wpFrame.src = workerThread.pathToInternalUrl(initialUrl);
}
main();

async function scaffoldCreateBlockTutorial(workerThread) {
	await createSourceFiles(workerThread);
	await buildSourceFiles(workerThread);
}

const muPluginsPath = `/wordpress/wp-content/mu-plugins`;
const myBlockPath = `${muPluginsPath}/my-block`;
const buildPath = `${myBlockPath}/build`;
const srcPath = `${myBlockPath}/src`;

async function createSourceFiles(workerThread) {
	await workerThread.mkdirTree(srcPath);
	await workerThread.mkdirTree(buildPath);
	await workerThread.writeFile(
		`${muPluginsPath}/my-block.php`,
		`<?php
		require_once "${buildPath}/index.php";
	`
	);
	await workerThread.writeFile(
		`${srcPath}/index.php`,
		`<?php
/**
 * Plugin Name:       Example Static
 * Description:       Example block scaffolded with Create Block tool.
 * Requires at least: 5.9
 * Requires PHP:      7.0
 * Version:           0.1.0
 * Author:            The WordPress Contributors
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       example-static
 *
 * @package           create-block
 */


/**
 * Registers the block using the metadata loaded from the \`block.json\` file.
 * Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://developer.wordpress.org/reference/functions/register_block_type/
 */
function create_block_example_static_block_init() {
	register_block_type( __DIR__ . '/block.json' );
}
add_action( 'init', 'create_block_example_static_block_init' );
	`
	);

	await workerThread.writeFile(
		`${srcPath}/block.json`,
		JSON.stringify(
			{
				$schema: 'https://schemas.wp.org/trunk/block.json',
				apiVersion: 2,
				name: 'create-block/example-static',
				version: '0.1.0',
				title: 'Example Static',
				category: 'widgets',
				icon: 'smiley',
				description: 'Example block scaffolded with Create Block tool.',
				supports: {
					html: false,
				},
				textdomain: 'example-static',
				editorScript: 'file:./index.js',
				style: 'file:./style.css',
			},
			null,
			2
		)
	);
	await workerThread.writeFile(
		`${srcPath}/edit.js`,
		`/**
* Retrieves the translation of text.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
*/
import { __ } from '@wordpress/i18n';

/**
* React hook that is used to mark the block wrapper element.
* It provides all the necessary props like the class name.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
*/
import { useBlockProps } from '@wordpress/block-editor';

/**
* The edit function describes the structure of your block in the context of the
* editor. This represents what the editor will render when the block is used.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
*
* @return {WPElement} Element to render.
*/
export default function Edit() {
	return (
		<p { ...useBlockProps() }>
			{ __(
				'Example Static – hello from the editor!',
				'example-static'
			) }
		</p>
	);
}`
	);

	await workerThread.writeFile(
		`${srcPath}/save.js`,
		`/**
* React hook that is used to mark the block wrapper element.
* It provides all the necessary props like the class name.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
*/
import { useBlockProps } from '@wordpress/block-editor';

/**
* The save function defines the way in which the different attributes should
* be combined into the final markup, which is then serialized by the block
* editor into \`post_content\`.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#save
*
* @return {WPElement} Element to render.
*/
export default function save() {
	return (
		<p { ...useBlockProps.save() }>
			{ 'Example Static – hello from the saved content!' }
		</p>
	);
}
`
	);

	await workerThread.writeFile(
		`${srcPath}/style.css`,
		`/**
* The following styles get applied both on the front of your site
* and in the editor.
*
* Replace them with your own styles or remove the file completely.
*/

.wp-block-create-block-example-static {
	background-color: #21759b;
	color: #fff;
	padding: 2px;
}
`
	);

	await workerThread.writeFile(
		`${srcPath}/index.js`,
		`/**
* Registers a new block provided a unique name and an object defining its behavior.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
*/
import { registerBlockType } from '@wordpress/blocks';

/**
* Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
* All files containing \`style\` keyword are bundled together. The code used
* gets applied both to the front of your site and to the editor.
*
* @see https://www.npmjs.com/package/@wordpress/scripts#using-css
*/
import './style.css';

/**
* Internal dependencies
*/
import Edit from './edit';
import save from './save';
import metadata from './block.json';

/**
* Every block starts by registering a new block type definition.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
*/
registerBlockType( metadata.name, {
	/**
	* @see ./edit.js
	*/
	edit: Edit,

	/**
	* @see ./save.js
	*/
	save,
} );`
	);
}

import json from './bundling/rollup-plugin-json';
import css from './bundling/rollup-plugin-css';

async function buildSourceFiles(workerThread) {
	for (const fileName of await workerThread.listFiles(buildPath)) {
		workerThread.unlink(`${buildPath}/${fileName}`);
	}
	const allUsedWpAssets = new Set();
	const files = {};
	for (let fileName of await workerThread.listFiles(srcPath)) {
		let ext = fileName.split('.').pop();
		let builtContents = await workerThread.readFile(
			`${srcPath}/${fileName}`
		);
		if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
			const { usedWpAssets, code } = await transpile(builtContents);
			usedWpAssets.forEach((asset) => allUsedWpAssets.add(asset));
			fileName = fileName.substr(0, fileName.lastIndexOf('.')) + '.js';
			builtContents = code;
		} else {
			await workerThread.writeFile(
				`${buildPath}/${fileName}`,
				builtContents
			);
		}
		files[fileName] = builtContents;
	}

	console.log('allUsedWpAssets', allUsedWpAssets);

	const assetsPHP = Array.from(allUsedWpAssets)
		.map((name) => JSON.stringify(name))
		.join(', ');
	console.log(`<?php return array('dependencies' => array(${assetsPHP}), 'version' => '6b9f26bada2f399976e5');
	`);
	await workerThread.writeFile(
		`${buildPath}/index.asset.php`,
		`<?php return array('dependencies' => array(${assetsPHP}), 'version' => '6b9f26bada2f399976e5');
		`
	);

	const generator = await rollup.rollup({
		input: 'rollup://localhost/index.js',
		plugins: [
			{
				name: 'rollup-in-browser-example',
				resolveId(importee, importer) {
					console.debug('resolveId', { importee, importer });
					return new URL(importee, importer).href;
				},
				load(id) {
					const prefix = 'rollup://localhost/';
					const relativePath = id.substring(prefix.length);
					return files[relativePath];
				},
			},
			json() as any,
			css() as any,
		],
	});
	const build = await generator.generate({});
	for (const module of build.output) {
		await workerThread.writeFile(
			`${buildPath}/${module.fileName}`,
			(module as any).code || (module as any).source || ''
		);
	}
}

import * as babel from '@babel/standalone';
import * as rollup from '@rollup/browser';
import importGlobal from 'babel-plugin-import-global';
import addImportExtension from './babel-plugin-add-import-extension';

function transpile(rawCode) {
	const usedWpAssets: string[] = [];
	const code = babel.transform(rawCode, {
		plugins: [
			[
				babel.availablePlugins['transform-react-jsx'],
				{
					pragma: 'window.wp.element.createElement',
					pragmaFrag: 'Fragment',
				},
			],
			[addImportExtension, { extension: 'js' }],
			[
				importGlobal,
				{
					globals: (src) => {
						const map = {
							'@wordpress/a11y': 'wp.a11y',
							'@wordpress/api-fetch': 'wp.apiFetch',
							'@wordpress/autop': 'wp.autop',
							'@wordpress/blob': 'wp.blob',
							'@wordpress/block-directory': 'wp.blockDirectory',
							'@wordpress/block-editor': 'wp.blockEditor',
							'@wordpress/block-library': 'wp.blockLibrary',
							'@wordpress/block-serialization-default-parser':
								'wp.blockSerializationDefaultParser',
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
							'@wordpress/keyboard-shortcuts':
								'wp.keyboardShortcuts',
							'@wordpress/keycodes': 'wp.keycodes',
							'@wordpress/nux': 'wp.nux',
							'@wordpress/plugins': 'wp.plugins',
							'@wordpress/preferences': 'wp.preferences',
							'@wordpress/preferences-persistence':
								'wp.preferencesPersistence',
							'@wordpress/primitives': 'wp.primitives',
							'@wordpress/reusable-blocks': 'wp.reusableBlocks',
							'@wordpress/rich-text': 'wp.richText',
							'@wordpress/shortcode': 'wp.shortcode',
							'@wordpress/url': 'wp.url',
							'@wordpress/viewport': 'wp.viewport',
							'@wordpress/warning': 'wp.warning',
							'@wordpress/widgets': 'wp.widgets',
							'@wordpress/wordcount': 'wp.wordcount',
						};
						usedWpAssets.push(
							src
								.replace('@', '')
								.replace('/', '-')
								.replace('wordpress-', 'wp-')
						);
						return map[src];
					},
				},
			],
		],
	}).code;
	return { usedWpAssets, code };
}
