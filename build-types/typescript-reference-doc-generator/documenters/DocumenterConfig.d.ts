import type { IConfigFile } from './IConfigFile';
/**
 * Helper for loading the api-documenter.json file format.  Later when the schema is more mature,
 * this class will be used to represent the validated and normalized configuration, whereas `IConfigFile`
 * represents the raw JSON file structure.
 */
export declare class DocumenterConfig {
    readonly configFilePath: string;
    readonly configFile: IConfigFile;
    /**
     * The config file name "api-documenter.json".
     */
    static readonly FILENAME: string;
    private constructor();
    /**
     * Load and validate an api-documenter.json file.
     *
     * @param  configFilePath
     */
    static loadFile(configFilePath: string): DocumenterConfig;
}
