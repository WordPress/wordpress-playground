import { writeFiles } from '@php-wasm/universal';
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
 * 		"path": "/wordpress/test.php",
 * 		"data": "<?php echo 'Hello World!'; ?>"
 * }
 * </code>
 */
export interface WriteFilesStep<DirectoryResource> {
	step: 'writeFile';
	/** The path of the file to write to */
	writeToPath: string;
	/** The data to write */
	filesTree: DirectoryResource;
}

/**
 * Writes data to a file at the specified path.
 */
export const writeFile: StepHandler<WriteFilesStep<Directory>> = async (
	playground,
	{ writeToPath, filesTree }
) => {
	await writeFiles(playground, writeToPath, filesTree.files);
};
