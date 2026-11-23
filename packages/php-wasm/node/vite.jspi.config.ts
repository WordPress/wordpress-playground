import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config';

export default defineConfig((env) =>
	mergeConfig(
		config(env),
		defineConfig({
			test: {
				env: { PHP_WASM_TEST_ASYNCIFY: 'false' },
				poolOptions: {
					forks: {
						execArgv: [
							'--expose-gc',
							'--stack-trace-limit=100',
							'--experimental-wasm-stack-switching',
							'--experimental-wasm-jspi',
						],
					},
				},
			},
		})
	)
);
