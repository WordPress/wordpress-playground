/**
 * Due to the way vite works, .so files are resolved by
 * rollup even in modules that do not import them but only
 * import `@wp-playground/client` that has a dependency
 * on `@php-wasm/web`. This leads to the following error:
 *
 *     Could not load /*.so
 *
 * This plugin turns .so files into noop imports to fix the bundling of
 * dependent packages.
 */
export default () => ({
	name: 'ignore-lib-imports',

	load(id: string): any {
		if (id?.endsWith('.so')) {
			return {
				code: 'export default {}',
				map: null,
			};
		}
	},
});
