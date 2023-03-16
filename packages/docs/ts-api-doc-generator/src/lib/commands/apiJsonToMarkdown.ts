import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ApiModelBuilder } from '../ApiModelBuilder';
import { MarkdownDocumenter } from '../documenters/MarkdownDocumenter';
import { mergeApiModelsGroups } from '../utils/mergeApiModels';

require('../patch-tsdoc');

export default function apiJsonToMarkdown(
	inputFiles: string[],
	outputFolder: string
) {
	// Iterate over the JSON files in the directory passed via the first argument
	const extractedApis = inputFiles
		.filter((filePath) => {
			if (!fs.existsSync(filePath)) {
				throw new Error('The input folder does not exist: ' + filePath);
			}
			return true;
		})
		.map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8')));

	const mergedApis = mergeApiModelsGroups(extractedApis);
	ensureDir(outputFolder);

	const mergedModelTmpDir = fs.mkdtempSync(
		path.join(os.tmpdir(), 'combined-api-model-')
	);
	// eslint-disable-next-line prefer-const
	for (let [name, mergedModel] of Object.entries(mergedApis)) {
		name = name.replace('/', '-');
		const mergedModelPath = path.join(
			mergedModelTmpDir,
			`${name}.api.json`
		);

		ensureDir(path.dirname(mergedModelPath));
		fs.writeFileSync(mergedModelPath, JSON.stringify(mergedModel, null, 2));
		console.log(`${mergedModelTmpDir}/${name}.api.json`);
	}

	const builder = new ApiModelBuilder();
	const apiModel = builder.buildApiModel(mergedModelTmpDir);

	const markdownDocumenter = new MarkdownDocumenter({
		apiModel,
		documenterConfig: undefined,
		outputFolder,
	});

	markdownDocumenter.generateFiles();
}

function ensureDir(dirname: fs.PathLike) {
	try {
		fs.mkdirSync(dirname, { recursive: true });
	} catch (e) {
		if (!fs.existsSync(dirname)) {
			throw e;
		}
	}
}
