// import { ImportFilesAsTextPlugin } from './packages/bun-extensions/src/import-files-as-text.ts';

await Bun.build({
	entrypoints: [__dirname + '/packages/playground/cli/src/cli.ts'],
	outdir: __dirname + '/out',
	target: 'node',
	root: '.',
	// plugins: [ImportFilesAsTextPlugin],
});
console.log('built');
export {};
