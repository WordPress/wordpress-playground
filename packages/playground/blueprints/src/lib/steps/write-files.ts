import { writeFiles as writeFilesToPhpWasm } from '@php-wasm/universal';
import type { StepHandler } from '.';
import type { Directory } from '../v1/resources';
import { logger } from '@php-wasm/logger';

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
	if (!writeToPath.startsWith('/')) {
		logger.error(
			`
The writeFiles() step in your Blueprint refers to a relative path.

Playground recently changed the working directory from '/' to '/wordpress' to better mimic 
how real web servers work. This means relative paths that used to work may no longer
point to the correct location.

Playground automatically updated the path for you, but at one point path rewriting will be removed. Please
update your code to use an absolute path instead:

Instead of:  writeFiles({ writeToPath: 'wordpress/wp-content/plugins/my-plugin', filesTree: { name: 'style.css': 'a { color: red; }' });
Use:         writeFiles({ writeToPath: '/wordpress/wp-content/plugins/my-plugin', filesTree: { name: 'style.css': 'a { color: red; }' });

This will ensure your code works reliably regardless of the current working directory.
		`.trim()
		);
		writeToPath = `/${writeToPath}`;
	}
	await writeFilesToPhpWasm(playground, writeToPath, filesTree.files);
};
