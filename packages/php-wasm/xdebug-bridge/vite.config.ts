/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	plugins: [],
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, 'src/index.ts'),
				cli: resolve(__dirname, 'src/cli.ts'),
			},
			formats: ['es', 'cjs'],
			fileName: (format, entryName) => {
				if (format === 'es') {
					return `${entryName}.js`;
				}
				return `${entryName}.cjs`;
			},
		},
		rollupOptions: {
			external: ['net', 'events', 'util'],
			output: {
				exports: 'named',
			},
		},
		sourcemap: true,
		target: 'node20',
	},
	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'node',
		reporters: ['default'],
	},
	define: {
		'import.meta.vitest': undefined,
	},
});
