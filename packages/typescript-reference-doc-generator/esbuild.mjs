import * as esbuild from 'esbuild';
import cleanPlugin from 'esbuild-plugin-clean';

const argv = process.argv.slice(2);
const shouldWatch = argv.includes('--watch');
const isProd = argv.includes('--production');

const path = (filename) => new URL(filename, import.meta.url).pathname;
const config = {
	logLevel: 'info',
	format: 'cjs',
	platform: 'node',
	outdir: path`./build/`,
	bundle: true,
	external: ['@microsoft/*', 'node_modules/*'],
	entryPoints: [
		path`./src/bin/tsdoc-to-api-markdown.js`
	],
	treeShaking: true,
	minify: isProd,
	plugins: [
		cleanPlugin()
	]
};

if (shouldWatch) {
	const ctx = await esbuild.context(config);
	await ctx.watch()
} else {
	await esbuild.build(config);
}
