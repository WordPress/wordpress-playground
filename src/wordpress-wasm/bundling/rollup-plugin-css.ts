import { pathJoin } from '../runnable-code-snippets/fs-utils';
import { normalizeRollupFilename } from './common';
import { createFilter } from './rollup-plugin-utils';
import type { OutputChunk, Plugin } from '@rollup/browser';

type CSSPluginOptions = {
	include?: RegExp | RegExp[] | string | string[];
	exclude?: RegExp | RegExp[] | string | string[];
	alwaysOutput?: boolean;
	minify?: boolean;
	cssUrlPrefix: string;
	output?: string;
};

export default function css(options: CSSPluginOptions): Plugin {
	const styles = {};
	const alwaysOutput = options.alwaysOutput ?? false;
	const filter = createFilter(
		options.include ?? /[^/]+\/*.css$/,
		options.exclude ?? []
	);

	/* function to sort the css imports in order - credit to rollup-plugin-postcss */
	const getRecursiveImportOrder = (id, getModuleInfo, seen = new Set()) => {
		if (seen.has(id)) return [];

		seen.add(id);

		const result = [id];

		getModuleInfo(id).importedIds.forEach((importFile) => {
			result.push(
				...getRecursiveImportOrder(importFile, getModuleInfo, seen)
			);
		});

		return result;
	};

	return {
		name: 'import-css',

		/* convert the css file to a module and save the code for a file output */
		transform(code, id) {
			if (!filter(id)) {
				return;
			}

			const sanitizedId = id.replace(/[^a-zA-Z0-9\-\_]/g, '-');
			const normalizedCssFilename = normalizeRollupFilename(id).replace(
				/\.js$/,
				''
			);
			const removeCssLink = `
				document.querySelector('link[href*="${pathJoin(
					options.cssUrlPrefix,
					normalizedCssFilename
				)}"]')?.remove()
			`;

			let transformedCode = `
			${removeCssLink}
			const existingStyle = document.getElementById('${sanitizedId}');
			if (existingStyle) {
				existingStyle.remove();
			}
			const style = document.createElement('style');
			style.id = '${sanitizedId}';
			style.innerHTML = ${JSON.stringify(code)};
			document.head.appendChild(style);
			`;

			if (options.minify) {
				transformedCode = minifyCSS(transformedCode);
			}

			/* cache the result */
			if (!styles[id] || styles[id] != transformedCode) {
				styles[id] = transformedCode;
			}

			return {
				code: `export default ${JSON.stringify(transformedCode)};`,
				map: { mappings: '' },
			};
		},

		/* output a css file with all css that was imported without being assigned a variable */
		generateBundle(opts, bundle) {
			/* collect all the imported modules for each entry file */
			let modules = {};
			let entryChunk: string | null = null;
			for (const file in bundle) {
				const chunk = bundle[file] as OutputChunk;
				modules = Object.assign(modules, chunk.modules);
				if (!entryChunk) {
					entryChunk = chunk.facadeModuleId;
				}
			}

			/* get the list of modules in order */
			const moduleIds = getRecursiveImportOrder(
				entryChunk,
				this.getModuleInfo
			);

			/* remove css that was imported as a string */
			const css = Object.entries(styles)
				.sort(
					(a, b) => moduleIds.indexOf(a[0]) - moduleIds.indexOf(b[0])
				)
				.map(([id, code]) => {
					if (!modules[id]) return code;
				})
				.join('\n');

			if (css.trim().length <= 0 && !alwaysOutput) return;

			const filename = options.output ?? opts.file ?? 'bundle.js';
			const dest = filename.replace(/\.{1,4}}$/, '');
			this.emitFile({
				type: 'asset',
				fileName: `${dest}.css`,
				source: css,
			});
		},
	};
}

/* minify css */
function minifyCSS(content) {
	content = content.replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, '');
	content = content.replace(/ {2,}/g, ' ');
	content = content.replace(/ ([{:}]) /g, '$1');
	content = content.replace(/([{:}]) /g, '$1');
	content = content.replace(/([;,]) /g, '$1');
	content = content.replace(/ !/g, '!');
	return content;
}
