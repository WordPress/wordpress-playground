import type { Plugin } from 'vite';

export interface IgnoreImportsOptions {
	extensions: string[];
}

export function viteIgnoreImports(options: IgnoreImportsOptions): Plugin {
	return {
		/**
		 * Due to the way vite works, specific extension files are resolved by
		 * rollup even in modules that do not import them directly.
		 * For example, importing `@wp-playground/client` that has a dependency
		 * on `@php-wasm/web` will lead to the following error:
		 *
		 *	Could not load /{filename}.{extension}
		 *
		 * This plugin turns specified extension files into noop imports to fix
		 * the bundling of dependent packages.
		 */
		name: 'vite-ignore-imports',

		load(id) {
			if (options.extensions.some((ext) => id.endsWith(`.${ext}`))) {
				return {
					code: 'export default {};',
					map: null,
				};
			}

			return null;
		},
	};
}
