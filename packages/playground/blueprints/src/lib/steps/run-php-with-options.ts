import type { StepHandler } from '.';
import type { PHPRunOptions } from '@php-wasm/universal';

/**
 * @inheritDoc runPHP
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "runPHPWithOptions",
 * 		"options": {
 * 			"code": "<?php require_once '/wordpress/wp-load.php'; update_option('blogname', file_get_contents('php://input'));?>",
 * 			"body": "Site Name Modified by runPHPWithOptions"
 * 		}
 * }
 * </code>
 */
export interface RunPHPWithOptionsStep {
	step: 'runPHPWithOptions';
	/**
	 * Run options (See
	 * /wordpress-playground/api/universal/interface/PHPRunOptions/))
	 */
	options: PHPRunOptions;
}

/**
 * Runs PHP code with the given options.
 */
export const runPHPWithOptions: StepHandler<RunPHPWithOptionsStep> = async (
	playground,
	{ options }
) => {
	return await playground.run(options);
};
