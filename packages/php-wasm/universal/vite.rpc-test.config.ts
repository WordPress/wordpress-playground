/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { defineConfig } from 'vite';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';

export default defineConfig({
	root: __dirname,
	plugins: [viteTsConfigPaths({ root: '../../../' })],
	build: {
		outDir: join(
			__dirname,
			'../../../dist/test-fixtures/php-wasm-universal'
		),
		emptyOutDir: true,
		lib: {
			entry: 'src/test/fixtures/rpc-sync-runtime.ts',
			formats: ['es'],
			fileName: 'rpc-sync-runtime',
		},
		rollupOptions: {
			external: [
				...builtinModules,
				...builtinModules.map((module) => `node:${module}`),
			],
		},
	},
});
