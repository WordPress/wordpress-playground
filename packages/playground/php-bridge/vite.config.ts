/// <reference types='vitest' />
import { defineConfig } from 'vite';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-ts-config-paths';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/playground-php-bridge',

	plugins: [
		nxViteTsPaths(),
		viteTsConfigPaths({
			root: '../../../',
		}),
	],

	// Uncomment this if you are using workers.
	// worker: {
	//  plugins: [ nxViteTsPaths() ],
	// },

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'playground-php-bridge',
			fileName: 'index',
			// Change this to the formats you want to support.
			// Don't forget to update your package.json as well.
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			// External packages that should not be bundled into your library.
			external: [],
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	},
});
