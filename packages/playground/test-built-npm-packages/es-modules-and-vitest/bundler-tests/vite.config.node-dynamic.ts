/**
 * Vite config for bundling node-related packages with dynamic imports.
 * This config bundles @php-wasm/node and @php-wasm/universal into a Node.js-compatible bundle
 * using dynamic import() statements.
 *
 * Node.js builtins and binary assets are externalized because they're available
 * at runtime in Node.js environments.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

export default defineConfig({
	build: {
		outDir: 'dist/node-dynamic',
		lib: {
			entry: resolve(__dirname, 'entry-node-dynamic-imports.ts'),
			name: 'PlaygroundNodeDynamic',
			fileName: 'bundle-node-dynamic-imports',
			formats: ['es'],
		},
		rollupOptions: {
			// Externalize Node.js builtins and binary assets
			external: [
				...builtinModules,
				...builtinModules.map((m) => `node:${m}`),
				'fs-ext-extra-prebuilt',
				/\.wasm$/,
				/\.so$/,
				/\.dat$/,
			],
		},
		target: 'node18',
		minify: false,
		sourcemap: true,
	},
});
