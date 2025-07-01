import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config';

export default defineConfig((env) =>
	mergeConfig(
		config(env),
		defineConfig({
			test: {
				poolOptions: {
					forks: {
						execArgv: [
							'--expose-gc',
							'--experimental-wasm-stack-switching',
							'--experimental-wasm-jspi',
						],
					},
				},
			},
		})
	)
);
