// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as path from 'path';
import * as fs from 'fs';
import type { IConfigFile } from './IConfigFile';

/**
 * Helper for loading the api-documenter.json file format.  Later when the schema is more mature,
 * this class will be used to represent the validated and normalized configuration, whereas `IConfigFile`
 * represents the raw JSON file structure.
 */
export class DocumenterConfig {
	public readonly configFilePath: string;
	public readonly configFile: IConfigFile;

	/**
	 * The config file name "api-documenter.json".
	 */
	public static readonly FILENAME: string = 'api-documenter.json';

	private constructor(filePath: string, configFile: IConfigFile) {
		this.configFilePath = filePath;
		this.configFile = configFile;
	}

	/**
	 * Load and validate an api-documenter.json file.
	 *
	 * @param  configFilePath
	 */
	public static loadFile(configFilePath: string): DocumenterConfig {
		const configFile: IConfigFile = JSON.parse(
			fs.readFileSync(configFilePath).toString()
		);

		return new DocumenterConfig(path.resolve(configFilePath), configFile);
	}
}
