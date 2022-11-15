import yargs from 'yargs';
import tsDocToApiMarkdown from '../commands/tsDocToApiMarkdown';

let { e: entrypoints, o: outdir, repoUrl } = yargs(process.argv.slice(2))
	.command('build', 'Builds the project files')
	.options({
		'entrypoints': {
			alias: 'e',
			type: 'array',
			required: true,
			describe:
				'The entrypoints to generate the *.api.json files from.',
		},
		'outdir': {
            type: 'string',
            alias: 'o',
            default: './',
			describe:
				'The directory to write the Markdown documentation files to.',
		},
		'repoUrl': {
			type: 'string',
			describe:
				'The base URL to use for linking specific functions and classes to their source code.',
		},
	})
	.help()
    .alias('help', 'h').argv;

tsDocToApiMarkdown({
    entrypoints,
    outdir,
    repoUrl
});
