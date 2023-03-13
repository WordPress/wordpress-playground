// rollup.config.js
import { globSync } from 'glob';
import fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';

export default [
	{
		input: {
			'service-worker':
				'src/web/service-worker/index.ts',
			index: 'src/web.ts',
		},
		external: ['pnpapi'],
		output: {
			dir: 'build/web',
			format: 'esm',
		},
		plugins: [
			copy({
				targets: [
					{ src: 'src/web/iframe-worker.html', dest: 'build/web' },
					{ src: 'src/web/.htaccess', dest: 'build/web' }
				],
			}),
			typescript({
				tsconfig: './tsconfig.json',
				compilerOptions: {
					declarationDir: 'build/web/types',
					outDir: 'build/web/types'
				}
			}),
			url({
				include: ['**/*.wasm'],
			})
		],
	},
	{
		input: {
			index: 'src/node.ts',
		},
		external: ['pnpapi', 'util'],
		output: {
			dir: 'build/node',
			format: 'esm'				
		},
		plugins: [
			typescript({
				tsconfig: './tsconfig.json',
				compilerOptions: {
					declarationDir: 'build/node/types',
					outDir: 'build/node/types',
					lib: []
				}
			}),
			url({
				include: ['**/*.wasm'],
			}),
		],
	},
];
