/// <reference types="vitest" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { join } from 'path';
import dts from 'vite-plugin-dts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
import { copyFileSync, existsSync } from 'fs';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	buildVersionPlugin,
	getBuildVersion,
} from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../../vite-extensions/vite-virtual-module';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;

const plugins = [
	viteTsConfigPaths({
		root: '../../../',
	}),
	dts({
		entryRoot: 'src',
		tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
		pathsToAliases: false,
	}),
	/**
	 * Copy the `.htaccess` file to the `dist` directory.
	 */
	{
		name: 'htaccess-plugin',
		apply: 'build',
		writeBundle({ dir: outputDir }) {
			const htaccessPath = path('.htaccess');

			if (existsSync(htaccessPath) && outputDir) {
				copyFileSync(htaccessPath, join(outputDir, '.htaccess'));
			}
		},
	} as Plugin,
	...viteGlobalExtensions,
	buildVersionPlugin(),

	/**
	 * Insert the Playground version during build so the Playground client
	 * can confirm remote compatibility by comparing its build version with
	 * the version declared in remote.html.
	 */
	(() => {
		let performedVersionReplacement = false;
		return {
			name: 'insert-remote-version-during-build',
			order: 'post',
			async transformIndexHtml(html: string) {
				const buildVersion: string = getBuildVersion();
				const updatedHtml = html.replace(
					'<!--PLAYGROUND_BUILD_VERSION=DEVELOPMENT.VERSION.REPLACED.DURING.BUILD-->',
					`<!--PLAYGROUND_BUILD_VERSION=${buildVersion}-->`
				);

				if (updatedHtml !== html) {
					performedVersionReplacement = true;
				}

				return updatedHtml;
			},
			writeBundle() {
				// Explicitly check whether the build version was replaced
				// to avoid the possibility of silent failure.
				if (!performedVersionReplacement) {
					throw new Error(
						'PLAYGROUND_BUILD_VERSION was not replaced in remote.html'
					);
				}
			},
		};
	})(),
];

export default defineConfig(({ mode }) => {
	const corsProxyUrl =
		'CORS_PROXY_URL' in process.env
			? process.env['CORS_PROXY_URL']
			: mode === 'production'
			? 'https://wordpress-playground-cors-proxy.net/?'
			: 'http://127.0.0.1:5263/cors-proxy.php?';

	plugins.push(
		virtualModule({
			name: 'cors-proxy-url',
			content: `
			export const corsProxyUrl = ${JSON.stringify(corsProxyUrl || undefined)};`,
		})
	);

	return {
		assetsInclude: ['**/*.wasm', '**/*.dat', '**/*.phar', '*.zip'],
		cacheDir: '../../../node_modules/.vite/playground',
		// Bundled WordPress files live in a separate dependency-free `wordpress`
		// package so that every package may use them without causing circular
		// dependencies.
		// Other than that, the `remote` package has no public assets of its own.
		// Therefore, let's just point the `remote` public directory to the
		// `wordpress` package to make WordPress assets available.
		publicDir: path('../wordpress-builds/public'),

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		preview: {
			port: remoteDevServerPort - 100,
			host: remoteDevServerHost,
		},

		server: {
			port: remoteDevServerPort,
			host: remoteDevServerHost,
			allowedHosts: ['playground.test'],
			fs: {
				// Allow serving files from the 'packages' directory
				allow: ['../../'],
			},
		},

		plugins,

		worker: {
			format: 'es',
			plugins: () => plugins,
			rollupOptions: {
				output: {
					// Ensure the service worker always has the same name
					entryFileNames: (chunkInfo: any) => {
						if (chunkInfo.name === 'service-worker') {
							return 'sw.js';
						}
						return '[name]-[hash].js';
					},
				},
			},
		},

		build: {
			target: 'esnext',
			// Important: Vite does not extract static assets as separate files
			//            in the library mode. assetsInlineLimit: 0 only works
			//            in the app mode.
			// @see https://github.com/vitejs/vite/issues/3295
			assetsInlineLimit: 0,
			sourcemap: true,
			rollupOptions: {
				input: {
					wordpress: path('/remote.html'),
				},
			},
			// Clean the output directory to make sure we include only the
			// latest WordPress builds.
			emptyOutDir: true,
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
