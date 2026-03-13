import type { Plugin } from 'vite';

export interface IgnoreImportsOptions {
	extensions: string[];
}

export function viteIgnoreImports(options: IgnoreImportsOptions): Plugin {
	let command: 'build' | 'serve';
	/**
	 * Track resolved IDs that originated from ?url imports.
	 * Rolldown (Vite 8) may strip query strings before calling
	 * the load hook, so we record them during resolveId to
	 * prevent this plugin from intercepting asset URL imports.
	 */
	const urlImportIds = new Set<string>();

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
		 */
		name: 'vite-ignore-imports',

		configResolved(config) {
			command = config.command;
		},

		resolveId(source) {
			if (source.includes('?url')) {
				urlImportIds.add(source.replace(/\?.*$/, ''));
			}
			return null;
		},

		load(id) {
			if (command !== 'build') return null;
			// Don't intercept ?url imports — Vite handles those as
			// asset URLs. Check both the id directly and the tracked
			// set (Rolldown may strip query strings before load).
			if (id.includes('?url')) return null;
			const idWithoutQuery = id.replace(/\?.*$/, '');
			if (urlImportIds.has(idWithoutQuery)) return null;
			if (
				options.extensions.some((ext) =>
					idWithoutQuery.endsWith(`.${ext}`)
				)
			) {
				return {
					code: 'export default {};',
					map: null,
				};
			}

			return null;
		},
	};
}
