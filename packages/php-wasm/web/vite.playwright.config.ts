import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config';

export default defineConfig((env) =>
	mergeConfig(
		config(env),
		defineConfig({
			assetsInclude: ['**/*.wasm', '**/*.so', '**/*.dat'],

			logLevel: 'error',

			plugins: [
				{
					name: 'virtual-wasm-feature-detect',
					resolveId(id) {
						if (id === 'virtual:wasm-feature-detect') return id;
						return null;
					},
					load(id) {
						if (id === 'virtual:wasm-feature-detect') {
							return `export async function jspi() {
									return ${!!process.env['JSPI']};
								}`;
						}
						return null;
					},
				},
			],

			resolve: {
				alias: {
					'wasm-feature-detect': 'virtual:wasm-feature-detect',
				},
			},
		})
	)
);
