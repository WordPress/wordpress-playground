/// <reference types="vitest" />
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { join } from 'path';
import dts from 'vite-plugin-dts';
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../build-config';
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import virtualModule from '../vite-virtual-module';
import viteRateLimit from '../vite-rate-limiter';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
const plugins = [
	viteTsConfigPaths({
		root: '../../../',
	}),
	dts({
		entryRoot: 'src',
		tsConfigFilePath: join(__dirname, 'tsconfig.lib.json'),
		skipDiagnostics: true,
	}),
	virtualModule({
		name: 'service-worker-version',
		// @TODO: compute a hash of the service worker chunk instead of using the build timestamp
		content: `export const serviceWorkerVersion = '${Date.now()}';`,
	}),
	viteRateLimit({
		shouldCountRequest: (req) =>
			!!req.headers['referer']?.includes('/scope:'),
	}),
];
export default defineConfig({
	assetsInclude: ['**/*.wasm', '*.data'],
	cacheDir: '../../../node_modules/.vite/playground',

	preview: {
		port: remoteDevServerPort,
		host: remoteDevServerHost,
	},

	server: {
		port: remoteDevServerPort,
		host: remoteDevServerHost,
		headers: {
			'Cross-Origin-Resource-Policy': 'cross-origin',
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['./'],
		},
	},

	plugins,

	worker: {
		format: 'es',
		plugins,
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

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		assetsInlineLimit: 0,
		rollupOptions: {
			input: {
				wordpress: path('/remote.html'),
				'iframe-worker': path('/iframe-worker.html'),
			},
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
});
