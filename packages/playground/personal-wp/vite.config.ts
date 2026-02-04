/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import type { CommonServerOptions, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteIgnoreImports } from '../../vite-extensions/vite-ignore-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	websiteDevServerHost,
	remoteDevServerHost,
	remoteDevServerPort,
} from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { listAssetsRequiredForOfflineMode } from '../../vite-extensions/vite-list-assets-required-for-offline-mode';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../../vite-extensions/vite-virtual-module';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

const personalWPDevServerPort = 5401;

const proxy: CommonServerOptions['proxy'] = {
	'^/plugin-proxy': {
		target: 'https://playground.wordpress.net',
		changeOrigin: true,
		secure: true,
	},
};

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
export default defineConfig(({ command, mode }) => {
	const isProductionBuild = mode === 'production';

	const corsProxyUrl =
		'CORS_PROXY_URL' in process.env
			? process.env.CORS_PROXY_URL
			: isProductionBuild
				? 'https://wordpress-playground-cors-proxy.net/?'
				: '/cors-proxy/?';

	const defaultBlueprintUrl =
		'https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/my-wordpress/blueprint.json';

	return {
		base: isProductionBuild ? '/' : '/website-server/',

		assetsInclude: ['**/*.so', '**/*.dat'],

		cacheDir: '../../../node_modules/.vite/packages-playground-personal-wp',

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		preview: {
			port: personalWPDevServerPort,
			host: websiteDevServerHost,
			proxy,
		},

		server: {
			port: personalWPDevServerPort,
			host: websiteDevServerHost,
			allowedHosts: ['playground.test', 'playground-preview.test'],
			proxy: {
				...proxy,
				'/cors-proxy': {
					target: 'http://127.0.0.1:5263',
					changeOrigin: true,
					rewrite: (path) =>
						path.replace(/^\/cors-proxy\/\?/, '/cors-proxy.php?'),
				},
				'/manifest.json': {
					target: `http://${websiteDevServerHost}:${personalWPDevServerPort}`,
					rewrite: () => '/website-server/manifest.json',
				},
				'^/logo-\\d+\\.png$': {
					target: `http://${websiteDevServerHost}:${personalWPDevServerPort}`,
					rewrite: (path) => `/website-server${path}`,
				},
				'^[/]((?!website-server).)': {
					target: `http://${remoteDevServerHost}:${remoteDevServerPort}`,
				},
			},
			fs: {
				strict: false,
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
				extensions: ['wasm', 'so', 'dat'],
			}),
			...viteGlobalExtensions,
			buildVersionPlugin('website-config'),
			virtualModule({
				name: 'cors-proxy-url',
				content: `
				export const corsProxyUrl = ${JSON.stringify(corsProxyUrl || undefined)};`,
			}),
			virtualModule({
				name: 'website-defaults',
				content: `
				export const defaultBlueprintUrl = ${JSON.stringify(defaultBlueprintUrl || undefined)};
				export const defaultStorageType = 'opfs';
				export const personalWPSiteSlug = 'default';`,
			}),
			{
				name: 'configure-server',
				configureServer(server) {
					server.printUrls = () => {
						const url = `http://${websiteDevServerHost}:${personalWPDevServerPort}/website-server/`;
						// eslint-disable-next-line no-console
						console.log(
							`  Personal Playground: \x1b[36m${url}\x1b[0m`
						);
					};
				},
			},
			{
				name: 'htaccess-plugin',
				apply: 'build',
				writeBundle({ dir: outputDir }) {
					const htaccessPath = path('.htaccess');

					if (existsSync(htaccessPath) && outputDir) {
						copyFileSync(
							htaccessPath,
							join(outputDir, '.htaccess')
						);
					}
				},
			} as Plugin,
			listAssetsRequiredForOfflineMode({
				outputFile: 'assets-required-for-offline-mode.json',
				distDirectoriesToList: ['./', '../remote'],
			}) as Plugin,
			{
				name: 'inject-commit-id',
				transformIndexHtml(html) {
					try {
						const commitId = require('child_process')
							.execSync('git rev-parse HEAD')
							.toString()
							.trim();
						html = html.replace(
							'</head>',
							`<meta name="commit-id" content="${commitId}" />
							</head>`
						);
					} catch (e) {
						// eslint-disable-next-line no-console
						console.error('Failed to inject commit ID', e);
					}
					html = html.replace(
						/<title>.*?<\/title>/,
						'<title>My WordPress</title>'
					);
					return html;
				},
			},
		],

		build: {
			target: 'esnext',
			sourcemap: true,
			rollupOptions: {
				input: {
					index: fileURLToPath(
						new URL('./index.html', import.meta.url)
					),
				},
				output: {
					assetFileNames: (chunkInfo) => {
						if (
							chunkInfo.names?.[0]?.endsWith('.so') ||
							chunkInfo.names?.[0]?.endsWith('.dat')
						) {
							return 'assets/extensions/[name]-[hash][extname]';
						}

						return 'assets/[name]-[hash][extname]';
					},
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
