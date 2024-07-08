const esbuild = require('esbuild');

module.exports = {
	entryPoints: [
		'packages/php-wasm/node/src/index.ts',
		'packages/php-wasm/node/src/noop.ts',
	],
	supported: {
		'dynamic-import': false,
	},
	format: 'cjs',
	outExtension: { '.js': '.cjs' },
	outdir: 'dist/packages/php-wasm/node',
	platform: 'node',
	assetNames: '[name]',
	chunkNames: '[name]',
	logOverride: {
		'commonjs-variable-in-esm': 'silent',
	},
	bundle: true,
	tsconfig: 'packages/php-wasm/node/tsconfig.json',
	external: ['@php-wasm/*', '@wp-playground/*', 'ws'],
	loader: {
		'.php': 'text',
		'.ini': 'file',
		'.wasm': 'file',
	},
};
