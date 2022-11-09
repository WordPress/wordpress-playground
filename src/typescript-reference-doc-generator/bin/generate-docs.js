const fs = require('fs');
const yargs = require('yargs');
const { ApiModelBuilder, MarkdownDocumenter } = require('../index');

const { i: inputFolder, o: outputFolder } = yargs(process.argv.slice(2))
	.command('build', 'Builds the project files')
	.options({
		'input-folder': {
			alias: 'i',
			type: 'string',
			required: true,
			describe:
				'The input folder containing the *.api.json files to be processed.',
		},
		'output-folder': {
			alias: 'o',
			type: 'string',
			required: true,
			describe:
				'The output folder where the documentation will be written. ANY EXISTING CONTENTS WILL BE DELETED!',
		},
	})
	.help()
	.alias('help', 'h').argv;

if (!fs.existsSync(inputFolder)) {
	throw new Error('The input folder does not exist: ' + inputFolder);
}

try {
	fs.mkdirSync(outputFolder, { recursive: true });
} catch (e) {
	if (!fs.existsSync(outputFolder)) {
		throw e;
	}
}

const builder = new ApiModelBuilder();
const apiModel = builder.buildApiModel(inputFolder);

const markdownDocumenter = new MarkdownDocumenter({
	apiModel,
	documenterConfig: undefined,
	outputFolder,
});

markdownDocumenter.generateFiles();
