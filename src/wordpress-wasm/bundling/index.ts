import * as babel from '@babel/standalone';
import addImportExtension from './babel-plugin-add-import-extension';
import transpileWordPressImports from './babel-plugin-transpile-wordpress-imports';
import reactRefresh from './babel-plugin-react-refresh';

import * as rollup from '@rollup/browser';
import json from './rollup-plugin-json';
import css from './rollup-plugin-css';
import type { MemFile } from '../runnable-code-snippets/fs-utils';

type WPTranspilationResult = { usedWpAssets: string[]; contents: string };

export function transpileWordPressJsx(rawCode: string): WPTranspilationResult {
	const usedWpAssets: string[] = [];
	const contents = babel.transform(rawCode, {
		plugins: [
			[
				babel.availablePlugins['transform-react-jsx'],
				{
					pragma: 'window.wp.element.createElement',
					pragmaFrag: 'Fragment',
				},
			],
			[addImportExtension, { extension: 'js' }],
			transpileWordPressImports((asset) => usedWpAssets.push(asset)),
			// [babel.availablePlugins['transform-modules-umd'], {}],
			[reactRefresh, { skipEnvCheck: true }],
		],
	}).code;
	return { usedWpAssets, contents };
}

/**
 * Transpiles WordPress JS code to a format that can be run in the browser.
 *
 * For hot reloading, load the `fast-refresh-runtime-hook.js` script before
 * any other script on the page where the transpiled code will run.
 *
 * @param files The files to transpile.
 * @param entrypoint The entrypoint file name.
 * @returns A list of the transpiled chunks.
 */
export async function bundle(
	files: MemFile[],
	entrypoint: string,
	outputOptions = {}
) {
	const filesIndex = files.reduce((acc, file) => {
		acc[file.fileName] = file.contents;
		return acc;
	}, {} as Record<string, string>);

	const prefix = `rollup://localhost/`;
	const relativeEntrypoint = entrypoint.replace(/^\//, '');
	const generator = await rollup.rollup({
		input: `${prefix}${relativeEntrypoint}`,
		external: ['react'],
		plugins: [
			{
				name: 'rollup-dependency-loader',
				resolveId(importee, importer) {
					return new URL(importee, importer).href;
				},
				load(id) {
					const relativePath = id.substring(prefix.length);
					if (relativePath.startsWith('is-react-refresh-boundary')) {
						return require('./is-react-refresh-boundary.txt.js');
					}
					if (!(relativePath in filesIndex)) {
						throw new Error(`Could not find file ${relativePath}`);
					}
					return filesIndex[relativePath];
				},
			},

			json({
				include: /\.json$/,
			}) as any,
			css() as any,
			{
				name: 'react-live-refresh-wrapper',
				transform(code, id) {
					if (
						id.endsWith('is-react-refresh-boundary') ||
						id.endsWith('systemjs')
					) {
						return code;
					}
					return `
					let prevRefreshReg = window.$RefreshReg$;
					let prevRefreshSig = window.$RefreshSig$;
					// import isReactRefreshBoundary from 'is-react-refresh-boundary';
					
					window.$RefreshReg$ = (type, id) => {
						const fullId = ${JSON.stringify(id)} + ' ' + id;
						window.RefreshRuntime.register(type, fullId);
					}
					window.$RefreshSig$ = window.RefreshRuntime.createSignatureFunctionForTransform;
					
					${code}
					
					// if (isReactRefreshBoundary(myExports)) {
					window.__enqueueReactUpdate();
					// }

					window.$RefreshReg$ = prevRefreshReg;
					window.$RefreshSig$ = prevRefreshSig;
					`;
				},
			},
		],
	});
	const build = await generator.generate(
		outputOptions
		// {
		// format: 'cjs',
		// manualChunks(id) {
		// 	return id.replace('/', '-').replace(/[^a-zA-Z0-9\-\._]/g, '__');
		// }
		// }
	);

	console.log(build);
	return build.output.map((module) => ({
		fileName: module.fileName,
		contents: `(function() {
			${(module as any).code || (module as any).source || ''};
		})()`,
	}));
}
