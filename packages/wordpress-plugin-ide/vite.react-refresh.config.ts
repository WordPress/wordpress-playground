import { defineConfig } from 'vite';

const path = (filename) => new URL(filename, import.meta.url).pathname;
export default defineConfig({
	root: path`./`,
	build: {
		outDir: path`./build`,
		emptyOutDir: false,
		lib: {
			entry: path`./src/bundler/react-fast-refresh/setup-react-refresh-runtime.js`,
			name: 'setup-react-refresh-runtime',
			fileName(format, entryName) {
				return `${entryName}.js`;
			},
			formats: ['iife'],
		},
		rollupOptions: {
			output: {
				dir: 'build',
				format: 'iife',
				extend: true,
			},
		},
	}
});
