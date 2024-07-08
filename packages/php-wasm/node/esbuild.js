const esbuild = require('esbuild');
const { nodeExternalsPlugin } = require('esbuild-node-externals');

esbuild.build({
	entryPoints: [
		'packages/php-wasm/node/src/index.ts',
		'packages/php-wasm/node/src/noop.ts',
	],
	plugins: [nodeExternalsPlugin()],
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
});
