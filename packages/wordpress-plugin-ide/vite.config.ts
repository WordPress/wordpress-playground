import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import react from '@vitejs/plugin-react'; // 1.0.7

import { dependencies } from './package.json';

const path = (filename) => new URL(filename, import.meta.url).pathname;
export default defineConfig({
	root: path`./`,
	resolve: {
		alias: {
			crypto: path`./src/bundler/polyfills/crypto.js`,
		},
	},
	build: {
		outDir: path`./build`,
		emptyOutDir: false,
		lib: {
			entry: path`./src/index.ts`,
			name: 'WordPressPluginIDE',
			fileName(format, entryName) {
				return `${entryName}.js`;
			},
			formats: ['es'],
		},
		rollupOptions: {
			input: {
				index: path`./src/index.ts`,
			},
			external: [
				'react/jsx-runtime',
				...Object.keys(dependencies).filter(dep => dep !== 'react-refresh')
			],
			output: {
				inlineDynamicImports: false
			}
		},
	},
	plugins: [
		react(),
		viteStaticCopy({
			targets: [
				{
					src: [
						path`../../node_modules/react/umd/react.development.js`,
						path`../../node_modules/react-dom/umd/react-dom.development.js`,
					],
					dest: '',
				},
			],
		}),
	],
});
