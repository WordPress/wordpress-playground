import { logger } from '@php-wasm/logger';
import type { StepHandler } from '.';

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
export interface WriteFileStep<FileResource> {
	step: 'writeFile';
	/** The path of the file to write to */
	path: string;
	/** The data to write */
	data: FileResource | string | Uint8Array;
}

/**
 * Writes data to a file at the specified path.
 */
export const writeFile: StepHandler<WriteFileStep<File>> = async (
	playground,
	{ path, data }
) => {
	if (data instanceof File) {
		data = new Uint8Array(await data.arrayBuffer());
	}
	if (!path.startsWith('/')) {
		logger.error(
			`
The writeFile() step in your Blueprint refers to a relative path.

Playground recently changed the working directory from '/' to '/wordpress' to better mimic 
how real web servers work. This means relative paths that used to work may no longer 
point to the correct location.

Playground automatically updated the path for you, but at one point path rewriting will be removed. Please
update your code to use an absolute path instead:

Instead of:  writeFile({ path: 'wordpress/wp-load.php', data: '<?php echo "Hello World!"; ?>' });
Use:         writeFile({ path: '/wordpress/wp-load.php', data: '<?php echo "Hello World!"; ?>' });

This will ensure your code works reliably regardless of the current working directory.
		`.trim()
		);
		path = `/${path}`;
	}
	/**
	 * PR #1426 removed the mu-plugins directory from the default
	 * WordPress build used by Playground. This is consistent with
	 * the official WordPress build, but it also breaks existing
	 * Blueprints that assume the mu-plugins directory is still
	 * in place.
	 *
	 * This code block creates the mu-plugins directory on a write
	 * attempt as a courtesy to Playground developers.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/pull/1426
	 *      for more context.
	 */
	if (
		path.startsWith('/wordpress/wp-content/mu-plugins') &&
		!(await playground.fileExists('/wordpress/wp-content/mu-plugins'))
	) {
		await playground.mkdir('/wordpress/wp-content/mu-plugins');
	}
	await playground.writeFile(path, data);
};
