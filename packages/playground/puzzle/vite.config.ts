/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	websiteDevServerHost,
	websiteDevServerPort,
	remoteDevServerHost,
	remoteDevServerPort,
} from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../vite-virtual-module';
import { fileURLToPath } from 'node:url';

const proxy = {
	'^/plugin-proxy': {
		target: 'https://playground.wordpress.net',
		changeOrigin: true,
		secure: true,
	},
};

let buildVersion: string;
try {
	buildVersion = execSync('git rev-parse HEAD').toString().trim();
} catch (e) {
	buildVersion = (new Date().getTime() / 1000).toFixed(0);
}

export default defineConfig(({ command, mode }) => {
	return {
		// Split traffic from this server on dev so that the iframe content and outer
		// content can be served from the same origin. In production it's already
		// the same host, but dev builds run two separate servers.
		// See proxy config above.
		base: '/puzzle/',

		cacheDir: '../../../node_modules/.vite/packages-playground-puzzle',

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		preview: {
			port: websiteDevServerPort,
			host: websiteDevServerHost,
			proxy,
		},

		server: {
			port: websiteDevServerPort,
			host: websiteDevServerHost,
			proxy: {
				...proxy,
				// Proxy requests to the remote content through this server for dev builds.
				// See base config below.
				'^[/]((?!puzzle).)': {
					target: `http://${remoteDevServerHost}:${remoteDevServerPort}`,
				},
			},
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
			ignoreWasmImports(),
			virtualModule({
				name: 'puzzle-config',
				content: `
				export const buildVersion = ${JSON.stringify(buildVersion)};`,
			}),
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			target: 'esnext',
			rollupOptions: {
				input: {
					index: fileURLToPath(
						new URL('./index.html', import.meta.url)
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
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		},
	};
});
