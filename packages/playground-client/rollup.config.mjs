// rollup.config.js
import { globSync } from 'glob';
import fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import ts from 'rollup-plugin-ts';
import alias from '@rollup/plugin-alias';
import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';
import dts from 'rollup-plugin-dts';

const path = (filename) => new URL(filename, import.meta.url).pathname;
export default [
	{
		input: 'src/index.ts',
		output: {
			dir: 'build/',
			format: 'esm',
		},
		plugins: [
			typescript({
				tsconfig: './tsconfig.build.json',
				emitDeclarationOnly: true,
				paths: {
					'@wordpress/php-wasm': [
						'../php-wasm/build/web/index.js',
					],
				}
			}),
			url({
				include: ['**/*.wasm'],
			}),
			copy({
				targets: [
					{
						src: '../php-wasm/build/web/index.d.ts',
						dest: 'build/dts',
						rename: 'php-wasm.d.ts',
					},
					{
						src: '../playground/build/index.d.ts',
						dest: 'build/dts',
						rename: 'playground.d.ts',
					},
				],
			}),
			// {
			// 	name: 'file-content-replace',
			// 	buildEnd() {
			// 		const declarations = fs
			// 			.readFileSync(path`./build/dts/index.d.ts`)
			// 			.toString()
			// 			.replace('@wordpress/php-wasm', './php-wasm.d.ts')
			// 			.replace('@wordpress/playground', './playground.d.ts');
			// 		fs.writeFileSync(path`./build/dts/index.d.ts`, declarations);
			// 	},
			// },
		],
	},
	// {
	// 	input: 'build/dts/index.d.ts',
	// 	output: [{ file: 'build/index.d.ts', format: 'es' }],
	// 	plugins: [
	// 		alias({
	// 			entries: [
	// 				{
	// 					find: '@php-wasm/php-wasm',
	// 					replacement: './build/dts/php-wasm.d.ts',
	// 				},
	// 			],
	// 		}),
	// 		ts(),
	// 	],
	// },
];
