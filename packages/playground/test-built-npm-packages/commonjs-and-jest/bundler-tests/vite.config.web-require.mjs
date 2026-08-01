/**
 * Vite config for bundling web packages with CommonJS require() for browser.
 * Binary assets are externalized - they're loaded at runtime.
 */
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		outDir: 'dist/web-require',
		lib: {
			entry: resolve(__dirname, 'entry-web-require.cjs'),
			name: 'PlaygroundWebCJS',
			fileName: 'bundle-web-require',
			formats: ['es'],
		},
		rollupOptions: {
			external: [/\.wasm$/, /\.so$/, /\.dat$/],
		},
		target: 'esnext',
		minify: false,
		sourcemap: true,
	},
});
