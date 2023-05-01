/// <reference types="vitest" />
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';
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
	'^/plugin-proxy.*&artifact=.*': {
		target: 'https://playground.wordpress.net',
		changeOrigin: true,
		secure: true,
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
};

export default defineConfig(({ command }) => {
	const playgroundOrigin =
		command === 'build'
			? // In production, both the website and the playground are served from the same domain.
			  ''
			: // In dev, the website and the playground are served from different domains.
			  `http://${remoteDevServerHost}:${remoteDevServerPort}`;
	return {
		cacheDir:
			'../../../node_modules/.vite/packages-interactive-block-playground',

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
			viteTsConfigPaths({
				root: '../../../',
			}),
			virtualModule({
				name: 'interactive-block-playground-config',
				content: `export const remotePlaygroundOrigin = ${JSON.stringify(
					playgroundOrigin
				)};`,
			}),
		],
	};
});
