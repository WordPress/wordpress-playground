import type { PHPResponse } from '@php-wasm/universal';
import type { StepHandler } from '.';
import { logger } from '@php-wasm/logger';

/* eslint-disable comment-length/limit-multi-line-comments */
/**
 * @inheritDoc runPHP
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "runPHP",
 * 		"code": "<?php require_once 'wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'wp-load.php required for WP functionality', 'post_status' => 'publish')); ?>"
 * }
 * </code>
 */
/* eslint-enable comment-length/limit-multi-line-comments */
export interface RunPHPStep {
	/** The step identifier. */
	step: 'runPHP';
	/** The PHP code to run. */
	code: string;
}

/**
 * Runs PHP code.
 * When running WordPress functions, the `code` key must first load [`wp-load.php`](https://github.com/WordPress/WordPress/blob/master/wp-load.php) and start with `"<?php require_once 'wordpress/wp-load.php'; "`.
 */
export const runPHP: StepHandler<RunPHPStep, Promise<PHPResponse>> = async (
	playground,
	{ code }
) => {
	if (
		code.includes('"wordpress/wp-load.php"') ||
		code.includes("'wordpress/wp-load.php'")
	) {
		logger.error(
			`
It looks like you're trying to load WordPress using a relative path 'wordpress/wp-load.php'.

Playground recently changed the working directory from '/' to '/wordpress' to better mimic 
how real web servers work. This means relative paths that used to work may no longer 
point to the correct location.

Playground automatically updated the path for you, but at one point path rewriting will be removed. Please
update your code to use an absolute path instead:

Instead of:  require_once 'wordpress/wp-load.php';
Use:         require_once '/wordpress/wp-load.php';

This will ensure your code works reliably regardless of the current working directory.
		`.trim()
		);
		code = code.replace(
			"'wordpress/wp-load.php'",
			"'/wordpress/wp-load.php'"
		);
		code = code.replace(
			'"wordpress/wp-load.php"',
			'"/wordpress/wp-load.php"'
		);
	}
	return await playground.run({ code });
};
