import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import apiJsonToMarkdown from './apiJsonToMarkdown';
import tsDocToApiJson from './tsDocToApiJson';

export interface TsDocToApiMarkdownConfig {
    entrypoints: string[];
    outdir: string;
    repoUrl?: string;
}

export default function tsDocToApiMarkdown(config: TsDocToApiMarkdownConfig) {
    return apiJsonToMarkdown(tsDocToApiJson({
        entrypoints: config.entrypoints,
        outdir: fs.mkdtempSync(path.join(os.tmpdir(), 'api-json')),
        repoUrl: config.repoUrl
    }), config.outdir);
}
