/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

import { cliViteConfig } from './vite.config';

export default defineConfig({
	...cliViteConfig,
	test: {
		...cliViteConfig.test,
		include: [
			'tests/posix-kernel/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
		],
		exclude: [...configDefaults.exclude],
		setupFiles: ['./tests/posix-kernel/setup.ts'],
	},
});
