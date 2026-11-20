import { joinPaths } from '@php-wasm/util';
import type { StepHandler } from '.';
import type { UniversalPHP } from '@php-wasm/universal';
import { defineWpConfigConstants } from '@wp-playground/wordpress';

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
	 * How Playground defines the constants.
	 *
	 * - `define-before-run` (default) uses PHP's `auto_prepend_file` setting to define
	 *   the constants before the requested script runs. Use it to keep `wp-config.php`
	 *   intact, for example when working with a mounted project. The value set by
	 *   Playground takes precedence over a later definition in `wp-config.php`.
	 *
	 * - `rewrite-wp-config` adds or updates the corresponding `define()` calls in
	 *   `wp-config.php`. Use it to replace an existing definition in that file or to
	 *   keep the constants in a `wp-config.php` you plan to use outside Playground.
	 */
	method?: 'rewrite-wp-config' | 'define-before-run';
	/**
	 * @deprecated This option is noop and will be removed in a future version.
	 * This option is only kept in here to avoid breaking Blueprint schema validation
	 * for existing apps using this option.
	 */
	virtualize?: boolean;
}

/**
 * Defines PHP constants for WordPress. Use the `method` option to write them to
 * [`wp-config.php`](https://developer.wordpress.org/advanced-administration/wordpress/wp-config/).
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param wpConfigConst
 */
export const defineWpConfigConsts: StepHandler<
	DefineWpConfigConstsStep
> = async (playground, { consts, method = 'define-before-run' }) => {
	switch (method) {
		case 'define-before-run':
			await defineBeforeRun(playground, consts);
			break;
		case 'rewrite-wp-config': {
			const documentRoot = await playground.documentRoot;
			const wpConfigPath = joinPaths(documentRoot, '/wp-config.php');
			await defineWpConfigConstants(playground, wpConfigPath, consts);
			break;
		}
		default:
			throw new Error(`Invalid method: ${method}`);
	}
};

export async function defineBeforeRun(
	playground: UniversalPHP,
	consts: Record<string, unknown>
) {
	for (const key in consts) {
		await playground.defineConstant(key, consts[key] as string);
	}
}
