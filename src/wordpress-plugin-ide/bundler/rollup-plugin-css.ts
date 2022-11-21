import { createFilter } from './rollup-plugin-utils';
import type { Plugin } from '@rollup/browser';

type CSSPluginOptions = {
	include?: RegExp | RegExp[] | string | string[];
	exclude?: RegExp | RegExp[] | string | string[];
	idPrefix: string;
};

export default function css(options: CSSPluginOptions): Plugin {
	const filter = createFilter(
		options.include ?? /[^/]+\/*.css$/,
		options.exclude ?? []
	);

	return {
		name: 'css',
		transform(code, id) {
			if (!filter(id)) {
				return null;
			}

			const minifiedCss = minifyCSS(code + makeUniqueCssRule(id));
			this.emitFile({
				type: 'asset',
				fileName: id.substring(options.idPrefix.length),
				name: 'css',
				source: minifiedCss,
			});
			return {
				code:
					`export const css = ${JSON.stringify(minifiedCss)};` +
					`export const uniqueCssId = ${JSON.stringify(
						makeUniqueCssId(id)
					)}; ` +
					`export const uniqueZIndex = ${JSON.stringify(
						uniqueZIndex
					)}; `,
				map: { mappings: '' },
			};
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

/**
 * An arbitrary, unique number to help identify each
 * module's stylesheet.
 */
const uniqueZIndex = '987432';

// A CSS rule unique for each CSS module.
export function makeUniqueCssRule(moduleId) {
	return ` #${makeUniqueCssId(moduleId)} { z-index: ${uniqueZIndex}; } `;
}

export function makeUniqueCssId(moduleId) {
	return moduleId.replace(/[^a-zA-Z0-9\-\_]/g, '-');
}
