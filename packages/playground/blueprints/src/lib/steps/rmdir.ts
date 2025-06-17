import { logger } from '@php-wasm/logger';
import type { StepHandler } from '.';

/**
 * @inheritDoc rmdir
 * @hasRunnableExample
 * @landingPage /wp-admin/
 * @example
 *
 * <code>
 * {
 * 		"step": "rmdir",
 * 		"path": "/wordpress/wp-admin"
 * }
 * </code>
 */
export interface RmdirStep {
	step: 'rmdir';
	/** The path to remove */
	path: string;
}

/**
 * Removes a directory at the specified path.
 */
export const rmdir: StepHandler<RmdirStep> = async (playground, { path }) => {
	if (!path.startsWith('/')) {
		logger.error(
			`
The rmdir() step in your Blueprint refers to a relative path.

Playground recently changed the working directory from '/' to '/wordpress' to better mimic 
how real web servers work. This means relative paths that used to work may no longer 
point to the correct location.

Playground automatically updated the path for you, but at one point path rewriting will be removed. Please
update your code to use an absolute path instead:

Instead of:  rmdir({ path: 'wordpress/wp-load.php' });
Use:         rmdir({ path: '/wordpress/wp-load.php' });

This will ensure your code works reliably regardless of the current working directory.
		`.trim()
		);
		path = `/${path}`;
	}
	await playground.rmdir(path);
};
