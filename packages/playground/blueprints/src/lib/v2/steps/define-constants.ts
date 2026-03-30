import type { V2StepHandler } from '../types';
import { registerV2StepHandler } from './index';
import { joinPaths } from '@php-wasm/util';
import { defineWpConfigConstants } from '@wp-playground/wordpress';

/**
 * Defines PHP constants in wp-config.php by rewriting the file.
 *
 * Uses the `WP_Config_Transformer` utility (via
 * `defineWpConfigConstants` from `@wp-playground/wordpress`) to
 * safely insert or update `define()` calls in wp-config.php.
 * Existing constants are updated in place; new constants are
 * added before the "stop editing" marker.
 */
export const defineConstantsHandler: V2StepHandler = async (args, context) => {
	const { constants } = args as {
		constants: Record<string, boolean | string | number>;
	};
	const documentRoot = await context.php.documentRoot;
	const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');
	await defineWpConfigConstants(context.php, wpConfigPath, constants);
};

registerV2StepHandler('defineConstants', defineConstantsHandler);
