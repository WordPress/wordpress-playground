import { writeFiles as writeFilesToPhpWasm } from '@php-wasm/universal';
import { StepHandler } from '.';
import { Directory } from '../resources';

/**
 * @inheritDoc writeFile
 * @hasRunnableExample
 * @landingPage /test.php
 * @example
 *
 * <code>
 * {
 * 		"step": "writeFiles",
 * 		"writeToPath": "/wordpress/test.php",
 * 		"filesTree": "<?php echo 'Hello World!'; ?>"
 * }
 * </code>
 */
export interface WriteFilesStep<DirectoryResource> {
	step: 'writeFiles';
	/** The path of the file to write to */
	writeToPath: string;
	/** The data to write */
	filesTree: DirectoryResource;
}

/**
 * Writes data to a file at the specified path.
 */
export const writeFiles: StepHandler<WriteFilesStep<Directory>> = async (
	playground,
	{ writeToPath, filesTree }
) => {
	await writeFilesToPhpWasm(playground, writeToPath, filesTree.files);
};
