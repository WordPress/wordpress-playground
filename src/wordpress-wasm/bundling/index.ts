import * as babel from '@babel/standalone';
import addImportExtension from './babel-plugin-add-import-extension';
import transpileWordPressImports from './babel-plugin-transpile-wordpress-imports';
import reactRefresh from './babel-plugin-react-refresh';
import * as rollup from '@rollup/browser';
import json from './rollup-plugin-json';
import css from './rollup-plugin-css';
import type { MemFile } from '../runnable-code-snippets/fs-utils';
import { extname } from '../runnable-code-snippets/fs-utils';

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

	const allUsedWpAssets = new Set<string>();
	const onWpAssetUsed = (asset: string) => allUsedWpAssets.add(asset);
	const generator = await rollup.rollup({
		input: `${prefix}${relativeEntrypoint}`,
		external: ['react'],
		plugins: [
			json({
				include: /\.json$/,
			}) as any,
			css() as any,
			{
				name: 'babel-plugin',
				transform(code) {
					return babel.transform(code, {
						plugins: [
							[
								babel.availablePlugins['transform-react-jsx'],
								{
									pragma: 'window.wp.element.createElement',
									pragmaFrag: 'Fragment',
								},
							],
							[addImportExtension, { extension: 'js' }],
							transpileWordPressImports(onWpAssetUsed),
							[reactRefresh, { skipEnvCheck: true }],
						],
					}).code;
				},
			},
			{
				name: 'rollup-dependency-loader',
				resolveId(importee, importer) {
					return new URL(importee, importer).href;
				},
				load(id) {
					const relativePath = id.substring(prefix.length);
					if (!(relativePath in filesIndex)) {
						throw new Error(`Could not find file ${relativePath}`);
					}
					return filesIndex[relativePath];
				},
			},
			{
				name: 'react-fast-refresh-wrapper',
				transform(code, id) {
					return `
					let prevRefreshReg = window.$RefreshReg$;
					let prevRefreshSig = window.$RefreshSig$;
					
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

	const rollupChunks = build.output.map((module) => ({
		fileName: module.fileName,
		contents: `(function() { ${
			(module as any).code || (module as any).source || ''
		}; })()`,
	}));
	const rollupChunksNames = new Set(rollupChunks.map((x) => x.fileName));

	return rollupChunks
		.concat([buildIndexAssetPhp(allUsedWpAssets)])
		.concat(
			files.filter(
				(file) =>
					!['.js'].includes(extname(file.fileName)) &&
					!rollupChunksNames.has(file.fileName)
			)
		);
}

function buildIndexAssetPhp(allUsedWpAssets: Set<string>) {
	const assetsAsPHPArray = Array.from(allUsedWpAssets)
		.map((x) => JSON.stringify(x))
		.join(', ');
	return {
		fileName: 'index.asset.php',
		contents: `<?php return array('dependencies' => array(${assetsAsPHPArray}), 'version' => '6b9f26bada2f399976e5');\n`,
	};
}
