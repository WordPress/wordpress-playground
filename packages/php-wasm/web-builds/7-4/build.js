import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
const packagePath = path.join(projectRoot, 'packages/php-wasm/web-builds/7-4');
const distPath = path.join(
	projectRoot,
	'dist/packages/php-wasm/web-builds/7-4'
);

try {
	fs.mkdirSync(distPath, { recursive: true });
} catch (e) {
	// Ignore
}

/**
 * Plugin to rewrite imports to work from the dist directory.
 * Dynamic imports need to be preserved as external and paths adjusted.
 */
const externalPathPlugin = {
	name: 'external-path',
	setup(build) {
		// Mark PHP loader files as external and rewrite their paths
		build.onResolve(
			{ filter: /\.\.\/(?:jspi|asyncify)\/.*\.js$/ },
			(args) => {
				const newPath = args.path.replace('../', './');
				return { path: newPath, external: true };
			}
		);
		// Mark extension .so files as external and rewrite paths
		build.onResolve(
			{ filter: /\.\.\/(?:jspi|asyncify)\/extensions\/.*\.so\?url$/ },
			(args) => {
				const newPath = args.path.replace('../', './');
				return { path: newPath, external: true };
			}
		);
	},
};

async function build() {
	// CommonJS build
	await esbuild.build({
		entryPoints: [`${packagePath}/src/index.ts`],
		supported: { 'dynamic-import': false },
		outExtension: { '.js': '.cjs' },
		outdir: distPath,
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'direct-eval': 'silent',
			'commonjs-variable-in-esm': 'silent',
		},
		format: 'cjs',
		bundle: true,
		tsconfig: `${packagePath}/tsconfig.json`,
		external: ['@php-wasm/*', 'wasm-feature-detect'],
		loader: { '.wasm': 'file', '.so': 'file' },
		plugins: [externalPathPlugin],
	});

	// ESM build
	await esbuild.build({
		entryPoints: [`${packagePath}/src/index.ts`],
		outdir: distPath,
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'direct-eval': 'silent',
			'commonjs-variable-in-esm': 'silent',
		},
		packages: 'external',
		bundle: true,
		tsconfig: `${packagePath}/tsconfig.json`,
		external: ['@php-wasm/*', 'wasm-feature-detect'],
		supported: { 'dynamic-import': true, 'top-level-await': true },
		format: 'esm',
		loader: { '.wasm': 'file', '.so': 'file' },
		plugins: [externalPathPlugin],
	});

	fs.copyFileSync(`${packagePath}/README.md`, `${distPath}/README.md`);
}
build();
