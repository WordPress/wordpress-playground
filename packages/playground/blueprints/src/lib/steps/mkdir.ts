import { logger } from '@php-wasm/logger';
import type { StepHandler } from '.';

/**
 * @inheritDoc mkdir
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "mkdir",
 * 		"path": "/wordpress/my-new-folder"
 * }
 * </code>
 */
export interface MkdirStep {
	step: 'mkdir';
	/** The path of the directory you want to create */
	path: string;
}

/**
 * Creates a directory at the specified path.
 */
export const mkdir: StepHandler<MkdirStep> = async (playground, { path }) => {
	if (!path.startsWith('/')) {
		logger.error(
			`
The mkdir() step in your Blueprint refers to a relative path.

Playground recently changed the working directory from '/' to '/wordpress' to better mimic 
how real web servers work. This means relative paths that used to work may no longer 
point to the correct location.

Playground automatically updated the path for you, but at one point path rewriting will be removed. Please
update your code to use an absolute path instead:

Instead of:  mkdir({ path: 'wordpress/my-new-folder' });
Use:         mkdir({ path: '/wordpress/my-new-folder' });

This will ensure your code works reliably regardless of the current working directory.
		`.trim()
		);
	}
	await playground.mkdir(path);
};
