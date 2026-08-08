import { defineConfig, mergeConfig } from 'vite';
import { configDefaults } from 'vitest/config';

import config from './vite.config';

export default defineConfig(() => {
	const merged = mergeConfig(
		config,
		defineConfig({
			test: {
				setupFiles: ['./tests/posix-kernel/setup.ts'],
				poolOptions: {
					forks: {
						// Cap concurrency so per-fork kandelo + nginx + php-fpm
						// cold-starts stay within NGINX_READY_TIMEOUT_MS. minForks
						// is set explicitly because tinypool rejects a CPU-derived
						// default that exceeds maxForks.
						maxForks: 2,
						minForks: 1,
						execArgv: [
							// kandelo's kernel.wasm needs WebAssembly exnref, which
							// Node 24's V8 keeps behind a flag.
							'--experimental-wasm-exnref',
						],
					},
				},
			},
		})
	);

	// mergeConfig concatenates arrays, so these two are assigned instead of
	// merged. The base config includes every spec under tests/ and excludes
	// tests/posix-kernel/**, which is the only directory this suite runs.
	merged.test.include = [
		'tests/posix-kernel/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
	];
	merged.test.exclude = [...configDefaults.exclude];

	return merged;
});
