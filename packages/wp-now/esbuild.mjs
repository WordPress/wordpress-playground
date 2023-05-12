import * as esbuild from 'esbuild';

await esbuild.build({
	entryPoints: [
		'packages/wp-now/src/index.ts',
		'packages/wp-now/src/main.ts',
	],
	outdir: 'dist/packages/wp-now',
	bundle: true,
	packages: 'external',
	format: 'esm',
	platform: 'node',
});
