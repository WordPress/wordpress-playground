import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

try {
	fs.mkdirSync('dist/packages/php-wasm/node', { recursive: true });
} catch (e) {
	// Ignore
}

try {
	fs.mkdirSync('dist/packages/php-wasm/node/shared');

	fs.copyFileSync(
		'packages/php-wasm/node/src/lib/data/shared/icudt74l.dat',
		'dist/packages/php-wasm/node/shared/icudt74l.dat'
	);
} catch (e) {
	// Ignore
}

/**
 * This is a naive, best effort dirname/filename replacement plugin.
 *
 * In the repo, php.js files are stored in php_wasm/node/jspi or php_wasm/node/asyncify.
 * They start with a line like this:
 *
 * const dependencyFilename = __dirname + '/8_0_30/php_8_0.wasm';
 *
 * After the build, the contents are concatenated into a single file, which
 * breaks the dependencyFilename variable. This plugin corrects that by
 * appending the correct value such as '/jspi' or '/asyncify' to __dirname.
 *
 * The implementation is naive and assumes the substring __dirname is only used
 * as a variable, are not a part of any other name, and is not seen in any string
 * literals. It also assumes that the __dirname variable doesn't have a trailing
 * slash as documented in the Node.js docs. https://nodejs.org/api/modules.html#__dirname
 *
 * @param {string} dirnameReplacement
 * @param {string} filenameReplacement
 * @returns
 */
const dirnamePlugin = {
	name: 'dirname',
	setup(build) {
		build.onLoad({ filter: /\/php_\d+_\d+\.js$/ }, ({ path: filePath }) => {
			if (!filePath.match(/node_modules/)) {
				let contents = fs.readFileSync(filePath, 'utf8');

				// NOTE: We are building for CommonJS, so we need to remove the
				// shims for the builtins `__dirname` and `require`.
				contents = contents.replace(/\bconst __dirname\s*=.*/, '');
				contents = contents.replace(/\bvar __dirname\s*=.*/, '');
				contents = contents.replace(/\bconst __filename\s*=.*/, '');
				contents = contents.replace(/\bvar __filename\s*=.*/, '');
				contents = contents.replace(/\bconst require\s*=.*/, '');

				const loader = path.extname(filePath).substring(1);
				const dirname = filePath.includes('/jspi/')
					? '/jspi'
					: '/asyncify';
				contents = contents.replaceAll(
					'__dirname',
					`__dirname + ${JSON.stringify(dirname)}`
				);
				return {
					contents,
					loader,
				};
			}
		});
	},
};

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
		plugins: [dirnamePlugin],
	});

	await esbuild.build({
		entryPoints: [
			'packages/php-wasm/node/src/index.ts',
			'packages/php-wasm/node/src/noop.ts',
		],
		banner: {
			js: `import { createRequire as topLevelCreateRequire } from 'module';
const require = topLevelCreateRequire(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;
const __filename = new URL(import.meta.url).pathname;
`,
		},
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
		plugins: [dirnamePlugin],
	});

	fs.copyFileSync(
		'packages/php-wasm/node/README.md',
		'dist/packages/php-wasm/node/README.md'
	);
}
build();
