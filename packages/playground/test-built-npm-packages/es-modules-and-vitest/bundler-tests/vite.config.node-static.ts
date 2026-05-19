/**
 * Vite config for bundling node-related packages with static imports.
 * This config bundles @php-wasm/node and @php-wasm/universal into a Node.js-compatible bundle.
 *
 * Node.js builtins and binary assets are externalized because they're available
 * at runtime in Node.js environments.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

export default defineConfig({
	build: {
		outDir: 'dist/node-static',
		lib: {
			entry: resolve(__dirname, 'entry-node-static-imports.ts'),
			name: 'PlaygroundNode',
			fileName: 'bundle-node-static-imports',
			formats: ['es'],
		},
		rollupOptions: {
			// Externalize Node.js builtins and binary assets
			external: [
				...builtinModules,
				...builtinModules.map((m) => `node:${m}`),
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
