import * as esbuild from 'esbuild';
import ignorePlugin from 'esbuild-plugin-ignore';

const options = {
	entryPoints: [
		'packages/vscode-extension/src/index.ts',
		'packages/vscode-extension/src/serve.ts',
		'packages/vscode-extension/src/webview.tsx'
	],
	outdir: 'dist/packages/vscode-extension',
	bundle: true,
	external: ['vscode'],
	minify: false,
	format: 'cjs',
	loader: {
		'.html': 'text'
	},
	platform: 'node',
	plugins: [
		// Only bundle PHP 7.4 for now
		ignorePlugin([
			{
				resourceRegExp: /php_([^7]_\d|7_[^4])\.js$/
			}
		])
	]
};

// Build or watch, depending on the command line arguments
if (process.argv.includes('--watch')) {
	const ctx = await esbuild.context(options);
	ctx.watch();
} else {
	esbuild.build(options);
}
