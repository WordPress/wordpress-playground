import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config';

export default defineConfig((env) =>
	mergeConfig(
		config(env),
		defineConfig({
			assetsInclude: ['**/*.wasm', '**/*.so', '**/*.dat'],

			plugins: [
				{
					name: 'virtual-index-page',
					configureServer(server) {
						server.middlewares.use((req, res, next) => {
							if (req.url === '/') {
								res.end(
									`<!DOCTYPE html><html><head></head><body></body></html>`
								);
							} else {
								next();
							}
						});
					},
				},
				{
					name: 'virtual-wasm-feature-detect',
					resolveId(id) {
						if (id === 'virtual:wasm-feature-detect') return id;
						return null;
					},
					load(id) {
						if (id === 'virtual:wasm-feature-detect') {
							return `export async function jspi() {
									return ${process.env['JSPI'] === 'true'};
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
