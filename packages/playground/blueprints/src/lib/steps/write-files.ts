import { writeFiles as writeFilesToPhpWasm } from '@php-wasm/universal';
import { StepHandler } from '.';
import { Directory } from '../resources';

/**
 * @inheritDoc writeFiles
 * @hasRunnableExample
 * @landingPage /test.php
 * @example
 *
 * <code>
 * {
 * 		"step": "writeFiles",
 * 		"writeToPath": "/wordpress/wp-content/plugins/my-plugin",
 * 		"filesTree": {
 * 			"name": "my-plugin",
 * 			"files": {
 * 				"index.php": "<?php echo '<a>Hello World!</a>'; ?>",
 * 				"public": {
 * 					"style.css": "a { color: red; }"
 * 				}
 * 			}
 * 		}
 * }
 * </code>
 */
export interface WriteFilesStep<DirectoryResource> {
	step: 'writeFiles';
	/** The path of the file to write to */
	writeToPath: string;
	/**
	 * The 'filesTree' defines the directory structure, supporting 'literal:directory' or
	 * 'git:directory' types. The 'name' represents the root directory, while 'files' is an object
	 * where keys are file paths, and values contain either file content as a string or nested objects
	 * for subdirectories.
	 */
	filesTree: DirectoryResource;
}

/**
 * Writes multiple files to a specified directory in the Playground
 * filesystem.
 * ```
 * my-plugin/
 * ├── index.php
 * └── public/
 *     └── style.css
 * ```
 */
export const writeFiles: StepHandler<WriteFilesStep<Directory>> = async (
	playground,
	{ writeToPath, filesTree }
) => {
	await writeFilesToPhpWasm(playground, writeToPath, filesTree.files);
};
