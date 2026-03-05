/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteIgnoreImports } from '../../vite-extensions/vite-ignore-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	websiteExtrasDevServerPort,
	websiteExtrasDevServerHost,
} from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../../vite-extensions/vite-virtual-module';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

export default defineConfig(({ mode }) => {
	const corsProxyUrl =
		'CORS_PROXY_URL' in process.env
			? process.env.CORS_PROXY_URL
			: mode === 'production'
				? 'https://wordpress-playground-cors-proxy.net/?'
				: 'http://127.0.0.1:5263/cors-proxy.php?';

	return {
		root: __dirname,
		base: mode === 'production' ? '/' : '/website-extras/',

		assetsInclude: ['**/*.so'],

		cacheDir:
			'../../../node_modules/.vite/packages-playground-website-extras',

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		preview: {
			port: websiteExtrasDevServerPort,
			host: websiteExtrasDevServerHost,
		},

		server: {
			port: websiteExtrasDevServerPort,
			host: websiteExtrasDevServerHost,
			allowedHosts: ['playground.test', 'playground-preview.test'],
			fs: {
				strict: false, // Serve files from the other project directories.
			},
		},

		plugins: [
			react({
				jsxRuntime: 'automatic',
			}),
			viteTsConfigPaths({
				root: '../../../',
			}),
			viteIgnoreImports({
				extensions: ['wasm', 'dat'],
			}),
			...viteGlobalExtensions,
			buildVersionPlugin('website-config'),
			virtualModule({
				name: 'cors-proxy-url',
				content: `
				export const corsProxyUrl = ${JSON.stringify(corsProxyUrl || undefined)};`,
			}),
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			target: 'esnext',
			sourcemap: true,
			rollupOptions: {
				input: {
					'beta-php-playground.html': fileURLToPath(
						new URL('./beta-php-playground.html', import.meta.url)
					),
					'playground-block-frame.html': fileURLToPath(
						new URL(
							'./playground-block-frame.html',
							import.meta.url
						)
					),
				},
				external: [],
			},
		},

		test: {
			globals: true,
			cache: {
				dir: '../../../node_modules/.vitest',
			},
			environment: 'node',
			include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
			reporters: ['default'],
		},
	};
});
