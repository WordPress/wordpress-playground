import { StepHandler } from '.';

/**
 * @inheritDoc defineWpConfigConsts
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "defineWpConfigConsts",
 * 		"consts": {
 *          "WP_DEBUG": true
 *      }
 * }
 * </code>
 */
export interface DefineWpConfigConstsStep {
	step: 'defineWpConfigConsts';
	/** The constants to define */
	consts: Record<string, unknown>;
	/**
	 * @deprecated This option is noop and will be removed in a future version.
	 * This option is only kept in here to avoid breaking Blueprint schema validation
	 * for existing apps using this option.
	 */
	virtualize?: boolean;
}

/**
 * Defines constants to be used in wp-config.php file.
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param wpConfigConst
 */
export const defineWpConfigConsts: StepHandler<
	DefineWpConfigConstsStep
> = async (playground, { consts }) => {
	for (const key in consts) {
		await playground.defineConstant(key, consts[key] as string);
	}
};
