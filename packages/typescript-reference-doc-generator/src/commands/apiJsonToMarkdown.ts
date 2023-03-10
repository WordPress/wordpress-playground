import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ApiModelBuilder } from '../ApiModelBuilder';
import { MarkdownDocumenter } from '../documenters/MarkdownDocumenter';
import { mergeApiModelsGroups } from '../utils/mergeApiModels';

require('../patch-tsdoc');

export default function apiJsonToMarkdown(inputFiles: string[], outputFolder: string) {
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

    try {
        fs.mkdirSync(outputFolder, { recursive: true });
    } catch (e) {
        if (!fs.existsSync(outputFolder)) {
            throw e;
        }
    }

    const mergedModelTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-api-model-'));
    for(const [name, mergedModel] of Object.entries(mergedApis)) {
        fs.writeFileSync(`${mergedModelTmpDir}/${name}.api.json`, JSON.stringify(mergedModel, null, 2));
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