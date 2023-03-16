import './lib/patch-tsdoc';
export { ApiModelBuilder } from './lib/ApiModelBuilder';
export { MarkdownDocumenter } from './lib/documenters/MarkdownDocumenter';
export { mergeApiModels } from './lib/utils/mergeApiModels';

import yargs from 'yargs';
import tsDocToApiMarkdown from './lib/commands/tsDocToApiMarkdown';

const argv = yargs(process.argv.slice(2))
	.command('build', 'Builds the project files')
	.options({
		tsconfig: {
			alias: 'c',
			type: 'string',
			describe: 'The path to the tsconfig.json file to use.',
		},
		entrypoints: {
			alias: 'e',
			type: 'array',
			required: true,
			describe: 'The entrypoints to generate the *.api.json files from.',
		},
		outdir: {
			type: 'string',
			alias: 'o',
			default: './',
			describe:
				'The directory to write the Markdown documentation files to.',
		},
		repoUrl: {
			type: 'string',
			describe:
				'The base URL to use for linking specific functions and classes to their source code.',
		},
	})
	.help()
	.alias('help', 'h').argv as any;

const { e: entrypoints, o: outdir, repoUrl } = argv;
tsDocToApiMarkdown({
	entrypoints,
	outdir,
	repoUrl,
});
