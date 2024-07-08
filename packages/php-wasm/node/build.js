import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

try {
	fs.mkdirSync('dist/packages/php-wasm/node', { recursive: true });
} catch (e) {
	// Ignore
}

async function build() {
	await esbuild.build({
		entryPoints: [
			'packages/php-wasm/node/src/index.ts',
			'packages/php-wasm/node/src/noop.ts',
		],
		supported: {
			'dynamic-import': false,
		},
		outExtension: { '.js': '.cjs' },
		outdir: 'dist/packages/php-wasm/node',
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'commonjs-variable-in-esm': 'silent',
		},
		format: 'cjs',
		bundle: true,
		tsconfig: 'packages/php-wasm/node/tsconfig.json',
		external: ['@php-wasm/*', '@wp-playground/*', 'ws'],
		loader: {
			'.php': 'text',
			'.ini': 'file',
			'.wasm': 'file',
		},
	});

	const nodeModules = new RegExp(/^(?:.*[\\\/])?node_modules(?:[\\\/].*)?$/);
	await esbuild.build({
		entryPoints: [
			'packages/php-wasm/node/src/index.ts',
			'packages/php-wasm/node/src/noop.ts',
		],
		banner: {
			js: "import { createRequire as topLevelCreateRequire } from 'module';\n const require = topLevelCreateRequire(import.meta.url);",
		},
		plugins: [
			{
				name: 'Support __dirname in ESM',
				setup(build) {
					build.onLoad({ filter: /.*/ }, ({ path: filePath }) => {
						if (!filePath.match(nodeModules)) {
							let contents = fs.readFileSync(filePath, 'utf8');
							const loader = path.extname(filePath).substring(1);
							const dirname = path.dirname(filePath);
							contents = contents
								.replaceAll('__dirname', `"${dirname}"`)
								.replaceAll('__filename', `"${filePath}"`);
							return {
								contents,
								loader,
							};
						}
					});
				},
			},
		],
		outdir: 'dist/packages/php-wasm/node',
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'commonjs-variable-in-esm': 'silent',
		},
		packages: 'external',
		bundle: true,
		tsconfig: 'packages/php-wasm/node/tsconfig.json',
		external: ['@php-wasm/*', '@wp-playground/*', 'ws', 'fs', 'path'],
		supported: {
			'dynamic-import': true,
			'top-level-await': true,
		},
		format: 'esm',
		loader: {
			'.php': 'text',
			'.ini': 'file',
			'.wasm': 'file',
		},
	});

	fs.copyFileSync(
		'packages/php-wasm/node/README.md',
		'dist/packages/php-wasm/node/README.md'
	);
}
build();
