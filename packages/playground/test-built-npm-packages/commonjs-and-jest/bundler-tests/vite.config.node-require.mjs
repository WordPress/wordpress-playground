/**
 * Vite config for bundling node packages with CommonJS require().
 * Node.js builtins and binary assets are externalized.
 */
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		outDir: 'dist/node-require',
		lib: {
			entry: resolve(__dirname, 'entry-node-require.cjs'),
			name: 'PlaygroundNodeCJS',
			fileName: 'bundle-node-require',
			formats: ['cjs'],
		},
		rollupOptions: {
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
