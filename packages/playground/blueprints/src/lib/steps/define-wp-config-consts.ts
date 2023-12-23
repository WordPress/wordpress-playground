import { phpVars } from '@php-wasm/util';
import { StepHandler } from '.';
/** @ts-ignore */
import rewriteWpConfigToDefineConstants from './rewrite-wp-config-to-define-constants.php?raw';

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
 * Defines constants in a wp-config.php file.
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param wpConfigConst
 */
export const defineWpConfigConsts: StepHandler<
	DefineWpConfigConstsStep
> = async (playground, { consts }) => {
	const js = phpVars({
		consts,
		documentRoot: await playground.documentRoot,
	});
	await playground.run({
		code: `${rewriteWpConfigToDefineConstants}
		$wp_config_path = ${js.documentRoot} . '/wp-config.php';
		$wp_config = file_get_contents($wp_config_path);
		$new_wp_config = rewrite_wp_config_to_define_constants($wp_config, ${js.consts});
		file_put_contents($wp_config_path, $new_wp_config);
		`,
	});
};
