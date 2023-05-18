/**
 * For Vitest only! The module is built with esbuild which is configured
 * in project.json.
 */
/// <reference types="vitest" />
import { defineConfig } from 'vite';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../vite-ts-config-paths';

export default defineConfig(() => {
	return {
		cacheDir: '../../node_modules/.vite/wp-now',

		plugins: [
			viteTsConfigPaths({
				root: '../../',
			}),
		],

		test: {
			globals: true,
			cache: {
				dir: '../../node_modules/.vitest',
			},
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		},
	};
});
