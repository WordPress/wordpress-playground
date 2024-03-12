import type { RewriteRule } from '@php-wasm/universal';

/**
 * The default rewrite rules for WordPress.
 */
export const wordPressRewriteRules: RewriteRule[] = [
	{
		match: /^\/(scope:([.0-9])+\/)?([_0-9a-zA-Z-]+\/)?(wp-(content|admin|includes).*)/g,
		keep: /\/(wp-(content|admin|includes).*)/g,
	},
];
