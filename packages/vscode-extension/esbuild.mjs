import * as esbuild from 'esbuild';

const options = {
	entryPoints: [
		'packages/vscode-extension/src/index.ts',
		'packages/vscode-extension/src/webview.tsx',
		'packages/vscode-extension/src/worker.ts',
	],
	outdir: 'dist/packages/vscode-extension',
	bundle: true,
	external: ['vscode'],
	minify: false,
	format: 'cjs',
	loader: {
		'.html': 'text',
	},
	platform: 'node',
};

esbuild.build(options);
