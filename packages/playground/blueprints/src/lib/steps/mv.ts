import { logger } from '@php-wasm/logger';
import type { StepHandler } from '.';

/**
 * @inheritDoc mv
 * @hasRunnableExample
 * @landingPage /index2.php
 * @example
 *
 * <code>
 * {
 * 		"step": "mv",
 * 		"fromPath": "/wordpress/index.php",
 * 		"toPath": "/wordpress/index2.php"
 * }
 * </code>
 */
export interface MvStep {
	step: 'mv';
	/** Source path */
	fromPath: string;
	/** Target path */
	toPath: string;
}

/**
 * Moves a file or directory from one path to another.
 */
export const mv: StepHandler<MvStep> = async (
	playground,
	{ fromPath, toPath }
) => {
	if (!fromPath.startsWith('/') || !toPath.startsWith('/')) {
		logger.error(
			`
The mv() step in your Blueprint refers to a relative path.

Playground recently changed the working directory from '/' to '/wordpress' to better mimic 
how real web servers work. This means relative paths that used to work may no longer 
point to the correct location.

Playground automatically updated the path for you, but at one point path rewriting will be removed. Please
update your code to use an absolute path instead:

Instead of:  mv({ fromPath: 'wordpress/wp-load.php', toPath: 'wordpress/wp-load.php' });
Use:         mv({ fromPath: '/wordpress/wp-load.php', toPath: '/wordpress/wp-load.php' });

This will ensure your code works reliably regardless of the current working directory.
		`.trim()
		);
	}
	if (!fromPath.startsWith('/')) {
		fromPath = `/${fromPath}`;
	}
	if (!toPath.startsWith('/')) {
		toPath = `/${toPath}`;
	}
	await playground.mv(fromPath, toPath);
};
