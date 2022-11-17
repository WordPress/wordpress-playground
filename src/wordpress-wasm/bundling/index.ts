import * as babel from '@babel/standalone';
import addImportExtension from './babel-plugin-add-import-extension';
import transpileWordPressImports from './babel-plugin-transpile-wordpress-imports';

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
		],
	}).code;
	return { usedWpAssets, contents };
}

export async function bundle(files: MemFile[], entrypoint: string) {
	const filesIndex = files.reduce((acc, file) => {
		acc[file.fileName] = file.contents;
		return acc;
	}, {} as Record<string, string>);

	const prefix = `rollup://localhost/`;
	const relativeEntrypoint = entrypoint.replace(/^\//, '');
	const generator = await rollup.rollup({
		input: `${prefix}${relativeEntrypoint}`,
		plugins: [
			{
				name: 'rollup-in-browser-example',
				resolveId(importee, importer) {
					console.debug('resolveId', { importee, importer });
					return new URL(importee, importer).href;
				},
				load(id) {
					console.log({ id, filesIndex });
					const relativePath = id.substring(prefix.length);
					return filesIndex[relativePath];
				},
			},
			json() as any,
			css() as any,
		],
	});
	const build = await generator.generate({});
	return build.output.map((module) => ({
		fileName: module.fileName,
		contents: (module as any).code || (module as any).source || '',
	}));
}
