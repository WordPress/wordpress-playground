/**
 * Vite config for bundling web-related packages for the browser.
 * This config bundles @php-wasm/web and @php-wasm/universal into a browser-compatible bundle.
 *
 * WASM and binary files are externalized because they're loaded dynamically at runtime,
 * not bundled inline. This matches how real-world applications use these packages.
 */
import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		outDir: 'dist/web',
		lib: {
			entry: resolve(__dirname, 'entry-web-static-imports.ts'),
			name: 'PlaygroundWeb',
			fileName: 'bundle-web-static-imports',
			formats: ['es'],
		},
		rollupOptions: {
			// Externalize binary assets - they're loaded at runtime, not bundled
			external: [/\.wasm$/, /\.so$/, /\.dat$/],
		},
		target: 'esnext',
		minify: false,
		sourcemap: true,
	},
});
