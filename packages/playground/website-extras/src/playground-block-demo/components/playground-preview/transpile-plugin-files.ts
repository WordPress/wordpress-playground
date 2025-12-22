/**
 * JSX transpilation for plugin files.
 *
 * Uses esbuild-wasm to transpile JSX files to plain JavaScript,
 * and handles block.json files by creating ES module wrappers.
 */

import * as esbuild from 'esbuild-wasm';
import type { EditorFile } from '../../base64';

let esbuildInitialized = false;

export interface TranspilationFailure {
	file: EditorFile;
	error: Error;
}

export interface TranspilationResult {
	failures: TranspilationFailure[];
	transpiledFiles: EditorFile[];
}

const pluginFilePattern = /^(?:[ \t]*<\?php)?[ \t/*#@]*Plugin Name:(.*)$/im;

/**
 * Transpile plugin files with JSX support.
 *
 * This function:
 * 1. Initializes esbuild-wasm if not already initialized
 * 2. Transpiles .js files with JSX syntax
 * 3. Creates ES module wrappers for block.json files
 * 4. Injects module preloading code into the main plugin PHP file
 */
export async function transpilePluginFiles(
	files: EditorFile[]
): Promise<TranspilationResult> {
	// Initialize esbuild if needed
	if (!esbuildInitialized) {
		await esbuild.initialize({
			wasmURL: 'https://unpkg.com/esbuild-wasm@0.20.1/esbuild.wasm',
		});
		esbuildInitialized = true;
	}

	const failures: TranspilationFailure[] = [];
	const transpiledFiles: EditorFile[] = [];

	// Find block.json files and JavaScript files
	const blockJsonFiles = files.filter((f) => f.name.endsWith('block.json'));
	const jsFiles = files.filter((f) => f.name.endsWith('.js'));
	const otherFiles = files.filter(
		(f) => !f.name.endsWith('block.json') && !f.name.endsWith('.js')
	);

	// Process JavaScript files with JSX transpilation
	for (const file of jsFiles) {
		try {
			const result = await esbuild.transform(file.contents, {
				loader: 'jsx',
				jsx: 'automatic',
				jsxImportSource: 'react',
				format: 'esm',
				target: 'es2020',
			});
			transpiledFiles.push({
				...file,
				contents: result.code,
			});
		} catch (error) {
			failures.push({
				file,
				error:
					error instanceof Error ? error : new Error(String(error)),
			});
		}
	}

	// Create ES module wrappers for block.json files
	for (const file of blockJsonFiles) {
		const moduleName = file.name.replace('.json', '.js');
		const moduleContents = `export default ${file.contents};`;
		transpiledFiles.push({
			name: moduleName,
			contents: moduleContents,
		});
		// Also keep the original JSON file
		transpiledFiles.push(file);
	}

	// Process PHP files - inject module preloading if this is the main plugin file
	for (const file of otherFiles) {
		if (
			file.name.endsWith('.php') &&
			pluginFilePattern.test(file.contents)
		) {
			// This is the main plugin file - inject module preloading
			const moduleFiles = transpiledFiles.filter((f) =>
				f.name.endsWith('.js')
			);
			if (moduleFiles.length > 0) {
				const preloadCode = generatePreloadCode(moduleFiles);
				const modifiedContents = injectPreloadCode(
					file.contents,
					preloadCode
				);
				transpiledFiles.push({
					...file,
					contents: modifiedContents,
				});
			} else {
				transpiledFiles.push(file);
			}
		} else {
			transpiledFiles.push(file);
		}
	}

	return { failures, transpiledFiles };
}

/**
 * Generate PHP code to preload ES modules.
 */
function generatePreloadCode(moduleFiles: EditorFile[]): string {
	const moduleNames = moduleFiles.map((f) => f.name).join("', '");
	return `
// Preload ES modules
add_action('wp_head', function() {
	$plugin_url = plugins_url('', __FILE__);
	$modules = ['${moduleNames}'];
	foreach ($modules as $module) {
		echo '<link rel="modulepreload" href="' . esc_url($plugin_url . '/' . $module) . '">';
	}
}, 1);
`;
}

/**
 * Inject preload code after the plugin header.
 */
function injectPreloadCode(phpContents: string, preloadCode: string): string {
	// Find the end of the plugin header comment
	const headerEndMatch = phpContents.match(/\*\/\s*\n/);
	if (headerEndMatch && headerEndMatch.index !== undefined) {
		const insertPosition = headerEndMatch.index + headerEndMatch[0].length;
		return (
			phpContents.slice(0, insertPosition) +
			'\n' +
			preloadCode +
			'\n' +
			phpContents.slice(insertPosition)
		);
	}
	// If no header found, append at the end of the opening PHP tag
	return phpContents.replace(/<\?php/, '<?php\n' + preloadCode);
}
