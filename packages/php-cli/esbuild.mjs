import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import cleanPlugin from 'esbuild-plugin-clean';

const argv = process.argv.slice(2);
const shouldWatch = argv.includes('--watch');
const isProd = argv.includes('--production');

const config = {
	logLevel: 'info',
	platform: 'node',
	packages: 'external',
	outdir: 'build',
	bundle: true,
	entryPoints: {
		index: 'src/index.ts',
	},
	loader: {
		'.php': 'text',
		'.txt.js': 'text',
		'.js': 'jsx',
		'.ini': 'file',
	},
	treeShaking: true,
	minify: isProd,
	format: 'cjs',
	plugins: [
		cleanPlugin(),
		copy({
			assets: {
				from: ['./src/terminfo/**/*'],
				to: ['./terminfo'],
			},
		}),
	],
};

if (shouldWatch) {
	const ctx = await esbuild.context(config);
	await ctx.watch()
} else {
	await esbuild.build(config);
}
