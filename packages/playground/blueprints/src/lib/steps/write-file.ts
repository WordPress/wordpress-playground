import { StepHandler } from '.';
import { fileToUint8Array } from './common';

/**
 * @inheritDoc writeFile
 * @hasRunnableExample
 * @landingPage /test.php
 * @example
 *
 * <code>
 * {
 * 		"step": "writeFile",
 * 		"path": "/wordpress/test.php",
 * 		"data": "<?php echo 'Hello World!'; ?>"
 * }
 * </code>
 */
export interface WriteFileStep<ResourceType> {
	step: 'writeFile';
	/** The path of the file to write to */
	path: string;
	/** The data to write */
	data: ResourceType | string | Uint8Array;
}

/**
 * Writes data to a file at the specified path.
 */
export const writeFile: StepHandler<WriteFileStep<File>> = async (
	playground,
	{ path, data }
) => {
	if (data instanceof File) {
		data = await fileToUint8Array(data);
	}
	await playground.writeFile(path, data);
};
