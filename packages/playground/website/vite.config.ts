/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import {
	websiteDevServerHost,
	websiteDevServerPort,
	remoteDevServerHost,
	remoteDevServerPort,
} from '../build-config';
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import virtualModule from '../vite-virtual-module';

const proxy = {
	'^/plugin-proxy.*glotpress-local.*': {
		target: 'https://github.com',
		changeOrigin: true,
		secure: true,
		followRedirects: true,
		rewrite: (path: string) => {
			return '/GlotPress/GlotPress/archive/refs/heads/local-wasm.zip';
		},
	},
	'/plugin-proxy': {
		target: 'https://downloads.wordpress.org',
		changeOrigin: true,
		secure: true,
		rewrite: (path: string) => {
			const url = new URL(path, 'http://example.com');
			if (url.searchParams.has('plugin')) {
				return `/plugin/${url.searchParams.get('plugin')}`;
			} else if (url.searchParams.has('theme')) {
				return `/theme/${url.searchParams.get('theme')}`;
			}
			throw new Error('Invalid request');
		},
	},
	'/translate-proxy': {
		target: 'https://translate.wordpress.org',
		changeOrigin: true,
		secure: true,
		followRedirects: true,
		rewrite: (path: string) => {
			const url = new URL(path, 'http://example.com');
			if (url.searchParams.has('url')) {
				const url2 = new URL(url.searchParams.get('url')!);
				return url2.toString();
			}
			throw new Error('Invalid request');
		},
	},
};

export default defineConfig(({ command }) => {
	const playgroundOrigin =
		command === 'build'
			? // In production, both the website and the playground are served from the same domain.
			  ''
			: // In dev, the website and the playground are served from different domains.
			  `http://${remoteDevServerHost}:${remoteDevServerPort}`;
	return {
		cacheDir: '../../../node_modules/.vite/packages-playground-website',

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		preview: {
			port: websiteDevServerPort,
			host: websiteDevServerHost,
			headers: {
				'Cross-Origin-Resource-Policy': 'cross-origin',
				'Cross-Origin-Embedder-Policy': 'credentialless',
			},
			proxy,
		},

		server: {
			port: websiteDevServerPort,
			host: websiteDevServerHost,
			headers: {
				'Cross-Origin-Resource-Policy': 'cross-origin',
				'Cross-Origin-Embedder-Policy': 'credentialless',
			},
			proxy,
		},

		plugins: [
			react(),
			viteTsConfigPaths({
				root: '../../../',
			}),
			ignoreWasmImports(),
			virtualModule({
				name: 'website-config',
				content: `export const remotePlaygroundOrigin = ${JSON.stringify(
					playgroundOrigin
				)};`,
			}),
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			rollupOptions: {
				external: [],
			},
		},

		test: {
			globals: true,
			cache: {
				dir: '../../../node_modules/.vitest',
			},
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		},
	};
});
