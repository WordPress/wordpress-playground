import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import { configDefaults } from 'vitest/config';

import config from './vite.config';

export default defineConfig(() => {
	const merged = mergeConfig(
		config,
		defineConfig({
			test: {
				env: {
					KANDELO_DIR:
						process.env['KANDELO_DIR'] ??
						resolve(
							dirname(fileURLToPath(import.meta.url)),
							'../../../kandelo'
						),
				},
				poolOptions: {
					forks: {
						maxForks: 2,
						minForks: 1,
						execArgv: ['--experimental-wasm-exnref'],
					},
				},
			},
		})
	);

	merged.test.include = [
		'tests/posix-kernel/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
	];
	merged.test.exclude = [...configDefaults.exclude];

	return merged;
});
