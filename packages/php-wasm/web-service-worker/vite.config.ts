/// <reference types="vitest" />
import { defineConfig } from 'vite';

import dts from 'vite-plugin-dts';
import { join } from 'path';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/php-wasm-web-service-worker',

	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
		}),

		viteTsConfigPaths({
			root: '../../../',
		}),
		buildVersionPlugin('worker-config'),
	],

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	},
});
