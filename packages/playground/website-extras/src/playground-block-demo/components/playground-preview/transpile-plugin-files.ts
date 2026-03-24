/**
 * JSX transpilation for plugin files.
 *
 * Uses esbuild-wasm to transpile JSX files to plain JavaScript,
 * and handles block.json files by creating ES module wrappers.
 */

import * as esbuild from 'esbuild-wasm';
// @ts-ignore - Vite ?url import
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import type { EditorFile } from '../../base64';
import { phpVar } from '@php-wasm/util';

let esbuildInitialized: any = undefined;

const pluginNameRegex = /^(?:[ \t]*<\?php)?[ \t/*#@]*Plugin Name:(.*)$/im;

export interface TranspilationFailure {
	file: EditorFile;
	error: Error;
}

export const transpilePluginFiles = async (
	files: EditorFile[]
): Promise<{
	transpiledFiles: EditorFile[];
	failures: TranspilationFailure[];
}> => {
	if (esbuildInitialized === undefined) {
		esbuildInitialized = esbuild.initialize({
			worker: true,
			wasmURL: esbuildWasmUrl,
		});
	}

	const transpiled = files.map(async (file) => {
		/**
		 * block.json is often imported, let's emit an importable ES Module.
		 * We can't just use this modern `import` syntax because it's not widely
		 * supported yet:
		 * ```js
		 * import json from "block.json" with "json".
		 * ```
		 */
		if (file.name.match(/(\/|^)block.json$/)) {
			return [
				file,
				{
					name: file.name + '.esmodule.js',
					contents: `export default ${file.contents}`,
				},
			];
		}

		/**
		 * If we're working on a WordPress block plugin, we need to preload
		 * all the ES Modules to prevent a "block isn't registered" warning.
		 * Furthermore, we need to remap the block.json file to JS so that
		 * it can be imported as an ES Module.
		 */
		if (
			file.name.endsWith('.php') &&
			pluginNameRegex.test(file.contents.substring(0, 4096))
		) {
			return [
				{
					...file,
					contents: preloadESMAndImportMapBlockJson(
						file.contents,
						files
					),
				},
			];
		}

		// Transpile .js files
		if (file.name.endsWith('.js')) {
			await esbuildInitialized;
			try {
				const transpiled = await esbuild.transform(file.contents, {
					loader: 'jsx',
					target: 'esnext',
					jsxFactory: 'wp.element.createElement',
					format: 'esm',
				});
				return [
					{
						name: file.name + '.src',
						contents: file.contents,
					},
					{
						name: file.name,
						contents: transpiled.code,
					},
				];
			} catch (e) {
				return [
					{
						file,
						error: e,
					} as TranspilationFailure,
				];
			}
		}

		return [file];
	});

	// Flatten the array
	const results = (await Promise.all(transpiled)).flatMap((x) => x as any);

	const transpiledFiles = results.filter(
		(result: any): result is EditorFile => 'name' in result
	);
	const failures = results.filter(
		(result): result is TranspilationFailure =>
			(result as TranspilationFailure).error !== undefined
	);
	return {
		transpiledFiles,
		failures,
	};
};

function preloadESMAndImportMapBlockJson(
	phpContents: string,
	files: EditorFile[]
) {
	const jsonPaths = files
		.map((file) => file.name)
		.filter((name) => name.endsWith('.json'));
	const jsModulesRelativePaths = files
		.map((file) => file.name)
		.filter((name) => name.endsWith('.js'))
		.concat(jsonPaths.map((name) => name + '.esmodule.js'));

	phpContents = phpContents.trim();
	if (!phpContents.endsWith('?>')) {
		phpContents += '?>';
	}

	return `${phpContents}<?php
	// Preload ES Modules using <link rel="modulepreload" href="" /> to prevent a
	// "block isn't registered" warning in the editor. This ensures the registerBlockType()
	// call is done before the block is rendered.
	function playground_block_add_modulepreload_in_admin() {
		$js_relative_paths = ${phpVar(jsModulesRelativePaths)};
		foreach($js_relative_paths as $relative_path) {
			$file = basename($relative_path);
			$url = json_encode(plugins_url($relative_path, __FILE__));
			$script = <<<SCRIPT
			(function() {
			  const link = document.createElement("link");
			  link.rel = "modulepreload";
			  link.href = $url;
			  document.head.append(link);
			})();
SCRIPT;
			wp_add_inline_script('wp-blocks', $script);
		}
	}
	add_action('enqueue_block_editor_assets', 'playground_block_add_modulepreload_in_admin');
	
	// Remap ESM imports from block.json, that aren't widely supported,
	// to imports from a JavaScript file, that are widely supported.
	function playground_wp_esm_import_map($import_map) {
		$json_paths = ${phpVar(jsonPaths)};
		$json_mapping = array();
		foreach($json_paths as $json_path) {
			$json_path = plugins_url($json_path, __FILE__);
			$js_path = plugins_url($json_path . '.esmodule.js', __FILE__);
			$json_mapping[$json_path] = $js_path;
		}
		return array_merge($import_map, $json_mapping);
	}
	add_filter('wp_esm_import_map', 'playground_wp_esm_import_map');
	`;
}
