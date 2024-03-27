import { joinPaths, phpVars } from '@php-wasm/util';
import { StepHandler } from '.';
/** @ts-ignore */
import rewriteWpConfigToDefineConstants from './rewrite-wp-config-to-define-constants.php?raw';
import { UniversalPHP } from '@php-wasm/universal';

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
	 * The method of defining the constants. Possible values are:
	 *
	 * - rewrite-wp-config: Default. Rewrites the wp-config.php file to
	 *                      explicitly call define() with the requested
	 *                      name and value. This method alters the file
	 *                      on the disk, but it doesn't conflict with
	 *                      existing define() calls in wp-config.php.
	 * - define-before-run: Defines the constant before running the requested
	 *                      script. It doesn't alter any files on the disk, but
	 *                      constants defined this way may conflict with existing
	 *                      define() calls in wp-config.php.
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
 * Defines constants in a wp-config.php file.
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param wpConfigConst
 */
export const defineWpConfigConsts: StepHandler<
	DefineWpConfigConstsStep
> = async (playground, { consts, method = 'rewrite-wp-config' }) => {
	switch (method) {
		case 'define-before-run':
			await defineBeforeRun(playground, consts);
			break;
		case 'rewrite-wp-config': {
			const documentRoot = await playground.documentRoot;
			const wpConfigPath = joinPaths(documentRoot, '/wp-config.php');
			const wpConfig = await playground.readFileAsText(wpConfigPath);
			const updatedWpConfig = await rewriteDefineCalls(
				playground,
				wpConfig,
				consts
			);
			await playground.writeFile(wpConfigPath, updatedWpConfig);
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

export async function rewriteDefineCalls(
	playground: UniversalPHP,
	phpCode: string,
	consts: Record<string, unknown>
): Promise<string> {
	await playground.writeFile('/tmp/code.php', phpCode);
	const js = phpVars({
		consts,
	});
	await playground.run({
		code: `${rewriteWpConfigToDefineConstants}
	$wp_config_path = '/tmp/code.php';
	$wp_config = file_get_contents($wp_config_path);
	$new_wp_config = rewrite_wp_config_to_define_constants($wp_config, ${js.consts});
	file_put_contents($wp_config_path, $new_wp_config);
	`,
	});
	return await playground.readFileAsText('/tmp/code.php');
}
