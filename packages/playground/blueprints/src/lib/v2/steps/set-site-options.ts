import type { V2StepHandler } from '../types';
import { registerV2StepHandler } from './index';
import { phpVar } from '@php-wasm/util';

/**
 * Sets WordPress site options via `update_option()`.
 *
 * For each key-value pair in `options`, calls
 * `update_option($key, $value)`. When the
 * `permalink_structure` option is set, rewrite rules are
 * flushed afterward so the new structure takes effect
 * immediately.
 */
export const setSiteOptionsHandler: V2StepHandler = async (args, context) => {
	const { options } = args as { options: Record<string, unknown> };
	const documentRoot = await context.php.documentRoot;

	const result = await context.php.run({
		code: `<?php
		require_once ${phpVar(documentRoot)} . '/wp-load.php';
		$site_options = ${phpVar(options)};
		foreach ($site_options as $name => $value) {
			update_option($name, $value);
		}
		if (array_key_exists('permalink_structure', $site_options)) {
			flush_rewrite_rules();
		}
		`,
	});
	if (result.errors) {
		throw new Error(result.errors);
	}
};

registerV2StepHandler('setSiteOptions', setSiteOptionsHandler);
