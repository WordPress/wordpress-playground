import { PHPResponse } from '@php-wasm/universal';
import { StepHandler } from '.';

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
export interface RunPHPStep {
	/** The step identifier. */
	step: 'runPHP';
	/** The PHP code to run. */
	code: string;
}

/**
 * Runs PHP code.
 */
export const runPHP: StepHandler<RunPHPStep, Promise<PHPResponse>> = async (
	playground,
	{ code }
) => {
	return await playground.run({ code });
};
