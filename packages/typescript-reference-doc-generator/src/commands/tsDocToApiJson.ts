import * as fs from 'fs';
import * as path from 'path';
import { ExtractorConfig, Extractor } from '@microsoft/api-extractor';

require('../patch-tsdoc');

export interface TsDocToApiJsonConfig {
    entrypoints: string[];
    outdir: string;
    tsconfig?: string;
    packageJson?: string;
    repoUrl?: string;
}

export default function tsDocToApiJson(config: TsDocToApiJsonConfig): string[] {
    if (!fs.existsSync(config.outdir)) {
        fs.mkdirSync(config.outdir, { recursive: true });
    }

    return config.entrypoints.map(entrypoint => {
        const outFilename = entrypoint.replace(/[\/#\.\-]+/g, '-').replace('.d.ts', '').replace(/^\-+/, '') + '.api.json';
        const extractorConfig = ExtractorConfig.prepare({
            configObject: prepareApiExtractorConfig(
                entrypoint,
                path.join(process.cwd(), path.join(config.outdir, outFilename)),
                config.tsconfig || findNearestFile('tsconfig.json', entrypoint)
            ),
            packageJsonFullPath: findNearestFile('package.json', entrypoint),
        } as any);
        return extractorConfig;
    }).map(extractorConfig => {
        const extractorResult = Extractor.invoke(extractorConfig, {
            localBuild: true,
            showVerboseMessages: true,
            showDiagnostics: false,
        });

        if (extractorResult.errorCount > 0) {
            throw new Error('API Extractor completed with errors');
        }
        return extractorConfig.apiJsonFilePath;
    });
}

function findNearestFile(filename, basePath = process.cwd()) {
    let filePath;
    do {
        filePath = path.join(basePath, filename);
        if (fs.existsSync(filePath)) {
            break;
        }
        basePath = path.dirname(basePath);
    } while (true && basePath !== '/');
    return filePath
}


function prepareApiExtractorConfig(entrypoint, outputPath, tsconfig) {
    const logLevelNone = { logLevel: 'none' };
    return {
        "$schema": "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
        "projectFolder": process.cwd(),

        "mainEntryPointFilePath": entrypoint,
        "bundledPackages": [],
        "compiler": {
            "tsconfigFilePath": tsconfig,
        },

        "docModel": {
            "enabled": true,
            "apiJsonFilePath": outputPath,
            "includeForgottenExports": true,
        },

        "dtsRollup": { "enabled": false },
        "tsdocMetadata": { "enabled": false, },

        "messages": {
            "compilerMessageReporting": {
                "default": {
                    "logLevel": "warning"
                }
            },

            "extractorMessageReporting": {
                "default": {
                    "logLevel": "warning"
                },
                "ae-forgotten-export": logLevelNone,
                "ae-missing-release-tag": logLevelNone
            },

            "tsdocMessageReporting": {
                "default": {
                    "logLevel": "warning"
                },
                "tsdoc-escape-right-brace": logLevelNone,
                "tsdoc-malformed-inline-tag": logLevelNone,
                "tsdoc-escape-greater-than": logLevelNone
            }
        }
    }
}
