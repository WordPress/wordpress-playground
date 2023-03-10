import { defineConfig } from 'vite';
import type { PreRenderedChunk } from 'rollup';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { globSync } from 'glob';

const path = (filename) => new URL(filename, import.meta.url).pathname;
export default defineConfig({
	root: path`./src`,
	assetsInclude: ['**/*.php', '**/*.data', '**/*.wasm'],
	resolve: {
		alias: {
			'@wordpress/php-wasm': path`../php-wasm/src`,
		},
	},
	worker: {
		format: 'es',
		rollupOptions: {
			output: {
				// Ensure the service worker always has the same name
				entryFileNames: (chunkInfo: PreRenderedChunk) => {
					if (chunkInfo.name?.includes('service-worker')) {
						return 'sw.js';
					}
					return '[name]-[hash].js';
				}
			},
		},
	},
	build: {
		assetsDir: `./`,
		assetsInlineLimit: 0,
		outDir: path`./build`,
		rollupOptions: {
			input: {
				app: path`./src/wordpress.html`,
			},
		},
	},
	plugins: [
		viteStaticCopy({
			targets: [
				// Copy the built php wasm files
				{
					src: globSync(path`../php-wasm/build/web/*.wasm`),
					dest: '',
				},
				// Copy the built WordPress assets
				{
					src: [
						...globSync(path`./src/wordpress/wp-[0-9].[0-9]`),
						path`./src/wordpress/wp-nightly`,
					],
					dest: '',
				},
				// Copy the .htaccess and plugins-proxy files – both important for deployments
				// to wordpress.net (and any other apache-based server)
				{
					src: [path`./src/.htaccess`, path`./src/plugin-proxy.php`],
					dest: '',
				},
				{
					src: [
						path`../wordpress-plugin-ide/build/setup-react-refresh-runtime.js`,
						path`../wordpress-plugin-ide/build/react.development.js`,
						path`../wordpress-plugin-ide/build/react-dom.development.js`,
					],
					dest: '',
				},
			],
		}),
	],
	server: {
		open: '/wordpress.html',
		proxy: {
			'/plugin-proxy': {
				target: 'https://downloads.wordpress.org',
				changeOrigin: true,
				secure: true,
				rewrite: (path) => {
					const url = new URL(path, 'http://example.com');
					if (url.searchParams.has('plugin')) {
						return `/plugin/${url.searchParams.get('plugin')}`;
					} else if (url.searchParams.has('theme')) {
						return `/theme/${url.searchParams.get('theme')}`;
					}
					throw new Error('Invalid request');
				},
			},
		},
	},
});
