/**
 * Due to the way vite works, .dat files are resolved by
 * rollup even in modules that do not import them but only
 * import `@wp-playground/client` that has a dependency
 * on `@php-wasm/web`. This leads to the following error:
 *
 *     Could not load /icudt74l.dat
 *
 * This plugin turns .dat files into noop imports to fix the bundling of
 * dependent packages.
 */
export default () => ({
	name: 'ignore-data-imports',

	load(id: string): any {
		if (id?.endsWith('.dat')) {
			return {
				code: 'export default {}',
				map: null,
			};
		}
	},
});
