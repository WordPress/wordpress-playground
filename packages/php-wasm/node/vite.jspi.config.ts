import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config';

export default defineConfig((env) =>
	mergeConfig(
		config(env),
		defineConfig({
			test: {
				// Vitest 4 moved poolOptions to top-level test options.
				execArgv: [
					'--expose-gc',
					'--stack-trace-limit=100',
					'--experimental-wasm-stack-switching',
					'--experimental-wasm-jspi',
				],
			},
		})
	)
);
