import { StepHandler } from '.';
import { PHPRunOptions } from '@php-wasm/universal';

/**
 * @inheritDoc runPHP
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "runPHP",
 * 		"options": {
 * 			"code": "<?php echo $_SERVER['CONTENT_TYPE']; ?>",
 * 			"headers": {
 * 				"Content-type": "text/plain"
 * 			}
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
