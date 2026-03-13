import type { Plugin } from 'vite';

export interface IgnoreImportsOptions {
	extensions: string[];
}

export function viteIgnoreImports(options: IgnoreImportsOptions): Plugin {
	let command: 'build' | 'serve';

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
		 *
		 * Only active during build — in dev mode, these files are served by
		 * Vite's asset pipeline (e.g. ?url imports return a URL string).
		 * In Vite 8, Rolldown's internal resolver may strip query strings
		 * before calling the load hook, which would cause this plugin to
		 * intercept ?url asset imports and return a noop instead of letting
		 * Vite serve the actual file URL.
		 */
		name: 'vite-ignore-imports',

		configResolved(config) {
			command = config.command;
		},

		load(id) {
			if (command !== 'build') return null;
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
