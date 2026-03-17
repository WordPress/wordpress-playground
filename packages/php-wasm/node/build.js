import esbuild from 'esbuild';
import fs from 'fs';

try {
	fs.mkdirSync('dist/packages/php-wasm/node', { recursive: true });
} catch (e) {
	// Ignore
}

try {
	fs.mkdirSync('dist/packages/php-wasm/node/shared');

	fs.copyFileSync(
		'packages/php-wasm/node/src/lib/extensions/intl/shared/icu.dat',
		'dist/packages/php-wasm/node/shared/icu.dat'
	);
} catch (e) {
	// Ignore
}

async function build() {
	// CommonJS build
	await esbuild.build({
		entryPoints: [
			'packages/php-wasm/node/src/index.ts',
			'packages/php-wasm/node/src/noop.ts',
		],
		supported: {
			'dynamic-import': true,
		},
		outExtension: { '.js': '.cjs' },
		outdir: 'dist/packages/php-wasm/node',
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'direct-eval': 'silent',
			'commonjs-variable-in-esm': 'silent',
		},
		format: 'cjs',
		bundle: true,
		tsconfig: 'packages/php-wasm/node/tsconfig.json',
		external: [
			'@php-wasm/*',
			'@wp-playground/*',
			'ws',
			'fs-ext-extra-prebuilt',
		],
		loader: {
			'.php': 'text',
			'.ini': 'file',
		},
	});

	// ESM build
	await esbuild.build({
		entryPoints: [
			'packages/php-wasm/node/src/index.ts',
			'packages/php-wasm/node/src/noop.ts',
		],
		outdir: 'dist/packages/php-wasm/node',
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'direct-eval': 'silent',
			'commonjs-variable-in-esm': 'silent',
		},
		packages: 'external',
		bundle: true,
		tsconfig: 'packages/php-wasm/node/tsconfig.json',
		external: [
			'@php-wasm/*',
			'@wp-playground/*',
			'ws',
			'fs',
			'path',
			'fs-ext',
		],
		supported: {
			'dynamic-import': true,
			'top-level-await': true,
		},
		format: 'esm',
		loader: {
			'.php': 'text',
			'.ini': 'file',
		},
	});

	fs.copyFileSync(
		'packages/php-wasm/node/README.md',
		'dist/packages/php-wasm/node/README.md'
	);
}
build();
