/// <reference types="vitest" />
import { defineConfig } from 'vite';
import * as fs from 'fs';
import * as crypto from 'crypto';
import react from '@vitejs/plugin-react';
import externalGlobals from 'rollup-plugin-external-globals';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import type { OutputOptions } from 'rollup';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../vite-ts-config-paths';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
export default defineConfig({
	base: './',
	assetsInclude: ['**/*.wasm', '**/*.data'],
	cacheDir: '../../node_modules/.vite/interactive-code-block',

	css: {
		modules: {
			localsConvention: 'camelCaseOnly',
		},
	},

	plugins: [
		viteTsConfigPaths({
			root: '../../',
		}),

		viteStaticCopy({
			targets: [
				{
					src: path('../../dist/packages/playground/client/index.js'),
					dest: 'assets/',
					rename: () => 'playground-client.js',
				},
				{
					src: new URL('src/lib/block/editor.css', import.meta.url)
						.pathname,
					dest: 'assets/',
				},
				{
					src: new URL('src/lib/block/view.css', import.meta.url)
						.pathname,
					dest: 'assets/',
				},
			],
		}),

		...WordPressVitePlugins({
			manifest: {
				entrypoints: [
					'editor',
					'view',
					'execution-scripts',
					'libraries',
				],
			},
		}),
	],

	// Uncomment this if you are using workers.
	worker: {
		format: 'es',
		plugins: [
			viteTsConfigPaths({
				root: '../../',
			}),
		],
	},

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		assetsInlineLimit: 0,
		minify: true,
		rollupOptions: {
			preserveEntrySignatures: 'strict',
			plugins: [react()],
			input: {
				['comlink']: 'comlink/dist/esm/comlink.mjs',
				['editor']: path('src/lib/block/editor.tsx'),
				['view']: path('src/lib/block/view.ts'),
				['execution-scripts']: path(
					'src/lib/pages/execution-scripts-page.tsx'
				),
				['libraries']: path('src/lib/pages/libraries-page.tsx'),
			},
			output: {
				// Change this to the formats you want to support.
				// Don't forgot to update your package.json as well.
				format: 'es',
				entryFileNames: (entryInfo) => {
					if (entryInfo.name.includes('comlink')) {
						return 'assets/comlink.js';
					}
					return 'assets/[name]-[hash].js';
				},
				chunkFileNames: (assetInfo) => {
					if (assetInfo.name === 'view.ts') {
						return 'assets/view.js';
					}
					return 'assets/[name]-[hash].js';
				},
				assetFileNames: (assetInfo) => {
					if (assetInfo.name === 'block.json') {
						return 'assets/block.json';
					}
					return 'assets/[name]-[hash][extname]';
				},
			},
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../node_modules/.vitest',
		},
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	},
});

interface WordPressVitePluginOptions {
	manifest?: {
		entrypoints?: string[];
	};
}
function WordPressVitePlugins(pluginOptions: WordPressVitePluginOptions): any {
	const wpImports: string[] = [];
	return [
		externalGlobals(
			((id: string) => {
				const globalVar = getGlobalForModule(id);
				if (globalVar) {
					if (id.includes('@wordpress/')) {
						wpImports.push(globalVar);
					}
					return globalVar;
				}
				return;
			}) as any,
			{
				include: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
			}
		),
		{
			name: 'wordpress-dependency-extraction',
			enforce: 'pre',
			generateBundle(
				options: OutputOptions,
				bundle: Record<string, any>
			) {
				const deps = [...new Set(wpImports)]
					// wp.element to wp-element
					.map((dep) => dep.replace('.', '-'))
					// wp-blockEditor to wp-block-editor
					.map((dep) =>
						dep.replace(
							/[A-Z]/g,
							(letter) => `-${letter.toLowerCase()}`
						)
					);

				const files = [];
				let code = '';
				for (const [, value] of Object.entries(bundle)) {
					code += value.code;
					const include =
						!value['name'].endsWith('.wasm') &&
						(!pluginOptions?.manifest?.entrypoints ||
							pluginOptions.manifest.entrypoints?.includes(
								value['name']
							));
					if (include) {
						files.push(
							`${JSON.stringify(
								value['name']
							)} => ${JSON.stringify(value['fileName'])},`
						);
					}
				}
				fs.writeFileSync(
					`${options.dir}/index.asset.php`,
					`<?php return array(
							'version' => ${JSON.stringify(sha256(code).substring(0, 8))},
							'dependencies' => ${JSON.stringify(deps)},
							'files' => array(
								${files.join('\n')}
							)
						);
					`
				);
			},
		},
	];
}

function sha256(buffer: any) {
	const hash = crypto.createHash('sha256');
	hash.update(buffer);
	return hash.digest('hex');
}

function getGlobalForModule(id: string) {
	return {
		react: 'window.wp.element',
		'react-dom': 'window.wp.element',
		lodash: 'window.lodash',
		'lodash-es': 'window.lodash',
		moment: 'window.moment',
		jquery: 'window.jQuery',
		tinymce: 'tinymce',
		backbone: 'Backbone',
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
		// '@wordpress/icons': 'wp.icons',
		'@wordpress/is-shallow-equal': 'wp.isShallowEqual',
		'@wordpress/keyboard-shortcuts': 'wp.keyboardShortcuts',
		'@wordpress/keycodes': 'wp.keycodes',
		'@wordpress/notices': 'wp.notices',
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
	}[id];
}
